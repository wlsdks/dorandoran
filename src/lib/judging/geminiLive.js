/**
 * Live AI judging — 라이브 수업 중 학생 제출물을 7판사가 동시에 평가.
 * 분리 이유: 사후 과제(gemini.js)와 라이브 심사는 호출 패턴/프롬프트/모델 fallback이 다르고
 * 합치면 698줄까지 커져 navigability가 떨어짐.
 */
import { abortableDelay, throwIfAborted } from '@/lib/async-work';
import { JUDGES } from './judges';
import { getGeminiModel } from '@/lib/gemini/client';
import { withRetry, urlToInlinePart, parseJudgeResponse } from './gemini';
import { LIVE_EVALUATION_GUIDE } from './prompts';

// 라이브 AI 심사 전용 — flash-lite로 전환 (Pro/Flash는 100명 규모에서 429/RPM 한도 다발).
// lite는 Tier 1 기준 RPM ~4000으로 여유. 7판사 페르소나 동시 호출의 다양성은 prompt로 보강.
const LIVE_MODEL_NAME = 'gemini-2.5-flash-lite';

/**
 * Build multimodal parts for a live submission.
 * - imageUrl → inlineData (이미지)
 * - title/description → 텍스트
 *
 * 이미지 로드 실패는 throw로 승격 — 네트워크 문제로 다른 학생 대비 점수가 왜곡되는
 * 것보다 "이 판사 실패"로 마킹 후 avgScore에서 제외하는 게 공정함.
 */
async function buildLiveParts(submission, signal) {
  const parts = [];
  // 심사 편향 방지를 위해 제출자 이름은 AI에 전달하지 않음 — 작품(제목/설명/이미지/코드) 자체만 평가.
  const textBits = [];
  if (submission.title) textBits.push(`[제목] ${submission.title}`);
  if (submission.description) textBits.push(`[설명]\n${submission.description.slice(0, 600)}`);
  // HTML/JS/CSS 코드 제출 — 최대 80KB로 잘라서 평가. 클라/RTDB 한계 100KB와 호환.
  // 80KB ≈ 20K tokens, flash-lite 1M 토큰 한계에는 충분히 여유.
  if (submission.code) {
    const code = submission.code.length > 80000
      ? submission.code.slice(0, 80000) + '\n[... 이하 생략 ...]'
      : submission.code;
    textBits.push(`[제출 코드 (HTML/JS/CSS)]\n${code}`);
  }

  let imageFailed = false;
  if (submission.imageUrl) {
    // 3회까지 재시도 — 일시적 네트워크 지터 대응
    let imagePart = null;
    for (let i = 0; i < 3; i++) {
      try {
        imagePart = await urlToInlinePart(submission.imageUrl, { signal });
        break;
      } catch {
        throwIfAborted(signal);
        if (i < 2) await abortableDelay(400 * (i + 1), signal);
      }
    }
    if (imagePart) {
      if (textBits.length > 0) parts.push({ text: textBits.join('\n') });
      parts.push({ text: '\n[제출 이미지]' });
      parts.push(imagePart);
      return { parts, imageFailed: false };
    }
    // 이미지 로드 실패 — throw 대신 텍스트 fallback. 텍스트도 없으면 그때만 throw.
    // 이전에는 imageUrl 한 번 거부되면 전체 제출이 실패했음. 라이브 수업에서 제출자 안타까움.
    imageFailed = true;
    textBits.push('[이미지를 불러올 수 없어 텍스트 정보만으로 평가합니다]');
  }

  if (textBits.length === 0) {
    throw new Error('제출 내용을 불러올 수 없습니다 (이미지·텍스트 모두 비어있음)');
  }
  parts.push({ text: textBits.join('\n') });
  return { parts, imageFailed };
}

/**
 * 7명 페르소나를 합친 system instruction 생성.
 * 한 번의 호출로 모든 판사 결과를 받기 위함 — RPM/quota 절감.
 */
