import { getGeminiModel, isGeminiConfigured } from '@/lib/gemini/client';

const MODEL_NAME = 'gemini-2.5-flash-lite';

export function isInsightReady() {
  return isGeminiConfigured();
}

const PROMPT = `당신은 한국어 강의 데이터를 분석하여 강사에게 **다음 수업 개선 인사이트**를 제공하는 교수법 컨설턴트입니다.

[역할]
세션이 끝난 후 강사에게 "오늘 수업이 어땠는지 + 다음 수업에 뭘 할지"를 구체적으로 제안합니다. 데이터 나열이 아니라 **해석과 추천**이 목적.

[절대 원칙 — 환각 금지]
1. 제공된 통계 데이터만 근거로 분석. 상상으로 "학생이 지쳤을 것" 같은 추측 금지.
2. 개별 학생 성격·성향·동기 추측 금지. 닉네임 언급은 순위 기반 사실만.
3. 질문 주제에 대한 전문 판단이 필요하면 "표준 지식" 기반으로만. 내부 은어·조어는 해석 거부.
4. 과장 표현 금지: "엄청난 참여", "훌륭한 수업", "놀라운 결과" 등 금지.
5. 데이터가 빈약하면(참여자 < 3명, 질문 < 2개 등) canAnalyze: false로 거부.
6. "~일 것 같다", "아마도", "추정" 같은 얼버무림은 가능하지만 근거와 함께만.

[분석 포인트]
- 정답률 분포에서 명확한 개념 혼동 지점
- 응답률 낮은 질문 = 참여 유도 실패 or 질문 난이도 문제
- 확신도 vs 정답률 괴리 (확신 높은데 틀린 경우 = 잘못 배움)
- 극심한 상위-하위 점수 격차 = 수업 난이도 불균형
- 워드클라우드/Q&A 응답의 공통 키워드 = 학생 관심사

[출력 JSON 형식]
- 분석 가능: {
    "canAnalyze": true,
    "confidence": "high" | "medium",
    "overallSummary": "오늘 수업 2~3문장 요약 (팩트 + 해석)",
    "keyFindings": [
      { "finding": "핵심 발견 1 (구체적, 데이터 숫자 포함)", "severity": "high" | "medium" | "low" }
    ],
    "nextClassActions": [
      "다음 수업에 구체적으로 할 액션 (3~5분 단위로 쪼갠 실행 가능한 행동)"
    ],
    "participationPattern": "학생 참여 패턴 1~2문장 (선택)",
    "caveats": "분석 한계 (예: '참여자 소규모라 경향 단정 불가')"
  }
- 분석 불가: { "canAnalyze": false, "reason": "데이터 부족/모호한 이유" }

의심스러우면 거부. 애매한 추천으로 강사 혼란시키는 것보다 "분석 불가"가 낫습니다.`;

export async function generateClassInsight({ session, participantCount, insights, topStudent, avgCorrectRate, activityRate }) {
  // Gate: too little data
  const questionCount = insights?.length || 0;
  if (participantCount < 3 || questionCount < 2) {
    return { canAnalyze: false, reason: `참여자 ${participantCount}명 / 질문 ${questionCount}개로 의미 있는 분석 불가` };
  }

  const model = getGeminiModel({
    model: MODEL_NAME,
    systemInstruction: PROMPT,
  });

  // Pack question-by-question data
  const TYPE_LABEL = { choice: '객관식', quiz: '퀴즈', ox: 'OX', wordcloud: '워드클라우드', qna: 'Q&A', scale: '감정온도계', debate: '찬반토론', ranking: '순위', fillinblank: '빈칸', check: '실습체크', imageSlide: '이미지', mysteryBox: '미스터리박스', hintQuiz: '힌트퀴즈', aiJudge: 'AI심사' };
  const questionLines = insights.map((q, i) => {
    const typeLabel = TYPE_LABEL[q.type] || q.type;
    const isAiJudge = q.type === 'aiJudge';
    // aiJudge는 정답 개념이 없으므로 제출 수만 로그
    const unit = isAiJudge ? '제출' : '응답';
    const parts = [`${i + 1}. [${typeLabel}] "${q.title}" — ${unit} ${q.voteCount}/${participantCount}명 (${q.responseRate}%)`];
    if (!isAiJudge && q.hasCorrectAnswer && q.correctRate !== null) {
      parts.push(`정답률 ${q.correctRate}%`);
    }
    if (!isAiJudge && q.highConfidenceRate !== null) {
      parts.push(`확신 높음 ${q.highConfidenceRate}%`);
    }
    return parts.join(', ');
  }).join('\n');

  const prompt = `[수업 데이터]
강의: ${session?.courseName || '알 수 없음'}${session?.roundNumber ? ` · ${session.roundNumber}차` : ''}
참여자: ${participantCount}명
참여율: ${activityRate}%
평균 정답률: ${avgCorrectRate !== null ? avgCorrectRate + '%' : '측정 불가'}
최고점 학생: ${topStudent ? `${topStudent.nickname} (${topStudent.total}점)` : '없음'}

[질문별 통계]
${questionLines}

위 데이터만 근거로 강사에게 "오늘 수업의 인사이트 + 다음 수업에 할 액션"을 구체적으로 제시해주세요. 데이터에 없는 학생 감정·의도·태도는 추측하지 마세요. 질문 주제가 내부 은어로 보이면 해석 거부.`;

  const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }, { timeoutMs: 30000, timeoutMessage: "인사이트 생성 타임아웃" });

  let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(text);
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
