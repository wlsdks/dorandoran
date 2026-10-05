import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useDialogLayer } from '@/hooks/useDialogLayer';
import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ThumbsUp, Check, HelpCircle, MessageSquare, ChevronDown, ChevronUp, ShieldAlert, Sparkles } from 'lucide-react';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';
import { getParticipantId, getNickname, getLastSeen, saveLastSeen } from '@/lib/participant';
import { timeAgo } from '@/lib/utils';

const MAX_LENGTH = 200;

const AnswerItem = memo(function AnswerItem({ a, participantId }) {
  const isOwn = a.participantId === participantId;
  const isAi = a.role === 'ai';
  const roleLabel = a.role === 'admin' ? '강사' : a.role === 'staff' ? '스태프' : isAi ? 'AI 조교' : null;

  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{a.nickname}</span>
          {roleLabel && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${
              isAi
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            }`}>
              {isAi && <Sparkles size={8} className="text-indigo-500" />}{roleLabel}
            </span>
          )}
          {isOwn && <span className="text-xs text-slate-400">나</span>}
          <span className="text-xs text-slate-400">{timeAgo(a.timestamp)}</span>
        </div>
        <p className="text-base text-slate-700 dark:text-slate-200 mt-0.5 leading-relaxed">{a.text}</p>
      </div>
    </div>
  );
});

const QuestionCard = memo(function QuestionCard({ q: originalQuestion, participantId, nickname, onUpvote, onPostAnswer, canAnswer, index = 0 }) {
  const { available } = useAIAvailability();
  const visibleAnswers = available ? (originalQuestion.answerList || []) : (originalQuestion.answerList || []).filter(answer => answer.role !== 'ai');
  const q = available ? originalQuestion : { ...originalQuestion, answerList: visibleAnswers, answerCount: visibleAnswers.length, aiAllowed: false, answeredByRole: originalQuestion.answeredByRole === 'ai' ? null : originalQuestion.answeredByRole };
  const [expanded, setExpanded] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [posting, setPosting] = useState(false);
  const hasUpvoted = q.upvotes?.[participantId];
  const isMine = q.participantId === participantId;

  if (q.hidden) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, delay: index * 0.03 }}
        className="rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <ShieldAlert size={14} />
          <p className="text-base">정책상 가려진 질문입니다</p>
        </div>
      </motion.div>
    );
  }

  async function handlePostAnswer() {
    if (!answerText.trim() || posting) return;
    setPosting(true);
    const ok = await onPostAnswer(q.id, answerText.trim(), nickname, participantId);
    if (ok) setAnswerText('');
    setPosting(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={`rounded-xl shadow-sm overflow-hidden ${
        q.answeredByRole
          ? 'ring-1 ring-emerald-200 dark:ring-emerald-800/50'
          : ''
      }`}
    >
      <div className={`p-4 bg-white dark:bg-slate-800 ${isMine && !q.answered ? 'ring-1 ring-slate-300 dark:ring-slate-600' : ''}`}>
        <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
          {q.text}
        </p>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {q.nickname}
            </span>
            {isMine && (
              <span className="text-[10px] font-semibold text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 px-1.5 py-0.5 rounded-md">나</span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">{timeAgo(q.timestamp)}</span>
            {q.answeredByRole && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Check size={10} className="text-emerald-500" />
                {q.answeredByRole === 'staff' ? '스태프 답변' : q.answeredByRole === 'ai' ? 'AI 답변' : '강사 답변'}
              </span>
            )}
            {q.aiAllowed && q.aiSkipped && !q.answeredByRole && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400" title="AI가 확실하지 않아 답변을 보류했습니다 · 강사·스태프 답변을 기다려주세요">
                AI 판단 보류
              </span>
            )}
            {q.aiAllowed && !q.aiSkipped && !q.answeredByRole && (q.answerCount || 0) === 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                <Sparkles size={9} className="animate-pulse text-indigo-500" />
                AI 확인 중
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onUpvote(q.id)}
              aria-label={hasUpvoted ? '추천 취소' : '추천'}
              aria-pressed={!!hasUpvoted}
              className={`min-h-11 min-w-11 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                hasUpvoted
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <ThumbsUp size={18} />
              {q.upvoteCount || 0}
            </motion.button>
          </div>
        </div>

        {/* Answer toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="min-h-11 flex items-center gap-2 mt-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
        >
          <MessageSquare size={18} />
          <span>{q.answerCount > 0 ? `답변 ${q.answerCount}개` : '답변하기'}</span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Answers section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 space-y-2.5">
              {q.answerList?.length > 0 ? (
                q.answerList.map((a) => (
                  <AnswerItem key={a.id} a={a} participantId={participantId} />
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-1">아직 답변이 없습니다</p>
              )}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handlePostAnswer()}
                  placeholder="답변 작성..."
                  maxLength={500}
                  className="min-w-0 min-h-11 flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  onClick={handlePostAnswer}
                  disabled={!answerText.trim() || posting || !canAnswer}
                  className="min-h-11 min-w-11 px-3 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors duration-150"
                  aria-label="답변 보내기"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default memo(function ClassQAPanel({ sessionId, open, onClose, onNewQuestion }) {
  const { studentFeaturesAvailable } = useAIAvailability();
  const { questions, postQuestion, toggleUpvote, postAnswer, canPost, canAnswer, loading } =
    useClassQuestions(sessionId);
  const [inputText, setInputText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [tab, setTab] = useState('all'); // 'all' | 'mine'
  const [aiAllowed, setAiAllowed] = useState(false);
  const inputRef = useRef(null);
  const prevCountRef = useRef(getLastSeen(sessionId, 'qa'));

  // 패널 열릴 때 배경 스크롤 잠금
  const { dialogRef, trapFocus } = useDialogLayer(open, onClose);
  const participantId = getParticipantId();
  const nickname = getNickname();

  useEffect(() => {
    if (loading) return;
    if (prevCountRef.current >= 0 && questions.length > prevCountRef.current && !open && onNewQuestion) {
      onNewQuestion();
    }
    prevCountRef.current = questions.length;
    if (open) saveLastSeen(sessionId, 'qa', questions.length);
  }, [questions.length, loading, open, onNewQuestion, sessionId]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function handlePost() {
    const text = inputText.trim();
    if (!text || !canPost || posting) return;
    setPosting(true);
    setPostError('');
    const ok = await postQuestion(text, nickname, participantId, { aiAllowed: studentFeaturesAvailable && aiAllowed });
    if (ok) setInputText('');
    else setPostError('질문 등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
    setPosting(false);
  }

  function handleUpvote(questionId) {
    toggleUpvote(questionId, participantId);
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="수업 질문" tabIndex={-1} onKeyDown={trapFocus}
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mobile-conversation fixed inset-x-0 bottom-0 top-[10vh] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[420px] sm:h-[600px] bg-slate-50 dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl sm:shadow-2xl z-50 flex flex-col overflow-hidden sm:border sm:border-slate-200 sm:dark:border-slate-700"
          >
            {/* Drag handle (mobile only) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-slate-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  수업 질문
                </span>
                {questions.length > 0 && (
                  <span className="text-xs text-slate-400">{questions.length}개</span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150"
                aria-label="수업 질문 닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-3 pb-0 shrink-0">
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-full">
                {[
                  { key: 'all', label: `전체 질문${questions.length > 0 ? ` (${questions.length})` : ''}` },
                  { key: 'mine', label: `내 질문${questions.filter((q) => q.participantId === participantId).length > 0 ? ` (${questions.filter((q) => q.participantId === participantId).length})` : ''}` },
                ].map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`min-h-11 flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
                      tab === t.key ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Questions list */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 scrollbar-hide">
              {loading && questions.length === 0 && (
                <div className="flex-1 flex items-center justify-center h-full">
                  <span className="text-sm text-slate-300 dark:text-slate-500">불러오는 중...</span>
                </div>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  {(() => {
                    const filtered = tab === 'mine' ? questions.filter((q) => q.participantId === participantId) : questions;
                    return filtered.length === 0 && !loading ? (
                      <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                          {tab === 'mine' ? '내가 올린 질문이 없습니다' : '아직 질문이 없습니다'}
                          <br /><span className="text-xs">수업에 대해 궁금한 점을 질문하세요</span>
                        </p>
                      </div>
                    ) : (
                      filtered.map((q, i) => (
                        <QuestionCard
                          key={q.id}
                          q={q}
                          index={i}
                          participantId={participantId}
                          nickname={nickname}
                          onUpvote={handleUpvote}
                          onPostAnswer={postAnswer}
                          canAnswer={canAnswer}
                        />
                      ))
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* AI toggle */}
            {studentFeaturesAvailable && (
              <div className="px-4 pt-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setAiAllowed((v) => !v)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                    aiAllowed
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} />
                    AI 조교 답변 받기
                  </span>
                  <span className={`w-8 h-4 rounded-full relative transition-colors ${aiAllowed ? 'bg-white/30 dark:bg-slate-900/30' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white dark:bg-slate-100 transition-transform ${aiAllowed ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </span>
                </button>
                {aiAllowed && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                    확실한 경우에만 AI가 답합니다 · 강사·스태프 답변과 함께 표시됩니다
                  </p>
                )}
              </div>
            )}

            {postError && (
              <p className="px-4 pt-2 text-xs text-red-500 dark:text-red-400 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">{postError}</p>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) {
                    e.preventDefault();
                    handlePost();
                  }
                }}
                placeholder="질문을 입력하세요"
                aria-label="수업 질문 입력"
                maxLength={MAX_LENGTH}
                className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white dark:focus:bg-slate-600 transition-colors duration-150"
              />
              <button
                onClick={handlePost}
                disabled={!inputText.trim() || !canPost || posting}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-30 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors duration-150 shrink-0"
                aria-label="질문 보내기"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
});