function buildAllJudgesSystemInstruction(questionTitle) {
  const judgesBlock = JUDGES.map((j, i) => `### ${i + 1}. ${j.name} (id: "${j.id}") — ${j.role}
- 성격: ${j.personality}
- 평가 초점: ${j.focus}

${j.systemPrompt}`).join('\n\n---\n\n');

  const idsBlock = JUDGES.map(j => `  "${j.id}": { "score": (1~10 정수), "comment": "...", "highlight": "..." }`).join(',\n');

  const contextLine = questionTitle
    ? `\n[수업 실습 주제]\n${questionTitle}\n`
    : '';

  return `당신은 7명의 심사위원을 동시에 연기하는 평가자입니다. 같은 작품을 7개의 서로 다른 시선으로 봐야 합니다.

⚠️ 절대 금지 사항 (이걸 어기면 평가는 무효):
1. **7명이 비슷한 코멘트를 하는 것** — 각 판사의 전문 분야가 다르므로 같은 작품을 봐도 주목하는 지점이 달라야 합니다.
2. **모든 판사가 비슷한 점수를 주는 것** — 강점/약점 인식이 다르므로 점수 분포가 자연스럽게 2~4점 차이가 나야 합니다 (예: 7,8,6,9,5,7,8).
3. **판사 캐릭터 말투를 흐리게 쓰는 것** — 김기획은 "~하면 더 좋았을 것 같습니다" 전문 어조, 박사용은 "저는 이 부분이 헷갈렸어요" 일반인 어조, 이디자는 "여백이 참 좋네요" 감성 어조처럼 명확히 달라야 합니다.

✅ 올바른 평가 예시:
- 같은 작품을 보고 김기획은 "문제 정의가 약하다"(6점), 이디자는 "색감 조합이 인상적"(8점), 한완성은 "기능은 동작하나 에러 처리 없음"(7점)처럼 **각자의 렌즈로 다른 결론**.
- 한 명이 칭찬한 부분을 다른 한 명이 비판하는 것이 자연스럽습니다.
${contextLine}
${LIVE_EVALUATION_GUIDE}

[심사위원단 — 각자의 페르소나]

${judgesBlock}

---

[출력 형식 — 반드시 이 JSON 구조로만 응답]
순수 JSON만, 코드블록/설명 텍스트 금지. 7명 모두 빠짐없이 포함:

{
${idsBlock}
}

각 심사위원의 comment는 자기 캐릭터 말투를 명확히 드러내고(김기획=PM 어조, 박사용=일반 사용자 어조, 이디자=감성적 디자이너 어조 등), highlight는 그 판사 관점에서 본 한 줄 카피(40~70자)여야 합니다.`;
}

// flash-lite 우선 (RPM/비용 최적). lite가 모델 미지원/400 에러 시에만 flash로 fallback.
// 429(rate)는 lite에서도 거의 안 터지지만 만약 발생하면 즉시 throw → 상위 retry가 처리.
const LIVE_MODEL_FALLBACKS = [
  LIVE_MODEL_NAME,           // gemini-2.5-flash-lite (라이브 심사 기본)
  'gemini-2.5-flash',        // 만에 하나 lite가 응답 못할 때
];

/**
 * Evaluate one submission with ALL 7 judges in a SINGLE Gemini call.
 * Returns { [judgeId]: { score, comment, highlight, judgeId, judgeName } }
 *
 * 이전 구조: 7명 × N건 = 7N회 호출 (rate limit + quota 부담)
 * 신 구조: N건 = N회 호출 (1/7로 축소)
 */
async function evaluateAllJudgesAtOnce(submission, questionTitle, signal) {
  const systemInstruction = buildAllJudgesSystemInstruction(questionTitle);
  const { parts, imageFailed } = await buildLiveParts(submission, signal);

  let lastErr = null;
  for (const modelName of LIVE_MODEL_FALLBACKS) {
    try {
      const model = getGeminiModel({ model: modelName, systemInstruction });
      const isPro = /pro/i.test(modelName);
      // 7명분 출력 + 페르소나 다양성 확보:
      // - maxOutputTokens 8192 (7판사 × ~400~600토큰 + JSON 오버헤드)
      // - temperature 0.75: lite가 thinking 없이도 페르소나 차별화하도록 발산성 ↑
      // - 타임아웃 60초: lite는 Pro보다 빠르지만 7판사 출력은 여전히 무거움
      const result = await withRetry(
        deadlineSignal => model.generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            ...(isPro ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
          },
        }, { signal: deadlineSignal, timeoutMs: 60000 }),
        2,
        2500,
        60000,
        { signal },
      );
      const raw = parseJudgeResponse(result.response.text());

      // 응답 검증 — 7명 모두 있어야 정상. 누락된 판사는 에러로 마킹.
      const out = {};
      for (const judge of JUDGES) {
        const r = raw[judge.id];
        if (r && typeof r.score === 'number') {
          out[judge.id] = {
            score: r.score,
            comment: r.comment || '',
            highlight: r.highlight || '',
            judgeId: judge.id,
            judgeName: judge.name,
          };
        } else {
          out[judge.id] = {
            judgeId: judge.id,
            judgeName: judge.name,
            score: 0,
            comment: '심사 응답에서 이 판사 결과 누락',
            highlight: '',
            error: true,
          };
        }
      }
      return { judges: out, imageFailed };
    } catch (err) {
      throwIfAborted(signal);
      lastErr = err;
      const msg = (err?.message || '').toLowerCase();
      // 모델 미지원/잘못된 ID는 다음 fallback. 429(rate)·파싱 에러는 즉시 throw.
      const isModelIssue = msg.includes('not found') || msg.includes('404') || msg.includes('400')
        || msg.includes('unsupported') || msg.includes('does not exist')
        || msg.includes('invalid') || msg.includes('is not supported');
      if (!isModelIssue) throw err;
    }
  }
  throw lastErr || new Error('모든 모델이 응답하지 못했습니다.');
}

