import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

export function isGeneratorReady() {
  return isGeminiConfigured();
}

const SUPPORTED_TYPES = ['choice', 'ox', 'wordcloud', 'scale'];

const PROMPT = `당신은 한국어 워크숍/강의 진행자를 돕는 AI 조교입니다. 강사가 수업 중 즉흥적으로 사용할 수 있는 학생 참여 질문을 만듭니다.

[사용 가능한 질문 유형]
- "choice": 객관식 (2~5개 선택지, 정답 없음 — 의견/투표 수집용)
- "ox": O/X 질문 (정답 O 또는 X)
- "wordcloud": 한 단어~짧은 구로 답하는 자유 응답
- "scale": 5점 척도 (매우 그렇다~전혀 아니다)

[품질 기준]
- 질문은 짧고 명확하게 (30자 내외)
- 학생이 3초 안에 이해할 수 있어야 함
- 수업 흐름에 자연스럽게 녹아드는 질문
- 유형을 섞어서 다양성 확보

반드시 아래 JSON 형식으로만 응답하세요:
{
  "questions": [
    { "type": "choice", "title": "...", "options": ["선택지1", "선택지2", "선택지3"], "correctAnswer": null },
    { "type": "ox", "title": "...", "correctAnswer": "O" },
    { "type": "wordcloud", "title": "..." },
    { "type": "scale", "title": "..." }
  ]
}

- choice에서 정답이 있는 경우만 correctAnswer 필드 채우기 (없으면 null)
- ox는 반드시 correctAnswer="O" 또는 "X"
- options는 choice에만 포함`;

export async function generateQuestions({ topic, count = 4 }) {
  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  const prompt = `[주제]
${topic}

[요청]
위 주제로 ${count}개의 참여 질문을 만들어주세요. 유형을 섞어서 다양하게 구성해주세요.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 30000, timeoutMessage: "질문 생성 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('질문 파싱 실패');
    parsed = JSON.parse(match[0]);
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('질문 배열이 없습니다.');
  }

  // Validate & clean
  return parsed.questions
    .filter((q) => q && SUPPORTED_TYPES.includes(q.type) && typeof q.title === 'string' && q.title.trim())
    .map((q) => {
      const base = { type: q.type, title: q.title.trim() };
      if (q.type === 'choice') {
        const opts = Array.isArray(q.options) ? q.options.map(String).filter(o => o.trim()) : [];
        if (opts.length < 2) return null;
        base.options = opts;
        if (q.correctAnswer && opts.includes(q.correctAnswer)) {
          base.correctAnswer = q.correctAnswer;
        }
      }
      if (q.type === 'ox') {
        base.correctAnswer = q.correctAnswer === 'X' ? 'X' : 'O';
      }
      return base;
    })
    .filter(Boolean);
}
