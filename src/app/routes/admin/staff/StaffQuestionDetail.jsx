import { useState, useMemo, useCallback, memo } from 'react';
import { ref, push, update, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '@/lib/motion';
import { MessageCircle, HelpCircle, ThumbsUp, Radio, Send, MessageSquare } from 'lucide-react';
import { QUESTION_TYPE_MAP } from '@/lib/question-types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StaffDMChat from '@/features/dm/components/StaffDMChat';
import { useStaffDMs } from '@/features/dm/api/useStaffDMs';
import { timeAgo } from '@/lib/utils';

function ActiveQuestionBanner({ session, sessionId }) {
  const currentQId = session?.currentQuestion;
  const questions = session?.questions;
  if (!currentQId || !questions?.[currentQId]) return null;

  const q = questions[currentQId];
  const typeInfo = QUESTION_TYPE_MAP[q.type];
  const typeLabel = typeInfo?.label || q.type;
  // aiJudge는 votes가 아닌 submissions 경로를 쓰므로 카운트 계산 방식이 다름
  const isAiJudge = q.type === 'aiJudge';
  const voteCount = isAiJudge
    ? (q.submissions ? Object.keys(q.submissions).length : 0)
    : (q.votes ? Object.keys(q.votes).length : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.default}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 max-w-md w-full"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Radio size={14} className="text-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          현재 진행 중
        </span>
      </div>
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
        {q.title}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <Badge variant="primary">{typeLabel}</Badge>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {isAiJudge ? `${voteCount}명 제출` : `${voteCount}명 응답`}
        </span>
      </div>
      {isAiJudge && sessionId && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            AI 심사는 강사가 시작·제어합니다. 스태프는 제출 현황만 확인 가능합니다.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function ChatReplyInput({ sessionId, senderName, staffId, question, onOpenDM, ensureDMForStudent, hasContextForQuestion, dmsLoading, onError }) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = useCallback(async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !sessionId || !question) return;
    if (dmsLoading) return; // 구독 전이면 가드 — system 메시지 중복 삽입 방지

    setSending(true);
    try {
      const studentId = question.participantId || question.id;
      const studentName = question.nickname || '학생';

      // 단일 DM 보장 (경합 방지). 없으면 원본 질문을 system 메시지로 먼저 삽입.
      const { dmId, existed } = await ensureDMForStudent({
        studentId,
        studentName,
        staffId,
        staffName: senderName,
        firstMessage: {
          text: `수업 질문: ${question.text}`,
          sender: '시스템',
          senderType: 'system',
          contextQuestionId: question.id,
        },
      });

      // 기존 DM이었고 이 질문의 컨텍스트가 아직 없었다면 먼저 system 메시지 추가
      if (existed && !hasContextForQuestion(dmId, question.id)) {
        await push(ref(db, `sessions/${sessionId}/dm/${dmId}/messages`), {
          text: `수업 질문: ${question.text}`,
          sender: '시스템',
          senderType: 'system',
          contextQuestionId: question.id,
          timestamp: serverTimestamp(),
        });
      }

      // 기존 DM이 waiting이었거나 담당자가 없었다면 active 승격
      if (existed) {
        await update(ref(db, `sessions/${sessionId}/dm/${dmId}`), {
          staffId,
          staffName: senderName,
          status: 'active',
        });
      }

      // 스태프 답변
      await push(ref(db, `sessions/${sessionId}/dm/${dmId}/messages`), {
        text: trimmed,
        sender: senderName || '스태프',
        senderType: 'staff',
        timestamp: serverTimestamp(),
      });

      setReplyText('');
      if (onOpenDM) onOpenDM({ id: dmId, studentName, status: 'active', staffName: senderName });
    } catch (err) {
      logger.error('1:1 답변 전송 실패:', err);
      if (onError) onError('답변을 보낼 수 없어요. 잠시 후 다시 시도해주세요.');
    }
    setSending(false);
  }, [replyText, sessionId, senderName, staffId, question, onOpenDM, ensureDMForStudent, hasContextForQuestion, dmsLoading, onError]);

  return (
    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">1:1 빠른 답변</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleReply()}
          placeholder="답변을 입력하세요..."
          aria-label="1:1 빠른 답변"
          className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150"
        />
        <Button
          onClick={handleReply}
          variant="primary"
          size="sm"
          disabled={!replyText.trim() || sending || dmsLoading}
          aria-label="답변 전송"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}

export default memo(function StaffQuestionDetail({ question, onAction, onMarkAnsweredById, loading, session, sessionId, senderName, staffId }) {
  const [openDM, setOpenDM] = useState(null);
  const [dmError, setDmError] = useState(null);
  const { waitingDMs, activeDMs, resolveDM, sendMessage, ensureDMForStudent, loading: dmsLoading } = useStaffDMs(sessionId);

  const liveDM = openDM
    ? (activeDMs.find((d) => d.id === openDM.id) || waitingDMs.find((d) => d.id === openDM.id) || openDM)
    : null;

  // 해당 DM 스레드 전체에서 특정 질문의 system 컨텍스트 존재 여부 (중간 위치여도 감지)
  const hasContextForQuestion = useCallback((dmId, questionId) => {
    const thread = activeDMs.find((d) => d.id === dmId) || waitingDMs.find((d) => d.id === dmId);
    if (!thread) return false;
    return (thread.messageList || []).some(
      (m) => m.senderType === 'system' && m.contextQuestionId === questionId
    );
  }, [activeDMs, waitingDMs]);

  const handleDirectReply = useCallback(async (q) => {
    if (!sessionId || !q) return;
    if (dmsLoading) return; // 구독 전엔 아무것도 하지 말고 대기 — 기존 DM 놓치는 것 방지
    const studentId = q.participantId || q.id;
    const studentName = q.nickname || '학생';

    try {
      // 단일 DM 보장 — 경합 없이 학생당 하나. 신규 생성 시 원본 질문을 system 메시지로 삽입.
      const { dmId, existed } = await ensureDMForStudent({
        studentId,
        studentName,
        staffId,
        staffName: senderName,
        firstMessage: {
          text: `수업 질문: ${q.text}`,
          sender: '시스템',
          senderType: 'system',
          contextQuestionId: q.id,
        },
      });

      // 기존 DM 재사용 시: 이 질문의 컨텍스트가 없으면 추가.
      // staffName은 최초 배정자를 존중 (덮어쓰기 금지) — 학생 헤더의 담당 스태프 혼란 방지.
      if (existed) {
        if (!hasContextForQuestion(dmId, q.id)) {
          await push(ref(db, `sessions/${sessionId}/dm/${dmId}/messages`), {
            text: `수업 질문: ${q.text}`,
            sender: '시스템',
            senderType: 'system',
            contextQuestionId: q.id,
            timestamp: serverTimestamp(),
          });
        }
        // 기존에 담당자가 없거나 본인이면 active 승격, 다른 스태프 담당이면 그대로 둠
        const existingThread = activeDMs.find((d) => d.id === dmId) || waitingDMs.find((d) => d.id === dmId);
        if (!existingThread?.staffId || existingThread.staffId === staffId) {
          await update(ref(db, `sessions/${sessionId}/dm/${dmId}`), {
            staffId,
            staffName: existingThread?.staffName || senderName,
            status: 'active',
          });
        }
      }

      setOpenDM({ id: dmId, studentName, status: 'active', staffName: senderName });

      // 1:1 답변 시작 = 이 수업 질문에 대한 답변이 시작됨. 목록에서 "미답변" 제거.
      // 수업 질문이 아닌 긴급 질문은 _type === 'urgent'라 다른 경로(onAction)로 처리됨.
      if (q._type !== 'urgent' && !q.answered && onMarkAnsweredById) {
        onMarkAnsweredById(q.id);
      }
    } catch (err) {
      logger.error('1:1 답변 생성 실패:', err);
      setDmError('DM을 열 수 없어요. 잠시 후 다시 시도해주세요.');
      setTimeout(() => setDmError(null), 3500);
    }
  }, [sessionId, staffId, senderName, ensureDMForStudent, hasContextForQuestion, dmsLoading, activeDMs, waitingDMs, onMarkAnsweredById]);

  const isUrgent = question?._type === 'urgent';
  const isDone = isUrgent ? question?.read : question?.answered;
  const Icon = isUrgent ? MessageCircle : HelpCircle;

  const answeredLabel = useMemo(() => {
    if (!question) return '';
    if (isUrgent) return '확인됨';
    if (question.answeredByRole === 'staff') return '스태프 답변 완료';
    return '강사 답변 완료';
  }, [question, isUrgent]);

  if (!question) {
    const hasActiveQuestion = session?.currentQuestion && session?.questions?.[session.currentQuestion];
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        {hasActiveQuestion && <ActiveQuestionBanner session={session} sessionId={sessionId} />}
        <EmptyState
          title="왼쪽에서 질문을 선택하세요"
          description="질문을 클릭하면 상세 내용이 표시됩니다"
          mascotSize="sm"
          mood="waiting"
        />
      </div>
    );
  }

  return (
    <motion.div
      key={question._key}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.default}
      className="flex flex-col items-center justify-center h-full max-w-lg mx-auto"
    >
      {/* Type badge */}
      <div className="flex items-center gap-2 mb-6">
        <Icon size={18} className="text-slate-500 dark:text-slate-400" />
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
          {isUrgent ? '긴급 질문' : '수업 질문'}
        </span>
      </div>

      {/* Question text */}
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-relaxed text-center">
        {question.text}
      </p>

      {/* Meta info */}
      <div className="flex items-center gap-3 mt-4">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {isUrgent && question.anonymous !== false ? '익명' : question.nickname || '익명'}
        </span>
        <span className="text-slate-500 dark:text-slate-300">·</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">{timeAgo(question.timestamp)}</span>
        {!isUrgent && question.upvoteCount > 0 && (
          <>
            <span className="text-slate-500 dark:text-slate-300">·</span>
            <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <ThumbsUp size={12} />
              {question.upvoteCount}
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-10 w-full max-w-xs space-y-3">
        {!isDone && (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={() => onAction(question)}
              disabled={loading}
              className="w-full"
            >
              {isUrgent ? '확인 (삭제)' : '답변 완료'}
            </Button>
            {!isUrgent && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => handleDirectReply(question)}
                className="w-full"
                disabled={dmsLoading}
              >
                <MessageSquare size={16} className="mr-1.5" />
                {dmsLoading ? '대화 목록 불러오는 중...' : '1:1 답변'}
              </Button>
            )}
          </>
        )}
        {isDone && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-3">
            {answeredLabel}
          </div>
        )}
      </div>

      {/* Quick chat reply */}
      <div className="w-full max-w-xs">
        <ChatReplyInput
          sessionId={sessionId}
          senderName={senderName}
          staffId={staffId}
          question={question}
          onOpenDM={setOpenDM}
          ensureDMForStudent={ensureDMForStudent}
          hasContextForQuestion={hasContextForQuestion}
          dmsLoading={dmsLoading}
          onError={(msg) => { setDmError(msg); setTimeout(() => setDmError(null), 3500); }}
        />
      </div>

      {/* DM 생성 실패 알림 */}
      <AnimatePresence>
        {dmError && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            role="alert"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium z-50 shadow-lg"
          >
            {dmError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DM Chat modal */}
      <StaffDMChat
        dm={liveDM}
        open={!!liveDM}
        onClose={() => setOpenDM(null)}
        onResolve={resolveDM}
        onSendMessage={sendMessage}
        staffName={senderName}
        staffId={staffId}
        senderType="staff"
        allActiveDMs={activeDMs}
        onSwitchDM={setOpenDM}
        sessionId={sessionId}
      />
    </motion.div>
  );
});
