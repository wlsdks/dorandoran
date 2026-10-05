import { QUIZ_DEFAULTS, BET_OPTIONS, getQuizReward, normalizeQuizEvent } from '@/lib/quiz';
import { quizComboMultiplier } from '@/lib/quiz-awards';

/** Read-only explanation of the same rules used by quiz-awards; no score writes. */
export default function QuizScoreGuide({ question, vote, points, streak = 0, isSpeedQuiz = false }) {
  const quiz = question?.type === 'quiz' ? question : null;
  const base = quiz?.points ?? QUIZ_DEFAULTS.points;
  const maxSpeed = quiz?.maxSpeedBonus ?? QUIZ_DEFAULTS.maxSpeedBonus;
  const windowSeconds = (quiz?.speedWindowMs ?? QUIZ_DEFAULTS.speedWindowMs) / 1000;
  const event = normalizeQuizEvent(quiz?.event);
  const eventMultiplier = event?.pointMultiplier ?? 1;
  const reward = quiz && vote && quiz.revealedAt ? getQuizReward(quiz, vote) : null;
  const plainReward = reward?.isCorrect ? getQuizReward({ ...quiz, event: null, betting: false }, vote) : null;
  const speedBonus = plainReward ? plainReward.points - base : null;
  const speedRound = isSpeedQuiz || Boolean(quiz?.speedQuizRound > 0 && quiz.speedQuizRound === quiz.activatedAt);
  const combo = speedRound && reward?.isCorrect ? quizComboMultiplier(streak) : 1;
  const signed = (number) => `${number > 0 ? '+' : ''}${number}`;

  return <div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300 [word-break:keep-all] [overflow-wrap:anywhere]">
    {quiz && <p className="font-medium text-slate-800 dark:text-slate-100">{quiz.title}</p>}
    {reward && Number.isFinite(points) && <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-4 py-3 space-y-1">
      <p className="font-semibold text-slate-900 dark:text-slate-100">이번 문제 반영: {signed(points)}점</p>
      {reward.isCorrect ? <p>기본 {base}점 + 속도 {speedBonus}점 → 이벤트 {eventMultiplier}배 → 베팅 {reward.bet}배{speedRound ? ` → 연속 정답 ${combo}배` : ''}</p> : <p>{reward.bet > 1 ? `${reward.bet}배 베팅의 오답 감점이 적용됐어요.` : '안전 선택은 오답이어도 감점이 없어요.'}</p>}
    </div>}
    <dl className="space-y-3">
      <div><dt className="font-semibold text-slate-800 dark:text-slate-100">정답 기본 점수</dt><dd>{base}점{!quiz && '이 기본값이며, 강사 설정에 따라 달라질 수 있어요.'}</dd></div>
      <div><dt className="font-semibold text-slate-800 dark:text-slate-100">속도 보너스</dt><dd>{maxSpeed > 0 ? `${windowSeconds}초 안에 빨리 답할수록 최대 ${maxSpeed}점이 더해져요. 시간이 지날수록 줄고, ${windowSeconds}초부터는 0점이에요.` : '이 문제는 속도 보너스가 없어요.'}</dd></div>
      <div><dt className="font-semibold text-slate-800 dark:text-slate-100">이벤트</dt><dd>{eventMultiplier > 1 ? `이 문제는 기본 점수와 속도 보너스의 합계에 ${eventMultiplier}배를 적용해요.` : quiz ? '이 문제는 이벤트 배수 없이 계산돼요.' : '2배 점수 이벤트가 켜지면 기본 점수와 속도 보너스의 합계가 2배가 돼요.'}</dd></div>
      <div><dt className="font-semibold text-slate-800 dark:text-slate-100">베팅과 오답</dt><dd>{quiz && !quiz.betting ? '이 문제는 베팅이 꺼져 있어요. 오답은 0점이며 감점이 없어요.' : <>{BET_OPTIONS.map((option) => `${option.label} ${option.multiplier}배: 오답 ${option.penalty ? `−${option.penalty}` : 0}점`).join(' · ')}. 정답이면 선택한 배수를 적용하고, 오답 감점에는 이벤트 배수가 적용되지 않아요.</>}</dd></div>
      <div><dt className="font-semibold text-slate-800 dark:text-slate-100">스피드 퀴즈 연속 정답</dt><dd>스피드 퀴즈에서 3~4연속 정답은 {quizComboMultiplier(3)}배, 5연속부터는 {quizComboMultiplier(5)}배를 마지막에 더 적용해요. 일반 퀴즈에는 이 배수가 없고, 오답이면 연속 정답이 끊겨요.</dd></div>
    </dl>
    <p className="text-xs text-slate-500 dark:text-slate-400">정답 공개 후 반영된 문제 점수가 총점에 누적돼요. 배수를 적용한 점수는 반올림됩니다.</p>
  </div>;
}
