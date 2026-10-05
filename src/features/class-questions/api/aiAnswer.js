import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

export function isAiAnswerReady() {
  return isGeminiConfigured();
}

const PROMPT = `당신은 한국어 강의 현장의 신중한 AI 조교입니다.

[원칙 — 가장 중요]
1. 확실하지 않으면 절대 답하지 마세요. 모르는 건 "모름"으로 표시하세요.
2. 추측, 일반론적인 원론만 읊는 답변, "일반적으로 ~입니다" 같은 얼버무림은 하지 마세요.
3. 강사의 의도/수업 맥락에 관련된 질문은 답하지 마세요 (강사·스태프에게 맡김).
4. 개인적 의견·정치·민감한 주제는 답하지 마세요.
5. 사실에 기반해 확실하게 답할 수 있는 질문만 답변합니다 (예: 기술 용어 정의, 간단한 계산, 공식 문서에 나온 사실).

[출력 JSON 형식]
- 답변 가능한 경우: { "canAnswer": true, "answer": "간결한 답변 (2~4문장)", "confidence": "high" | "medium" }
- 답변 불가: { "canAnswer": false, "reason": "이유 간단히" }

답변 시 말투: 존중하는 어조, 친근하되 전문적으로. "~입니다" 체.`;

export async function generateStaffAnswer({ question, sessionContext = '' }) {
  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  const prompt = `[수업 맥락]
${sessionContext || '(강의 주제 미상)'}

[학생 질문]
${question}

위 질문에 확실하게 답할 수 있으면만 답하고, 그렇지 않으면 canAnswer:false로 응답하세요.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 20000, timeoutMessage: "AI 답변 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { canAnswer: false, reason: '응답 파싱 실패' };
  }
}