/**
 * Live judging — ONE Gemini call per submission, returns all 7 judges' verdicts.
 * 호출 수: 7N → N (rate limit 부담 1/7로 감소).
 *
 * 학생들의 "판사 7명이 차례로 고민하는" 라이브 연출은 클라이언트에서 유지:
 * API 응답 후, onJudgeStart/onJudgeComplete를 stagger로 순차 방송.
 *
 * onJudgeStart(judge): 판사가 "지금 이 작품 보는 중" 시작 시점 훅
 * onJudgeComplete(judgeId, result): 판사 완료
 */
export async function judgeLiveSubmission(submission, questionTitle, onJudgeComplete, onJudgeStart, { signal } = {}) {
  // pacing 파라미터 — 전자칠판에 7명 판사의 "조사 중 → 평가 완료" 흐름을 체감하도록.
  // 30명 기준 1분 안 완료 목표로 단축. 7명 판사 thinking 연출은 유지하되 간격만 좁힘.
  const START_STAGGER_MS = 180;
  const MIN_THINK_MS = 900;
  const THINK_JITTER_MS = 600;
  const DONE_STAGGER_MS = 140;  // 결과 도착 후 판사별 done 방송 간격

  // 1) 모든 판사 thinking 시작 방송 (stagger) + 같은 시점에 백그라운드로 단일 API 호출 시작
  const judgePromise = evaluateAllJudgesAtOnce(submission, questionTitle, signal).catch((err) => err);

  const startTimes = {};
  for (let i = 0; i < JUDGES.length; i++) {
    if (i > 0) await abortableDelay(START_STAGGER_MS, signal);
    const judge = JUDGES[i];
    startTimes[judge.id] = Date.now();
    throwIfAborted(signal);
    await onJudgeStart?.(judge);
  }

  // 2) API 응답 대기
  const apiResult = await judgePromise;
  throwIfAborted(signal);
  const apiFailed = apiResult instanceof Error;

  // 3) 결과를 판사별로 stagger 방송 — 동시에 done되지 않도록 + MIN_THINK_MS 보장
  const results = {};
  const apiJudges = apiFailed ? null : apiResult.judges;
  const imageFailed = apiFailed ? false : !!apiResult.imageFailed;
  for (let i = 0; i < JUDGES.length; i++) {
    const judge = JUDGES[i];
    const startedAt = startTimes[judge.id];
    const minDoneAt = startedAt + MIN_THINK_MS + Math.random() * THINK_JITTER_MS + i * DONE_STAGGER_MS;

    if (apiFailed) {
      results[judge.id] = {
        judgeId: judge.id,
        judgeName: judge.name,
        score: 0,
        comment: `심사 중 오류: ${apiResult.message}`,
        highlight: '',
        error: true,
      };
    } else {
      results[judge.id] = apiJudges[judge.id];
    }

    const waitMs = minDoneAt - Date.now();
    if (waitMs > 0) await abortableDelay(waitMs, signal);
    throwIfAborted(signal);
    await onJudgeComplete?.(judge.id, results[judge.id]);
  }

  const valid = Object.values(results).filter(r => !r.error);
  const totalScore = valid.reduce((sum, r) => sum + (r.score || 0), 0);
  const avgScore = valid.length ? totalScore / valid.length : 0;

  return {
    results,
    summary: {
      totalJudges: valid.length,
      erroredJudges: JUDGES.length - valid.length,
      avgScore: Math.round(avgScore * 10) / 10,
      totalScore,
      imageFailed,
    },
  };
}
