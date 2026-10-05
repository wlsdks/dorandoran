import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

export function isAnalyzerReady() {
  return isGeminiConfigured();
}

const PROMPT = `당신은 한국어 강의 현장에서 퀴즈 오답 패턴을 분석하는 교수법 전문가입니다.

[역할]
강사가 퀴즈 정답을 공개한 직후, 학생들이 특정 오답을 많이 고른 이유를 분석하여 강사에게 부가 설명 포인트를 제시합니다.

[절대 원칙 — 교육이므로 환각은 금지]
1. **공개된 표준 지식**(교과서·위키피디아·공식 문서에서 검증 가능한 개념)만 분석합니다.
2. **다음은 반드시 거부**하세요 — canAnalyze: false:
   - 의성어·의태어·조어·무의미한 단어 조합이 선택지로 나오는 경우
   - 학원/회사/강사 내부 은어, 허구의 규칙·프로토콜·약어
   - 고유명사·브랜드명·사람이름이 핵심인데 맥락 모름
   - 선택지 사이 의미 차이를 명확히 설명할 수 없을 때
   - "이게 뭘 묻는 건지" 확신이 안 설 때
3. 추측·상상·창작으로 이유를 지어내지 마세요.
4. "귀여워서", "발음이 좋아서", "느낌이 좋아서" 같은 감각적 추측 금지.
5. "일반적으로", "보통", "~일 수 있습니다" 같은 얼버무림 금지.
6. 강사의 수업 의도나 내부 맥락은 절대 추측하지 않습니다.

[판단 절차]
1. 정답과 오답이 공개된 표준 지식 체계에 속하는가?
2. 각 선택지 간 차이를 한 문장으로 정확히 설명할 수 있는가?
3. 2번이 가능하면 confidence: high/medium로 분석
4. 2번 불가능하면 무조건 canAnalyze: false

[출력 JSON 형식]
- 분석 가능: {
    "canAnalyze": true,
    "confidence": "high" | "medium",
    "topWrongAnswer": "가장 많이 선택된 오답",
    "likelyConfusion": "학생들이 이 오답을 고른 주된 개념 혼동 (1~2문장, 공개 지식 기반)",
    "suggestedExplanation": "강사가 부연 설명할 구체적 포인트 (2~3문장)"
  }
- 분석 불가: { "canAnalyze": false, "reason": "선택지가 내부 은어/고유명사라 일반 지식으로 분석할 수 없음" }

의심스러우면 거부하세요. 틀린 분석보다 "분석 보류"가 교육적으로 훨씬 낫습니다.`;

export async function analyzeWrongAnswers({ questionTitle, options, correctAnswer, voteDistribution }) {
  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  // voteDistribution: { [optionText]: count }
  const wrongOptions = options
    .filter(o => o !== correctAnswer)
    .map(o => `${o}: ${voteDistribution[o] || 0}명`)
    .join(', ');
  const totalVotes = Object.values(voteDistribution).reduce((a, b) => a + b, 0);
  const correctCount = voteDistribution[correctAnswer] || 0;

  const prompt = `[질문]
${questionTitle}

[선택지]
${options.map(o => `- ${o}${o === correctAnswer ? ' (정답)' : ''}`).join('\n')}

[실제 응답 분포]
총 ${totalVotes}명 중 정답 ${correctCount}명
오답: ${wrongOptions}

학생들이 가장 많이 고른 오답의 이유를 분석하고 강사에게 부연 설명 포인트를 제안해주세요. 주제를 잘 모르거나 분석 자신 없으면 canAnalyze:false로 거부하세요.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 20000, timeoutMessage: "분석 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(text);
    // Gate: confidence low or canAnalyze false → treat as refusal
    if (!parsed.canAnalyze || parsed.confidence === 'low') {
      return { canAnalyze: false, reason: parsed.reason || '확신도 부족' };
    }
    return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { canAnalyze: false, reason: '응답 파싱 실패' };
  }
}
