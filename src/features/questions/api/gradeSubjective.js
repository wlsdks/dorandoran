import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

/** 채점 기능 사용 가능 여부 (프록시 설정 존재). */
export function isGradingReady() {
  return isGeminiConfigured();
}

const PROMPT = `당신은 강의 중 학생들의 주관식 답변을 모범답안 기준으로 공정하게 채점하는 채점관입니다.

각 학생 답변을 모범답안의 핵심 내용과 비교해 0~100점으로 채점하세요.
- 핵심 내용을 정확히 담았으면 높은 점수, 일부만 담았으면 부분 점수, 무관하거나 비었으면 낮은 점수.
- 표현이 달라도 의미가 맞으면 인정하세요. 맞춤법·문장력보다 내용 정확도를 우선합니다.
- feedback은 학생에게 보여줄 1문장의 짧고 따뜻한 피드백입니다(한국어, 최대 60자).

반드시 아래 JSON 형식으로만 응답하세요. grades 배열은 입력된 답변과 같은 순서, 같은 개수여야 합니다:
{
  "grades": [
    { "index": (1부터 시작하는 답변 번호), "score": (0~100 정수), "feedback": "(1문장 피드백)" }
  ]
}`;

/**
 * 모범답안 대비 학생 답변들을 일괄 채점.
 * @param {string} questionTitle 질문
 * @param {string} modelAnswer 모범답안
 * @param {Array<{id: string, value: string}>} responses 학생 답변 (id=participantId)
 * @returns {Promise<Array<{id, score, feedback}>>}
 */
export async function gradeSubjective({ questionTitle, modelAnswer, responses }) {
  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  const capped = responses.slice(0, 100); // 과도한 prompt 방지
  const answerText = capped
    .map((r, i) => `${i + 1}. ${r.value}`)
    .join('\n');

  const prompt = `[질문]
${questionTitle}

[모범답안]
${modelAnswer}

[학생 답변 ${capped.length}개]
${answerText}

각 답변을 모범답안 기준으로 채점해주세요.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192, // 100명 일괄 채점(학생당 score+feedback) 시 4096 초과 가능 → 여유 확보
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 30000, timeoutMessage: "채점 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('채점 파싱 실패');
    parsed = JSON.parse(match[0]);
  }

  const grades = Array.isArray(parsed?.grades) ? parsed.grades : [];
  // index(1-based) → participantId 매핑. 누락된 답변은 결과에서 제외.
  return grades
    .map((g) => {
      const r = capped[(g.index ?? 0) - 1];
      if (!r) return null;
      const score = Math.max(0, Math.min(100, Math.round(Number(g.score) || 0)));
      const feedback = typeof g.feedback === 'string' ? g.feedback.slice(0, 500) : '';
      return { id: r.id, score, feedback };
    })
    .filter(Boolean);
}
