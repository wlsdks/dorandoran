import { useAIAvailability } from '@/hooks/useAIAvailability';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { memo, useMemo } from 'react';
import BarChart from './BarChart';
import OXBattle from './OXBattle';
import WordCloud from './WordCloud';
import QACards from './QACards';
import SubjectiveResults from './SubjectiveResults';
import AISummaryBanner from './AISummaryBanner';
import WrongAnswerAnalysis from './WrongAnswerAnalysis';
import AnalogyHelper from './AnalogyHelper';
import ScaleChart from './ScaleChart';
import DebateChart from './DebateChart';
import RankingChart from './RankingChart';
import FillBlankChart from './FillBlankChart';
import ShortAnswerChart from './ShortAnswerChart';
import ClassroomResponseFeed from './ClassroomResponseFeed';
import CheckProgress from './CheckProgress';
import MysteryBoxPresenter from './MysteryBoxPresenter';
import HintQuizPresenter from './HintQuizPresenter';
import CorrectAnswerRanking from './CorrectAnswerRanking';
import ImageSlidePresenter from './ImageSlidePresenter';
import WebEmbedPresenter from './WebEmbedPresenter';
import BetDistribution from './BetDistribution';
import ConfidenceStats from './ConfidenceStats';
import AiJudgeViz from '@/features/ai-judge/components/AiJudgeViz';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import QuizEventBanner from '@/components/ui/QuizEventBanner';
import { isQuizQuestion } from '@/lib/quiz';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { lazy, Suspense, useState, useEffect } from 'react';

const ConfettiBurst = lazy(() => import('@/components/ui/ConfettiBurst'));
import { TYPE_LABELS } from '@/lib/question-types';

