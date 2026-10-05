/**
 * Gemini AI evaluation engine for assignment judging (사후 과제 + 미리보기).
 * 라이브 수업 심사는 ./geminiLive 로 분리.
 * 시상 계산은 ./awards 로 분리.
 *
 * API key는 이 번들에 존재하지 않는다 — Cloudflare Worker 프록시가 서버 시크릿으로
 * 들고 있다. 클라이언트 설정은 프록시 URL뿐. 자세한 배경은 worker/README.md 참조.
 */
import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';
import { withDeadline, abortableDelay, throwIfAborted } from '@/lib/async-work';
import { JUDGES } from './judges';
import { EVALUATION_GUIDE, PREVIEW_PROMPT } from './prompts';

export function isGeminiReady() {
  return isGeminiConfigured();
}

const MODEL_NAME = 'gemini-2.5-flash-lite';
const MAX_INPUT_CHARS = 120000; // ~30K tokens, leaves room for system+prompt+output

/**
 * 일시적 실패는 지수 백오프로 재시도한다.
 *
 * 고정 2초 × 2회였을 때, Gemini가 "high demand"(503)로 몇 분간 밀리면 4초 안에 재시도를
 * 다 소진하고 판사가 오류로 확정됐다. 과부하는 초 단위가 아니라 분 단위로 풀리므로
 * 2s → 4s → 8s → 16s로 벌려 총 30초까지 기다린다. 판사 7명이 동시에 재시도하며 같은 순간
 * 몰리는 것도 피해야 해서 ±25% 지터를 준다.
 */
export async function withRetry(fn, retries = 4, delayMs = 2000, timeoutMs = 45000, { signal } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await withDeadline(fn, timeoutMs, { signal, message: `API 타임아웃 (${Math.round(timeoutMs / 1000)}초)` });
    } catch (err) {
      throwIfAborted(signal);
      if (i === retries) throw err;
      const msg = err.message || '';
      const isTransient =
        msg.includes('429') || msg.includes('503') ||
        msg.includes('high demand') || msg.includes('overloaded') ||
        msg.includes('NETWORK') || msg.includes('network') ||
        msg.includes('Failed to fetch') || msg.includes('타임아웃');
      if (!isTransient) throw err;
      const backoff = delayMs * 2 ** i;
      const jitter = backoff * (0.75 + Math.random() * 0.5);
      await abortableDelay(jitter, signal);
    }
  }
}

/**
 * Fetch URL → base64 data part for Gemini inlineData.
 * Firebase Storage URL도 fetch 가능 (CORS 설정됨).
 */
export { urlToInlinePart } from '@/lib/bounded-image';
import { urlToInlinePart } from '@/lib/bounded-image';

export function parseJudgeResponse(text) {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); }
      catch { throw new Error(`심사 응답 파싱 실패: ${cleaned.slice(0, 200)}`); }
    }
    throw new Error(`심사 응답 파싱 실패: ${cleaned.slice(0, 200)}`);
  }
}

function buildContent(submission) {
  const parts = [];
  if (submission.prdContent) {
    let prd = submission.prdContent;
    if (prd.length > 20000) prd = prd.slice(0, 20000) + '\n[...생략...]';
    parts.push(`[PRD/기획서 (학생 작성 텍스트)]\n${prd}`);
  }
  if (Array.isArray(submission.screenshots) && submission.screenshots.length > 0) {
    parts.push(`[결과물 스크린샷] ${submission.screenshots.length}장 (이미지로 함께 첨부됨)`);
  }
  if (submission.code) {
    let code = submission.code;
    if (code.length > MAX_INPUT_CHARS) {
      code = code.slice(0, MAX_INPUT_CHARS) + `\n\n[... 이하 ${submission.code.length - MAX_INPUT_CHARS}자 생략됨 ...]`;
    }
    parts.push(`[학생이 첨부한 결과물 HTML 코드]\n${code}`);
  }
  // 구 폼 호환
  if (submission.fileContent) {
    let code = submission.fileContent;
    if (code.length > MAX_INPUT_CHARS) {
      code = code.slice(0, MAX_INPUT_CHARS) + `\n\n[... 이하 ${submission.fileContent.length - MAX_INPUT_CHARS}자 생략됨 ...]`;
    }
    parts.push(`[업로드된 코드/파일]\n${code}`);
  }
  if (submission.description) {
    parts.push(`[프로젝트 설명]\n${submission.description}`);
  }
  return parts.join('\n\n') || '(제출물 없음)';
}

/**
 * 제출물의 스크린샷(여러 장)을 Gemini inlineData parts로 변환.
 * 한 장이라도 실패해도 다른 자료(PRD/프롬프트)로 평가가 가능하도록 실패는 swallow.
 */
