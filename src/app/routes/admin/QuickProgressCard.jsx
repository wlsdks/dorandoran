import { useState, memo } from 'react';
import { Play, Square, Zap, PartyPopper, Check, Trophy, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Button from '@/components/ui/Button';
import { QUIZ_EVENT_PRESETS, isQuizQuestion } from '@/lib/quiz';

function KeyHint({ keys, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
      <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 leading-none">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

export default memo(function QuickProgressCard({
  questionList,
  activeIndex,
  currentEntry,
  nextEntry,
  onActivate,
  onClearActive,
  onReveal,
  onRevealHint,
  onRevealAnswer,
  onSlide,
  onShowLeaderboard,
  onNextEvent,
  speedQuizActive,
  onStartSpeedQuiz,
  onEndSpeedQuiz,
  speedQuizCount,
}) {
  const [nextEvent, setNextEvent] = useState(null);

  function handleActivateNext() {
    if (!nextEntry) return;
    onActivate(nextEntry[0]);
    if (nextEvent) {
      onNextEvent?.(nextEvent);
      setNextEvent(null);
    }
  }

  const currentQ = currentEntry?.[1];
  const isActiveQuiz = currentQ ? isQuizQuestion(currentQ) : false;
  const quizRevealed = isActiveQuiz && currentQ?.revealedAt;
  const quizUnrevealed = isActiveQuiz && !currentQ?.revealedAt;
  const isMysteryOrHint = currentQ && ['mysteryBox', 'hintQuiz'].includes(currentQ?.type);
  const mhRevealed = isMysteryOrHint && currentQ?.revealedAt;
  const mhUnrevealed = isMysteryOrHint && !currentQ?.revealedAt;
  // quiz 외 정답형 질문(choice, ox, fillinblank, ranking 등) 정답 공개 지원
  const hasAnswerType = !isActiveQuiz && !isMysteryOrHint && currentQ?.correctAnswer;
  const answerRevealed = hasAnswerType && currentQ?.revealedAt;
  const answerUnrevealed = hasAnswerType && !currentQ?.revealedAt;
  const canRevealHint = currentQ?.type === 'hintQuiz' && (currentQ?.revealedHints || 0) < (currentQ?.hints || []).length;

  /* Determine primary + secondary CTA based on session state */
  let primaryBtn, secondaryBtn;

  if (!currentEntry) {
    /* No active question */
    primaryBtn = (
      <Button onClick={handleActivateNext} variant="primary" size="md"
        disabled={!nextEntry || speedQuizActive}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Play size={20} />
        {nextEvent && <PartyPopper size={20} />}
        첫 활동 시작
      </Button>
    );
    secondaryBtn = (
      <Button onClick={onClearActive} variant="secondary" size="md" disabled
        className="h-12 py-2.5 text-sm gap-1.5">
        <Square size={20} />
        대기 화면
      </Button>
    );
  } else if (quizUnrevealed) {
    /* Active quiz — waiting for reveal */
    primaryBtn = (
      <Button onClick={() => onReveal?.(currentEntry[0])} variant="primary" size="md"
        disabled={speedQuizActive}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Check size={20} />
        정답 공개
      </Button>
    );
    secondaryBtn = (
      <Button onClick={onClearActive} variant="secondary" size="md" disabled={speedQuizActive}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Square size={20} />
        대기 화면
      </Button>
    );
  } else if (quizRevealed) {
    /* Quiz revealed — show leaderboard or next */
    primaryBtn = (
      <Button onClick={onShowLeaderboard} variant="secondary" size="md"
        disabled={speedQuizActive}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Trophy size={20} />
        리더보드
      </Button>
    );
    secondaryBtn = (
      <Button onClick={handleActivateNext} variant="primary" size="md"
        disabled={!nextEntry || speedQuizActive}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Play size={20} />
        다음 활동
      </Button>
    );
  } else if (mhUnrevealed) {
    /* Mystery Box / Hint Quiz — waiting for reveal */
    primaryBtn = (
      <Button onClick={() => onRevealAnswer?.(currentEntry[0])} variant="primary" size="md"
        className="h-12 py-2.5 text-sm gap-1.5">
        <Eye size={20} />
        정답 공개
      </Button>
    );
    secondaryBtn = canRevealHint ? (
      <Button onClick={() => onRevealHint?.(currentEntry[0])} variant="secondary" size="md"
        className="h-12 py-2.5 text-sm gap-1.5">
        <ChevronRight size={20} />
        힌트 공개 ({currentQ.revealedHints || 0}/{(currentQ.hints || []).length})
      </Button>
    ) : (
      <Button onClick={onClearActive} variant="secondary" size="md"
        className="h-12 py-2.5 text-sm gap-1.5">
        <Square size={20} />
        대기 화면
      </Button>
    );
  } else if (mhRevealed) {
    /* Mystery Box / Hint Quiz revealed — next question */
    primaryBtn = (
      <Button onClick={handleActivateNext} variant="primary" size="md"
        disabled={!nextEntry}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Play size={20} />
        다음 활동
      </Button>
    );
    secondaryBtn = (
      <Button onClick={onClearActive} variant="secondary" size="md"
        className="h-12 py-2.5 text-sm gap-1.5">
        <Square size={20} />
        대기 화면
      </Button>
    );
  } else if (answerUnrevealed) {
    /* 정답형 질문 (choice, ox, fillinblank, ranking) — reveal */
    primaryBtn = (
      <Button onClick={() => onRevealAnswer?.(currentEntry[0])} variant="primary" size="md"
        className="h-12 py-2.5 text-sm gap-1.5">
        <Eye size={20} />
        정답 공개
      </Button>
    );
    secondaryBtn = (
      <Button onClick={onClearActive} variant="secondary" size="md"
        className="h-12 py-2.5 text-sm gap-1.5">
        <Square size={20} />
        대기 화면
      </Button>
    );
  } else if (answerRevealed) {
    /* 정답 공개됨 — next */
    primaryBtn = (
      <Button onClick={handleActivateNext} variant="primary" size="md"
        disabled={!nextEntry}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Play size={20} />
        다음 활동
      </Button>
    );
    secondaryBtn = (
      <Button onClick={onClearActive} variant="secondary" size="md"
        className="h-12 py-2.5 text-sm gap-1.5">
        <Square size={20} />
        대기 화면
      </Button>
    );
  } else {
    /* Active non-quiz (poll, word cloud, etc.) */
    primaryBtn = (
      <Button onClick={handleActivateNext} variant="primary" size="md"
        disabled={!nextEntry || speedQuizActive}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Play size={20} />
        다음 활동
        {nextEvent && <PartyPopper size={20} />}
      </Button>
    );
    secondaryBtn = (
      <Button onClick={onClearActive} variant="secondary" size="md" disabled={speedQuizActive}
        className="h-12 py-2.5 text-sm gap-1.5">
        <Square size={20} />
        대기 화면
      </Button>
    );
  }

  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <div className="space-y-1.5">
        <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold tracking-tight">지금 수업</p>
        <p className="text-slate-900 dark:text-slate-100 text-base font-semibold">
          {currentEntry
            ? `${activeIndex + 1}/${questionList.length}번째 활동 진행 중`
            : `질문 ${questionList.length}개 준비됨`}
        </p>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-2">
          {currentEntry
            ? currentEntry[1].title
            : '아직 활성화된 질문이 없습니다. 첫 질문을 바로 시작할 수 있습니다.'}
        </p>
        {currentQ?.type === 'quiz' && (
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            {quizRevealed
              ? '정답 공개가 완료되었습니다. 리더보드로 이어서 보여줄 수 있습니다.'
              : '정답 공개 전까지 답안을 모으는 중입니다.'}
          </p>
        )}
        {isMysteryOrHint && (
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            {mhRevealed
              ? '정답이 공개되었습니다.'
              : currentQ?.type === 'hintQuiz'
                ? `힌트 ${currentQ.revealedHints || 0}/${(currentQ.hints || []).length}개 공개됨. 학생 답변을 모으는 중입니다.`
                : '학생 답변을 모으는 중입니다. 정답을 공개하세요.'}
          </p>
        )}
      </div>

      {/* 이미지 슬라이드 이동 — 발표모드에 안 들어가도 대시보드에서 넘길 수 있게 */}
      {currentQ?.type === 'imageSlide' && (currentQ.slideImages?.length || 0) > 0 && (() => {
        const cur = currentQ.currentSlide || 0;
        const total = currentQ.slideImages.length;
        return (
          <div className="flex items-center gap-2">
            <Button onClick={() => onSlide?.(currentEntry[0], cur - 1)} variant="secondary" size="sm"
              disabled={cur <= 0 || speedQuizActive} className="flex-1 h-12">
              <ChevronLeft size={14} /> 이전
            </Button>
            <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400 shrink-0 px-1">
              {cur + 1} / {total}
            </span>
            <Button onClick={() => cur >= total - 1 ? handleActivateNext() : onSlide?.(currentEntry[0], cur + 1)} variant="primary" size="sm"
              disabled={speedQuizActive || (cur >= total - 1 && !nextEntry)} className="flex-1 h-12">
              {cur >= total - 1 ? '다음 활동' : '다음 슬라이드'} <ChevronRight size={14} />
            </Button>
          </div>
        );
      })()}

      {/* Context-aware CTA buttons — taller touch targets on mobile */}
      <div className={`grid ${currentQ?.type === 'imageSlide' ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
        {currentQ?.type === 'imageSlide' ? null : quizRevealed ? secondaryBtn : primaryBtn}
        {quizRevealed ? primaryBtn : secondaryBtn}
      </div>

      {activeIndex > 0 && (
        <Button onClick={() => onActivate(questionList[activeIndex - 1][0])} variant="secondary" size="sm"
          disabled={speedQuizActive} className="h-12 w-full">
          <ChevronLeft size={20} /> 이전 활동
        </Button>
      )}

      {nextEntry && currentEntry && !quizUnrevealed && !quizRevealed && (
        <p className="text-slate-400 text-xs">
          다음 예정: <span className="text-slate-600 dark:text-slate-300">{nextEntry[1].title}</span>
        </p>
      )}

      {/* Event toggle — shown when next question is quiz */}
      {nextEntry && isQuizQuestion(nextEntry[1]) && (
        <details className="rounded-lg bg-slate-50 dark:bg-slate-700/30">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
            다음 퀴즈 이벤트 {nextEvent ? `· ${nextEvent.label}` : '(선택)'}
          </summary>
          <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {QUIZ_EVENT_PRESETS.map((preset) => {
            const isSelected = nextEvent?.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setNextEvent(isSelected ? null : preset)}
                className={`min-h-11 px-2.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          </div>
        </details>
      )}

      {/* Speed Quiz toggle */}
      {speedQuizCount >= 2 && (
        <details open={speedQuizActive || undefined} className="rounded-lg bg-slate-50 dark:bg-slate-700/30">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">스피드 퀴즈 {speedQuizActive ? '진행 중' : '(선택)'}</summary>
          <div className="px-3 pb-3">
          {speedQuizActive ? (
            <button
              onClick={onEndSpeedQuiz}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium transition-colors duration-150 active:scale-[0.97]"
            >
              <span className="flex items-center gap-2">
                <Zap size={14} />
                스피드 퀴즈 진행 중
              </span>
              <span className="text-xs text-white/50 dark:text-slate-900/50">탭하여 중단</span>
            </button>
          ) : (
            <button
              onClick={onStartSpeedQuiz}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors duration-150 active:scale-[0.97]"
            >
              <span className="flex items-center gap-2">
                <Zap size={14} className="text-slate-500" />
                스피드 퀴즈
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{speedQuizCount}문제 · 10초씩</span>
            </button>
          )}
          </div>
        </details>
      )}

      {/* Keyboard shortcut hints — hidden on mobile (no keyboard) */}
      <div className="flex flex-wrap gap-1.5 pt-1 max-sm:hidden">
        <KeyHint keys="← →" label="질문 이동" />
        <KeyHint keys="Space" label="다음" />
        <KeyHint keys="Esc" label="대기" />
        {currentQ?.type === 'quiz' && !currentQ.revealedAt && (
          <KeyHint keys="R" label="정답 공개" />
        )}
        {currentQ?.type === 'quiz' && currentQ.revealedAt && (
          <KeyHint keys="L" label="리더보드" />
        )}
      </div>
    </div>
  );
});
