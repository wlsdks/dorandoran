import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { ref, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { ArrowLeft, Users, MessageSquare, LogOut, HelpCircle } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useParticipants } from '@/features/participants/api/useParticipants';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import { useClassQuestions } from '@/features/class-questions/api/useClassQuestions';
import Badge from '@/components/ui/Badge';
import ChatPanel from '@/features/chat/components/ChatPanel';
import StaffDMAlert from '@/features/dm/components/StaffDMAlert';
import StaffQuestionPanel from './staff/StaffQuestionPanel';
import StaffQuestionDetail from './staff/StaffQuestionDetail';
import StaffRightPanel from './staff/StaffRightPanel';
import { SuspenseFallback } from '@/components/ui/Skeleton';
import StaffMobileView from './staff/StaffMobileView';

const LazyClassQABoard = lazy(() => import('@/features/class-questions/components/ClassQABoard'));

export default function StaffPage({ sessionId, session, adminUser, onBack, onLogout }) {
  const isTablet = useMediaQuery('(max-width: 1199px)');
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [showQABoard, setShowQABoard] = useState(false);

  const { count } = useParticipants(sessionId);
  const { questionList: urgentList } = useUrgentQuestions(sessionId);
  const { questions: classList, markAnswered } = useClassQuestions(sessionId);
  const senderName = adminUser?.staffNickname || adminUser?.displayName || '스태프';

  const courseName = session?.courseName || '도란도란';
  const round = session?.roundNumber ? `${session.roundNumber}차` : '';

  // Build unified list for auto-selecting next
  const unified = useMemo(() => {
    const urgent = urgentList.map((q) => ({ ...q, _type: 'urgent', _key: `urgent-${q.id}` }));
    const classQ = classList.map((q) => ({ ...q, _type: 'class', _key: `class-${q.id}` }));
    return [...urgent, ...classQ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [urgentList, classList]);

  const handleSelect = useCallback((q) => {
    setSelected(q);
  }, []);

  const handleAction = useCallback(async (q) => {
    if (!q) return;
    setActionLoading(true);
    try {
      if (q._type === 'urgent') {
        await remove(ref(db, `sessions/${sessionId}/urgentQuestions/${q.id}`));
      } else {
        const staffName = adminUser?.displayName || '스태프';
        await markAnswered(q.id, staffName, 'staff');
      }
      // Auto-select next unread question
      const nextUnread = unified.find(
        (item) => item._key !== q._key && !(item._type === 'urgent' ? item.read : item.answered)
      );
      setSelected(nextUnread || null);
    } catch (err) {
      logger.error('질문 처리 실패:', err);
    }
    setActionLoading(false);
    // adminUser?.displayName은 마운트 후 stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, markAnswered, unified]);

  // 1:1 답변 시 수업 질문 "답변 완료"만 동기화 (자동 다음 선택이나 UI 갱신은 하지 않음)
  const handleMarkAnsweredById = useCallback(async (qId) => {
    if (!qId) return;
    try {
      const staffName = adminUser?.displayName || '스태프';
      await markAnswered(qId, staffName, 'staff');
    } catch (err) {
      logger.error('답변 완료 동기화 실패:', err);
    }
  }, [markAnswered, adminUser]);

  const handleChatToggle = useCallback(() => {
    setChatOpen((prev) => !prev);
    if (!chatOpen) setHasUnreadChat(false);
  }, [chatOpen]);

  const handleNewChatMessage = useCallback(() => {
    setHasUnreadChat(true);
  }, []);

  if (isTablet) {
    return (
      <StaffMobileView
        sessionId={sessionId}
        session={session}
        adminUser={adminUser}
        onBack={onBack}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div className="h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* DM alerts for help requests */}
      <StaffDMAlert
        sessionId={sessionId}
        staffId={adminUser?.uid}
        staffName={senderName}
        senderType="staff"
      />

      {/* Chat panel modal */}
      <ChatPanel
        sessionId={sessionId}
        senderName={senderName}
        senderType="staff"
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onNewMessage={handleNewChatMessage}
      />

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-3 px-5 py-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {courseName}
              </h1>
              {round && (
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{round}</span>
              )}
              <Badge variant="neutral">스태프</Badge>
            </div>
          </div>

          <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
            <Users size={12} className="inline mr-1" />
            {count}
          </span>

          {/* Q&A Board toggle */}
          <button
            onClick={() => setShowQABoard(v => !v)}
            className={`relative p-2 rounded-lg transition-colors duration-150 ${
              showQABoard
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700'
            }`}
            aria-label="Q&A 보드"
            title="Q&A 보드"
          >
            <HelpCircle size={18} />
            {classList.filter(q => !q.answered && !q.hidden).length > 0 && !showQABoard && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          {/* Chat button */}
          <button
            onClick={handleChatToggle}
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150"
            aria-label="채팅"
          >
            <MessageSquare size={18} />
            {hasUnreadChat && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          {/* Logout button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors duration-150"
              aria-label="로그아웃"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>

      {/* 3-panel body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Questions */}
        <div className="w-[28%] min-w-[280px] max-w-[460px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
          <StaffQuestionPanel
            urgentList={urgentList}
            classList={classList}
            selectedId={selected?._key}
            onSelect={handleSelect}
            staffName={senderName}
          />
        </div>

        {/* Center: Question detail or Q&A Board */}
        <div className="flex-1 overflow-y-auto p-6">
          {showQABoard ? (
            <Suspense fallback={<SuspenseFallback fullPage={false} />}>
              <LazyClassQABoard sessionId={sessionId} showInput={false} role="staff" isAdmin />
            </Suspense>
          ) : (
            <StaffQuestionDetail
              question={selected}
              onAction={handleAction}
              onMarkAnsweredById={handleMarkAnsweredById}
              loading={actionLoading}
              session={session}
              sessionId={sessionId}
              senderName={senderName}
              staffId={adminUser?.uid}
            />
          )}
        </div>

        {/* Right: Hand raises + Participants */}
        <div className="w-[28%] min-w-[280px] max-w-[460px] border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
          <StaffRightPanel sessionId={sessionId} session={session} staffId={adminUser?.uid} staffName={senderName} senderType="staff" />
        </div>
      </div>
    </div>
  );
}
