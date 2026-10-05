import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

export function isReportReady() {
  return isGeminiConfigured();
}

const PROMPT = `당신은 한국어 학습자에게 개인 맞춤 수업 요약을 작성하는 차분한 교육 조수입니다.

[절대 원칙 — 교육이므로 환각 금지]
1. 제공된 데이터(학생의 실제 답변 기록)에만 근거해 작성하세요.
2. 데이터에 없는 성격·성향·태도·동기는 추측하지 마세요.
3. 데이터에 없는 "왜 틀렸는지" 해석도 하지 마세요. 오답 사실만.
4. 과장된 칭찬 금지: "훌륭한 통찰력", "뛰어난 이해도", "눈부신 성과" 등 금지.
5. 구체적 숫자/사실만 사용. "많이 맞혔다" 대신 "10문제 중 7문제 정답".
6. "당신은 ~한 사람입니다" 같은 단정 금지.
7. 데이터가 부족하면(답변 0개 등) canGenerate: false로 거부.

[톤]
- 따뜻하지만 담백함
- 사실 기반, 격려는 구체적 행동에 대해서만
- "~하셨어요", "~입니다" 정중한 존댓말

[출력 JSON 형식]
- 생성 가능: {
    "canGenerate": true,
    "summary": "오늘 수업을 한 문장으로 요약 (사실 기반, 30자 내외)",
    "keyLearnings": ["실제로 답변한 질문 중 배운 개념 2~3개 (구체적)", "..."],
    "participationHighlights": ["객관적 참여 사실 1~2개 (예: '퀴즈 5문제 중 3문제 정답')"],
    "reviewRecommend": ["복습하면 좋을 질문 제목 — **반드시 '(오답)' 표시된 것만**. 정답 없는 질문(워드클라우드/Q&A/의견)은 절대 포함 금지"],
    "closingNote": "다음 수업 격려 한 문장 (과하지 않게)"
  }
- 생성 불가: { "canGenerate": false, "reason": "참여 데이터 부족" }

데이터 부족 기준: answeredCount < 2이면 canGenerate:false.
reviewRecommend 규칙:
- **"(오답·복습대상)" 태그가 붙은 질문만** 포함
- "(의견·불일치)", "(정답 없음·의견)", "(정답)" 태그는 절대 제외
- **출력 문구에는 태그를 절대 포함하지 말 것** — 질문 제목만 깔끔하게 (예: "HTTP 404 상태 코드는 무엇을 의미하나요?")
- 복습 대상 없으면 reviewRecommend: [] 빈 배열`;

export async function generateLearningReport({ stats }) {
  if (!stats) return { canGenerate: false, reason: '데이터 없음' };
  if ((stats.answeredCount || 0) < 2) {
    return { canGenerate: false, reason: '참여 데이터 부족 (최소 2문제 응답 필요)' };
  }

  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  // 학습성이 명확한 타입만 복습 대상으로 인정
  // choice는 의견 투표일 수도 있어서 제외 (정답 있어도 학습 목적 불명확)
  const REVIEWABLE_TYPES = new Set(['퀴즈', '빈칸 채우기', '미스터리 박스', '힌트 퀴즈']);

  // Build concise factual data
  const questionFacts = (stats.questionDetails || [])
    .filter(q => q.answered)
    .map(q => {
      const base = `- [${q.typeLabel}] "${q.title}"`;
      const reviewable = REVIEWABLE_TYPES.has(q.typeLabel);
      if (q.isCorrect === true) return `${base} → 내 답: ${q.myAnswer} (정답)`;
      if (q.isCorrect === false && reviewable) return `${base} → 내 답: ${q.myAnswer} / 정답: ${q.correctAnswer} (오답·복습대상)`;
      if (q.isCorrect === false) return `${base} → 내 답: ${q.myAnswer} / 정답: ${q.correctAnswer} (의견·불일치)`;
      return `${base} → 내 답: ${q.myAnswer} (정답 없음·의견)`;
    })
    .join('\n');

  const prompt = `[학생 실제 답변 기록]
강의: ${stats.courseName || '알 수 없음'}${stats.roundNumber ? ` · ${stats.roundNumber}차` : ''}
닉네임: ${stats.nickname || '학생'}
참여: 총 ${stats.totalQuestions}개 질문 중 ${stats.answeredCount}개 응답
정답률: ${stats.correctRate !== null ? stats.correctRate + '%' : '측정 불가 (정답 없는 질문)'}
점수: ${stats.totalScore}점
순위: ${stats.rank > 0 ? `${stats.rank}위 / ${stats.totalParticipants}명` : '순위 없음'}
최고 연속 정답: ${stats.bestStreak}회

[질문별 답변]
${questionFacts || '(답변 기록 없음)'}

위 사실 데이터만 근거로 학생 개인 리포트를 작성해주세요. 데이터에 없는 성격·동기·의도는 절대 추측 금지. 오답은 "복습 추천"으로만 언급하고 이유 분석은 하지 마세요.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1536,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 25000, timeoutMessage: "리포트 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else return { canGenerate: false, reason: '응답 파싱 실패' };
  }
  // 태그 잔여 제거 방어 (AI가 내부 태그를 출력 문구에 포함한 경우)
  if (parsed.reviewRecommend) {
    parsed.reviewRecommend = parsed.reviewRecommend
      .map(s => typeof s === 'string'
        ? s.replace(/\s*\((오답·복습대상|의견·불일치|정답 없음·의견|정답)\)\s*$/g, '').trim()
        : s)
      .filter(Boolean);
  }
  return parsed;
}
