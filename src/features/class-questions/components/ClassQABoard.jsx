import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';
import { getParticipantId, getNickname } from '@/lib/participant';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import QuestionCard from './QuestionCard';

/**
 * Q&A Board — full-screen view for class questions + answers.
 * Desktop: 2-column grid. Mobile: single-column feed.
 * Tabs: 수업 중 / 사후 질문.
 *
 * Used in: PresentationView, LivePage, and student WaitingPage (via mode).
 */
export default function ClassQABoard({ sessionId, showInput = true, role, isAdmin = false, readOnly = false, presenter = false }) {
  const {
    questions, unansweredCount, postQuestion, toggleUpvote, postAnswer, toggleAnswerUpvote, toggleHidden, canPost,
  } = useClassQuestions(sessionId);

  const displayOnly = readOnly || role === 'viewer';
  const [tab, setTab] = useState('all');
  const [inputText, setInputText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [postError, setPostError] = useState('');
  const pid = getParticipantId();
  const nickname = getNickname() || '익명';
  const displayName = anonymous ? '익명' : nickname;
  // 강사/스태프 화면(발표모드·전자칠판)의 답변 명의 — localStorage 참가자 닉네임이
  // 그대로 붙으면 강사 답변이 학생 답변처럼 보임
  const answererName = role === 'admin' ? '강사' : role === 'staff' ? '스태프' : nickname;

  const filtered = useMemo(() => {
    const availableQuestions = displayOnly ? questions.filter(question => !question.hidden) : questions;
    const base = !displayOnly && tab === 'unanswered' ? availableQuestions.filter((q) => !q.answered) : availableQuestions;
    // Q&A 보드: 강사/스태프 답변 완료 → 상단, 나머지 → upvote 순
    return [...base].sort((a, b) => {
      const aOfficial = a.answeredByRole ? 1 : 0;
      const bOfficial = b.answeredByRole ? 1 : 0;
      if (aOfficial !== bOfficial) return bOfficial - aOfficial;
      return b.upvoteCount - a.upvoteCount || (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [questions, tab, displayOnly]);

  const [displayPage, setDisplayPage] = useState(0);
  const displayPageSize = filtered.some(question => (question.text || '').length > 110 || question.answerList?.some(answer => ['admin', 'staff'].includes(answer.role) && (answer.text || '').length > 160)) ? 1 : 3;
  const displayPages = Math.max(1, Math.ceil(filtered.length / displayPageSize));
  useEffect(() => {
    if (!presenter || displayPages < 2) return;
    const timer = setInterval(() => setDisplayPage(page => (page + 1) % displayPages), 12000);
    return () => clearInterval(timer);
  }, [presenter, displayPages]);

  const handlePostQuestion = useCallback(async () => {
    const trimmed = inputText.trim();
    if (displayOnly || !trimmed) return;
    setPostError('');
    const success = await postQuestion(trimmed, displayName, anonymous ? '' : pid);
    if (success) setInputText('');
    else setPostError('질문 등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }, [inputText, postQuestion, displayName, anonymous, pid, displayOnly]);

  if (presenter && displayOnly) {
    const offset = (displayPage % displayPages) * displayPageSize;
    return <section className="paper-surface max-w-[1100px] space-y-6" aria-label="수업 질문 화면">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="classroom-question-title font-bold !mx-0">함께 나눈 질문</h2>
        <p className="text-xl text-slate-300 shrink-0">{filtered.length}개 질문</p>
      </div>
      {filtered.length === 0 ? <div className="py-8 space-y-5 text-center">
        <DoranDoranMascot size="lg" mood="waiting" />
        <p className="text-3xl font-semibold text-slate-100">궁금한 점을 남겨주세요</p>
        <p className="text-2xl text-slate-300">휴대폰에서 보낸 질문을 함께 살펴봅니다</p>
      </div> : <div className="space-y-4">{filtered.slice(offset, offset + displayPageSize).map(question => {
        const official = question.answerList?.find(answer => answer.role === 'admin' || answer.role === 'staff');
        return <article key={question.id} className="rounded-xl bg-slate-700/50 p-5 space-y-2">
          <div className="flex justify-between gap-4 text-lg text-slate-300"><span>{question.nickname || '익명'}</span><span className="shrink-0">공감 {question.upvoteCount}</span></div>
          <p className="text-2xl md:text-[28px] font-medium text-slate-100 leading-snug break-words">{question.text}</p>
          {official && <p className="text-2xl leading-snug text-indigo-200 break-words"><span className="font-bold">강사 답변 · </span>{official.text}</p>}
        </article>;
      })}</div>}
      {displayPages > 1 && <p className="text-center text-lg text-slate-300">질문 {displayPage % displayPages + 1} / {displayPages} · 12초마다 다음 질문</p>}
    </section>;
  }

  if (questions.length === 0 && (!showInput || displayOnly)) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <EmptyState
          title="아직 질문이 없습니다"
          description="학생들이 질문을 보내면 여기에 표시됩니다"
          mascotSize="md"
          mood="waiting"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto" onClick={(e) => e.stopPropagation()}>
      {/* Header + Tabs */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Q&A 보드
          {questions.length > 0 && (
            <span className="ml-2 text-lg font-normal text-slate-400 dark:text-slate-500">{questions.length}개</span>
          )}
        </h2>
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {[
            { key: 'all', label: '전체', count: questions.length },
            { key: 'unanswered', label: '미답변', count: unansweredCount },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.label}{t.count > 0 ? ` ${t.count}` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Question input */}
      {showInput && !displayOnly && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 space-y-2"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handlePostQuestion()}
              placeholder="궁금한 점을 자유롭게 질문하세요"
              maxLength={200}
              className="flex-1 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
            />
            <Button
              onClick={handlePostQuestion}
              disabled={!inputText.trim() || !canPost}
              variant="primary"
              size="md"
            >
              <Send size={16} />
            </Button>
          </div>
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setAnonymous(!anonymous)}
              className={`flex items-center gap-1.5 text-sm transition-colors duration-150 ${
                anonymous ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400'
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors duration-150 ${
                anonymous ? 'bg-slate-900 border-slate-900 dark:bg-slate-100 dark:border-slate-100' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {anonymous && <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white dark:text-slate-900"><path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              익명으로 질문
            </button>
            {!canPost && (
              <span className="text-sm text-slate-400 dark:text-slate-500">잠시 후 다시 질문할 수 있어요</span>
            )}
          </div>
          {postError && (
            <p className="text-sm text-red-500 dark:text-red-400 px-1">{postError}</p>
          )}
        </motion.div>
      )}

      {/* Questions grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">
            {tab === 'unanswered' ? '미답변 질문이 없습니다' : '아직 질문이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pb-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                pid={pid}
                nickname={answererName}
                role={role}
                isAdmin={isAdmin}
                sessionId={sessionId}
                onUpvote={toggleUpvote}
                onPostAnswer={postAnswer}
                onAnswerUpvote={toggleAnswerUpvote}
                onToggleHidden={isAdmin ? toggleHidden : undefined}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

