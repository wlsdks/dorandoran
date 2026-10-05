import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

export function isAnalogyReady() {
  return isGeminiConfigured();
}

const PROMPT = `당신은 한국어 강의 현장에서 강사를 돕는 교수법 전문가입니다.

[역할]
강사가 수업 중 어려운 개념을 설명할 때 쓸 수 있는 **비유·예시 3개**를 제시합니다.

[절대 원칙 — 교육이므로 환각 금지]
1. **공개된 표준 지식**(교과서·위키피디아·공식 문서)에 대한 비유만 작성합니다.
2. **다음은 무조건 거부** — canGenerate: false:
   - 질문 주제가 내부 은어, 조어, 허구의 용어
   - 선택지/정답이 의미 불명인 케이스
   - 특정 회사·학원·강사 고유의 맥락
   - 개념을 정확히 이해 못 한 경우
3. 비유가 개념과 정확히 대응하지 않으면 해당 비유 항목을 제외하세요.
4. 사실 왜곡 금지: 비유가 학생에게 틀린 mental model 심을 위험 있으면 빼세요.
5. 부정확하거나 자신 없는 비유는 절대 내놓지 마세요. **3개 못 만들면 2개·1개여도 됩니다. 없으면 canGenerate: false.**

[비유 품질 기준]
- 일상적이고 누구나 아는 상황 (배달, 우체국, 집, 학교, 요리 등)
- 개념의 **핵심 대응점**이 명확
- 한계/차이점도 간단히 짚을 수 있으면 더 좋음
- 한국 문화권 중심

[출력 JSON 형식]
- 생성 가능: {
    "canGenerate": true,
    "confidence": "high" | "medium",
    "topic": "이해한 주제를 한 줄로",
    "analogies": [
      { "title": "비유 이름 (예: '배달 앱 비유')", "body": "비유 설명 2~3문장", "limitation": "비유의 한계 짧게 (선택)" }
    ],
    "disclaimer": "AI 생성 비유이므로 강사님이 정확성 확인 후 사용하세요"
  }
- 생성 불가: { "canGenerate": false, "reason": "주제 파악 불가 또는 일반 지식 밖" }

의심스러우면 거부. 애매한 비유로 학생 혼란 시키는 것보다 "비유 없음"이 낫습니다.`;

export async function generateAnalogies({ questionTitle, options, correctAnswer, audience = '비개발자 수강생' }) {
  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  const context = [
    `[질문/주제]\n${questionTitle}`,
    options?.length ? `[선택지]\n${options.map(o => `- ${o}`).join('\n')}` : null,
    correctAnswer ? `[정답]\n${correctAnswer}` : null,
    `[학생 대상]\n${audience}`,
  ].filter(Boolean).join('\n\n');

  const prompt = `${context}

위 주제를 학생에게 설명할 때 쓸 비유·예시를 제시해주세요.
주제가 표준 지식이 아니거나 이해 자신 없으면 canGenerate:false로 거부하세요.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 25000, timeoutMessage: "비유 생성 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(text);
    if (!parsed.canGenerate || parsed.confidence === 'low') {
      return { canGenerate: false, reason: parsed.reason || '확신도 부족' };
    }
    // Filter out any malformed analogies
    if (parsed.analogies) {
      parsed.analogies = parsed.analogies.filter(a => a && a.title && a.body);
    }
    if (!parsed.analogies?.length) {
      return { canGenerate: false, reason: '유효한 비유를 만들지 못함' };
    }
    return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { canGenerate: false, reason: '응답 파싱 실패' };
  }
}