export default memo(function VizRenderer({ sessionId, session, isAdmin = false, isPresenter = false }) {
  const { available } = useAIAvailability();
  const currentQId = session?.currentQuestion;
  const currentMode = session?.currentMode;
  const currentQuestion = session?.questions?.[currentQId];
  const options = useMemo(() => currentQuestion?.options || [], [currentQuestion?.options]);

  // 폭죽 — 여러 위치에서 동시에 + 시차
  const [confettiWave, setConfettiWave] = useState(0);
  const revealedAt = currentQuestion?.revealedAt;
  useEffect(() => {
    if (!revealedAt) { setConfettiWave(0); return; }
    setConfettiWave(1);
    const t2 = setTimeout(() => setConfettiWave(0), 1400);
    return () => { clearTimeout(t2); };
  }, [revealedAt]);

  if (!['poll', 'quiz'].includes(currentMode) || !currentQId) {
    const hasQuestions = session?.questions && Object.keys(session.questions).length > 0;
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          title={hasQuestions ? '질문이 준비되어 있습니다' : '아직 질문이 없습니다'}
          description={hasQuestions
            ? '질문 목록에서 질문을 활성화하면 여기에 실시간 결과가 표시됩니다'
            : '+ 추가 버튼으로 첫 질문을 만들어보세요'}
          steps={hasQuestions
            ? ['질문 목록에서 질문을 선택하세요', '재생 버튼으로 활성화하세요', '학생 응답이 실시간으로 나타납니다']
            : ['+ 추가 버튼으로 질문을 만드세요', '객관식, O/X, 워드클라우드 등 선택', '질문을 활성화하면 수업이 시작됩니다']}
          mascotSize="lg"
          mood="waiting"
          className="py-8"
        />
      </div>
    );
  }

  const question = currentQuestion;
  if (!question) return null;
  if (isPresenter && question.type === 'aiJudge' && !available) return <div className="text-center space-y-5">
    <DoranDoranMascot size={160} mood="waiting" />
    <h2 className="text-3xl lg:text-4xl font-semibold text-slate-100">다음 활동을 준비하고 있어요</h2>
    <p className="text-xl text-slate-300">잠시 후 함께 시작해요</p>
  </div>;
  if (isPresenter && question.type === 'imageSlide') return <ImageSlidePresenter presenter images={question.slideImages || []}
    currentSlide={question.currentSlide || 0} onSlideChange={isAdmin ? index => update(ref(db, `sessions/${sessionId}/questions/${currentQId}`), { currentSlide: index }) : undefined} />;


  const isQA = question.type === 'qna';
  const isSubjective = question.type === 'subjective';
  const isFeed = isQA || isSubjective; // 피드형 레이아웃(자체 헤더 보유) — hero 제목/비유 숨김
  const isEnded = session?.status === 'ended' || session?.status === 'reviewing';
  const hasCorrectAnswer = Boolean(question.correctAnswer);
  const answerRevealed = Boolean(question.revealedAt) || isEnded;
  const onDisplayPageChange = isAdmin && isPresenter ? page => update(ref(db, `sessions/${sessionId}/questions/${currentQId}`), { displayPage: page }) : undefined;
  const framed = isPresenter && !['imageSlide', 'webEmbed', 'aiJudge'].includes(question.type);

  return (
    <div className={`flex flex-col w-full h-full overflow-y-auto ${isFeed ? 'pt-4' : isPresenter ? 'justify-center gap-5 py-3' : 'justify-center gap-6 py-4'} ${framed ? 'paper-surface' : ''} relative`}>
      {confettiWave > 0 && hasCorrectAnswer && <Suspense fallback={null}>
        <div className="absolute right-10 top-12 pointer-events-none z-10 scale-75"><ConfettiBurst key={revealedAt} /></div>
      </Suspense>}

      {/* Header — hidden for Q&A, or when hideTitle is set.
          aiJudge + isPresenter 조합은 상단 공간이 커서 그리드 잘림 → 제목/간격 축소. */}
      {!isFeed && !question.hideTitle && (() => {
        const compact = isPresenter && question.type === 'aiJudge';
        return (
          <div className={`text-center self-center ${compact ? 'space-y-1' : 'space-y-2'}`}>
            <Badge variant="primary">{TYPE_LABELS[question.type] || question.type}</Badge>
            <h2 className={`${compact ? 'text-xl' : isPresenter ? 'classroom-question-title' : 'text-3xl'} font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight`}>{question.title}</h2>
            {hasCorrectAnswer && isQuizQuestion(question) && (!answerRevealed || options.length > 6 || !['choice','quiz','ox'].includes(question.type)) && (
              <p className={isPresenter ? "text-slate-200 text-xl lg:text-2xl" : "text-slate-400 text-sm"}>
                {answerRevealed ? <span className="inline-block rounded-xl bg-indigo-100 text-indigo-950 px-5 py-2 font-bold">정답 · {question.correctAnswer}</span> : '휴대폰에서 답을 골라주세요'}
              </p>
            )}
            {question.imageUrl && (
              <img src={question.imageUrl} alt={question.title || '질문 이미지'} className="mt-3 max-h-[28dvh] max-w-full rounded-xl object-contain mx-auto" />
            )}
          </div>
        );
      })()}

      {isQuizQuestion(question) && question.event && (
        <div className="w-full max-w-xl self-center px-8">
          <QuizEventBanner event={question.event} state={answerRevealed ? 'result' : 'active'} />
        </div>
      )}

      {/* AnalogyHelper — 발표 모드(전자칠판)에선 강사 보조 UI라 숨김. 그리드 공간 확보. */}
      {isAdmin && !isFeed && !isPresenter && (
        <AnalogyHelper
          questionTitle={question.title}
          options={options}
          correctAnswer={question.correctAnswer}
        />
      )}

      {/* Visualization */}
      <ErrorBoundary scope="visualization" fullPage={false}>
        <div data-kind={question.type} className={`${isFeed ? 'flex-1 overflow-y-auto px-4 py-3' : 'w-full'} ${isPresenter ? 'classroom-visualization' : ''}`}>
          {question.type === 'choice' && (
            <>
              <BarChart
                sessionId={sessionId}
                questionId={currentQId}
                options={options}
                presenter={isPresenter}
                page={question.displayPage || 0}
                onPageChange={isAdmin && isPresenter ? page => update(ref(db, `sessions/${sessionId}/questions/${currentQId}`), { displayPage: page }) : undefined}
                correctValue={question.correctAnswer}
                revealed={hasCorrectAnswer && answerRevealed}
              />
              {isAdmin && !isPresenter && hasCorrectAnswer && answerRevealed && (
                <WrongAnswerAnalysis
                  sessionId={sessionId}
                  questionId={currentQId}
                  questionTitle={question.title}
                  options={options}
                  correctAnswer={question.correctAnswer}
                />
              )}
            </>
          )}
          {question.type === 'quiz' && (
            <>
              <BarChart
                sessionId={sessionId}
                questionId={currentQId}
                options={options}
                presenter={isPresenter}
                page={question.displayPage || 0}
                onPageChange={isAdmin && isPresenter ? page => update(ref(db, `sessions/${sessionId}/questions/${currentQId}`), { displayPage: page }) : undefined}
                correctValue={question.correctAnswer}
                revealed={answerRevealed}
              />
              <ConfidenceStats sessionId={sessionId} questionId={currentQId} />
              {question.betting && (
                <BetDistribution sessionId={sessionId} questionId={currentQId} />
              )}
              {isAdmin && !isPresenter && answerRevealed && (
                <WrongAnswerAnalysis
                  sessionId={sessionId}
                  questionId={currentQId}
                  questionTitle={question.title}
                  options={options}
                  correctAnswer={question.correctAnswer}
                />
              )}
            </>
          )}
          {question.type === 'ox' && (
            <OXBattle
              sessionId={sessionId}
              questionId={currentQId}
              correctValue={question.correctAnswer}
              revealed={hasCorrectAnswer && answerRevealed}
            />
          )}
          {question.type === 'wordcloud' && (
            <>
              {isAdmin && !isPresenter && <AISummaryBanner sessionId={sessionId} questionId={currentQId} questionTitle={question.title} questionType="wordcloud" />}
              <WordCloud sessionId={sessionId} questionId={currentQId} presenter={isPresenter} />
            </>
          )}
          {question.type === 'scale' && <ScaleChart sessionId={sessionId} questionId={currentQId} minLabel={question.minLabel} maxLabel={question.maxLabel} />}
          {question.type === 'debate' && <DebateChart sessionId={sessionId} questionId={currentQId} presenter={isPresenter} readOnly={isPresenter && !isAdmin} page={question.displayPage || 0} onPageChange={onDisplayPageChange} />}
          {question.type === 'ranking' && <RankingChart sessionId={sessionId} questionId={currentQId} items={options} revealed={answerRevealed || !isPresenter} />}
          {question.type === 'fillinblank' && (
            <FillBlankChart presenter={isPresenter}
              sessionId={sessionId}
              questionId={currentQId}
              title={question.title}
              correctAnswer={question.correctAnswer}
              revealed={answerRevealed}
            />
          )}
          {question.type === 'shortAnswer' && (
            <ShortAnswerChart presenter={isPresenter}
              sessionId={sessionId}
              questionId={currentQId}
              correctAnswer={question.correctAnswer}
              revealed={answerRevealed}
            />
          )}
          {question.type === 'check' && <CheckProgress sessionId={sessionId} questionId={currentQId} />}
          {question.type === 'imageSlide' && (
            <ImageSlidePresenter
                presenter={isPresenter}
              images={question.slideImages || []}
              currentSlide={question.currentSlide || 0}
              onSlideChange={isAdmin ? (idx) => update(ref(db, `sessions/${sessionId}/questions/${currentQId}`), { currentSlide: idx }) : undefined}
            />
          )}
          {question.type === 'webEmbed' && (
            <WebEmbedPresenter url={question.embedUrl} presenter={isPresenter} title={question.title} />
          )}
          {question.type === 'mysteryBox' && (
            <>
              <MysteryBoxPresenter
                sessionId={sessionId}
                questionId={currentQId}
                question={question}
                revealed={answerRevealed}
              />
              {answerRevealed && (
                <CorrectAnswerRanking presenter={isPresenter}
                  sessionId={sessionId}
                  questionId={currentQId}
                  correctAnswer={question.correctAnswer}
                />
              )}
            </>
          )}
          {question.type === 'hintQuiz' && (
            <>
              <HintQuizPresenter
                sessionId={sessionId}
                questionId={currentQId}
                question={question}
                revealed={answerRevealed}
              />
              {answerRevealed && (
                <CorrectAnswerRanking presenter={isPresenter}
                  sessionId={sessionId}
                  questionId={currentQId}
                  correctAnswer={question.correctAnswer}
                  acceptableAnswers={question.acceptableAnswers}
                />
              )}
            </>
          )}
          {isQA && (
            <>
              {isAdmin && !isPresenter && <AISummaryBanner sessionId={sessionId} questionId={currentQId} questionTitle={question.title} questionType="qna" />}
              {isPresenter ? <ClassroomResponseFeed sessionId={sessionId} questionId={currentQId} question={question} onPageChange={onDisplayPageChange} /> : <QACards sessionId={sessionId} questionId={currentQId} title={question.title} />}
            </>
          )}
          {isSubjective && (
            isPresenter ? <ClassroomResponseFeed sessionId={sessionId} questionId={currentQId} question={question} onPageChange={onDisplayPageChange} /> : <SubjectiveResults sessionId={sessionId} questionId={currentQId} question={question} isAdmin={isAdmin} />
          )}
          {question.type === 'aiJudge' && (
            <AiJudgeViz
              sessionId={sessionId}
              questionId={currentQId}
              isAdmin={isAdmin}
              isPresenter={isPresenter}
            />
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
});