async function buildScreenshotParts(submission, max = 5, signal) {
  const shots = Array.isArray(submission.screenshots) ? submission.screenshots.filter(s => s?.url) : [];
  if (shots.length === 0) return [];
  const subset = shots.slice(0, max);
  const out = [{ text: `\n[결과물 스크린샷 ${subset.length}장 — 순서대로 첨부]` }];
  let remainingBytes = 3.5 * 1024 * 1024;
  for (let i = 0; i < subset.length; i++) {
    try {
      throwIfAborted(signal);
      const part = await urlToInlinePart(subset[i].url, { signal, maxBytes: Math.min(2 * 1024 * 1024, remainingBytes) });
      remainingBytes -= Math.ceil(part.inlineData.data.length * 3 / 4);
      out.push({ text: `\n— 스크린샷 ${i + 1} —` });
      out.push(part);
    } catch {
      throwIfAborted(signal);
      out.push({ text: `\n— 스크린샷 ${i + 1} (불러오기 실패, 무시) —` });
    }
  }
  return out;
}

/**
 * flash-lite가 과부하(503 "high demand")로 계속 거절하면 flash로 넘어간다.
 * lite와 flash는 서로 다른 용량 풀이라 한쪽이 밀려도 다른 쪽은 여유가 있는 경우가 많다.
 * 두 모델 모두 프록시 허용목록(functions/index.js ALLOWED_MODELS)에 있어야 통과한다.
 */
const MODEL_FALLBACKS = [MODEL_NAME, 'gemini-2.5-flash'];

export async function evaluateSubmission(judge, submission, { signal, screenshotParts: sharedParts } = {}) {
  const systemInstruction = `${judge.systemPrompt}\n\n${EVALUATION_GUIDE}`;

  const prompt = `[심사 대상]
- 제출자: ${submission.name}

${buildContent(submission)}

위 제출물을 평가해주세요.`;

  const screenshotParts = sharedParts || await buildScreenshotParts(submission, 5, signal);
  const parts = [{ text: prompt }, ...screenshotParts];

  let lastErr = null;
  for (const modelName of MODEL_FALLBACKS) {
    const model = getGeminiModel({ model: modelName, systemInstruction });
    try {
      const result = await withRetry(deadlineSignal => model.generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }, { signal: deadlineSignal, timeoutMs: 45000 }), 4, 2000, 45000, { signal }
      );
      return parseJudgeResponse(result.response.text());
    } catch (err) {
      throwIfAborted(signal);
      lastErr = err;
      // 과부하/용량 문제일 때만 다음 모델로. 파싱 실패나 잘못된 요청은 모델을 바꿔도 같으므로 즉시 포기.
      const msg = (err?.message || '').toLowerCase();
      const isCapacity = msg.includes('503') || msg.includes('high demand')
        || msg.includes('overloaded') || msg.includes('429');
      if (!isCapacity) throw err;
    }
  }
  throw lastErr || new Error('모든 모델이 응답하지 못했습니다.');
}

/**
 * Full panel of 7 judges evaluates a single submission — in parallel.
 * passThreshold: 통과로 인정할 최소 추천 수 (기본 3, 강사가 과제별로 지정).
 */
export async function judgeSubmission(submission, onJudgeComplete, passThreshold = 3, { signal } = {}) {
  const results = {};
  const screenshotParts = await buildScreenshotParts(submission, 5, signal);

  await Promise.all(
    JUDGES.map(async (judge) => {
      try {
        const r = await evaluateSubmission(judge, submission, { signal, screenshotParts });
        results[judge.id] = { ...r, judgeId: judge.id, judgeName: judge.name };
      } catch (error) {
        throwIfAborted(signal);
        results[judge.id] = {
          judgeId: judge.id,
          judgeName: judge.name,
          score: 0,
          selected: false,
          comment: `심사 중 오류 발생: ${error.message}`,
          strengths: [],
          improvements: [],
          error: true,
        };
      }
      throwIfAborted(signal);
      await onJudgeComplete?.(judge.id, results[judge.id]);
    })
  );

  const valid = Object.values(results).filter(r => !r.error);
  const selectedCount = valid.filter(r => r.selected).length;
  const totalScore = valid.reduce((sum, r) => sum + (r.score || 0), 0);
  const avgScore = valid.length ? totalScore / valid.length : 0;

  return {
    results,
    summary: {
      selectedCount,
      totalJudges: valid.length,
      erroredJudges: JUDGES.length - valid.length,
      passed: selectedCount >= passThreshold,
      passThreshold,
      avgScore: Math.round(avgScore * 10) / 10,
      totalScore,
    },
  };
}

/**
 * Pre-submission preview — 제출 전 형성 피드백. 점수 없이 개선 힌트만.
 */
export async function previewSubmission(submission) {
  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PREVIEW_PROMPT,
  });

  const prompt = `[제출 예정 작품]
${buildContent(submission)}

위 작품을 보고 개선 힌트를 주세요.`;

  const screenshotParts = await buildScreenshotParts(submission, 4);
  const parts = [{ text: prompt }, ...screenshotParts];

  const result = await withRetry(deadlineSignal => model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { signal: deadlineSignal, timeoutMs: 45000 })
  );

  return parseJudgeResponse(result.response.text());
}
