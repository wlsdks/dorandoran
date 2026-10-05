import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

export function isSummaryReady() {
  return isGeminiConfigured();
}

const PROMPT = `당신은 강의 중 학생들의 응답을 실시간으로 읽고 패턴을 요약하는 분석가입니다.

강사가 즉시 다음 대응을 결정할 수 있도록, 응답들을 **공통 테마 2~4개**로 묶어 간결하게 정리해주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "themes": [
    { "label": "(공통 주제, 3~8자)", "count": (이 주제로 분류된 응답 수), "summary": "(1~2문장 요약)" }
  ],
  "insight": "(강사에게 도움될 1문장 인사이트, 예: '대부분 A에 공감하지만 B에 대한 불안도 함께 보입니다')"
}`;

export async function summarizeResponses({ questionTitle, questionType, responses }) {
  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  const responseText = responses
    .slice(0, 100) // cap at 100 to avoid huge prompts
    .map((r, i) => `${i + 1}. ${r}`)
    .join('\n');

  const prompt = `[질문]
${questionTitle}

[질문 유형]
${questionType === 'wordcloud' ? '워드클라우드 (단어/짧은 구)' : 'Q&A (자유 서술)'}

[학생 응답 ${responses.length}개]
${responseText}

위 응답들의 공통 테마와 강사에게 유용한 인사이트를 요약해주세요.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 30000, timeoutMessage: "요약 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('요약 파싱 실패');
  }
}
