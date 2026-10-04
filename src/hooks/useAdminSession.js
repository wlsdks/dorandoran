import { participationLeader } from '@/lib/participation';
import { getStaffSession, logoutStaff } from '@/lib/auth-session';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ref, set, update, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { generateQuestionId } from '@/lib/utils';
import { MODE_CARD_TYPE, modeLabel } from '@/lib/modes';
import { useSession } from '@/features/session/api/useSession';
import { useParticipants } from '@/features/participants/api/useParticipants';
import { useScores } from '@/features/quiz/api/useScores';
import { useAdminApprovals } from '@/features/session/api/useAdminApprovals';
import { useTimer } from '@/features/timer/api/useTimer';
import { useSpeedQuiz } from '@/features/quiz/api/useSpeedQuiz';
import { useQuestionActions } from '@/hooks/useQuestionActions';

const getAdminUser = getStaffSession;

function getUrlParam(key) {
  return new URLSearchParams(window.location.search).get(key) || '';
}

function setUrlParams(params) {
  const url = new URL(window.location);
  url.searchParams.delete('s');
  url.searchParams.delete('edit');
  url.searchParams.delete('editName');
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  window.history.replaceState({}, '', url);
}

export function useAdminSession() {
  const [adminUser, setAdminUser] = useState(() => getAdminUser());
  const [sessionId, setSessionId] = useState(() => getUrlParam('s'));
  const [readOnly, setReadOnly] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCenterForm, setShowCenterForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null); // { qId, data } or null
  const [modeOpen, setModeOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  const { session, loading } = useSession(sessionId);
  const { participants, onlineList, count } = useParticipants(sessionId);
  const { scores, leaderboard, resetScores } = useScores(sessionId);
  const { isRunning: timerRunning, endTime, duration, startTimer, stopTimer } = useTimer(sessionId);
  const { pendingAdmins, pendingCount, approveAdmin, rejectAdmin } = useAdminApprovals(adminUser?.role === 'master');

  const { active: speedQuizActive, startSpeedQuiz, endSpeedQuiz, quizCount: speedQuizCount } = useSpeedQuiz(
    sessionId, session, { scores, participants, startTimer, stopTimer }
  );


  const spotlight = useMemo(() => participationLeader(session?.questions, participants), [session?.questions, participants]);
  const spotlightKey = spotlight ? `${sessionId}:${spotlight.id}:${spotlight.milestone}` : null;
  const spotlightPayload = JSON.stringify(spotlight ? { ...spotlight, count: spotlight.milestone } : null);
  useEffect(() => {
    if (!sessionId || !spotlightKey || adminUser?.role === 'staff') return;
    update(ref(db, `sessions/${sessionId}`), { participationSpotlight: JSON.parse(spotlightPayload) }).catch(() => {});
  }, [sessionId, spotlightKey, spotlightPayload, adminUser?.role]);

  const { handleSubmit: submitQuestion, updateQuestion, revealQuiz, revealAnswer } = useQuestionActions(sessionId, session?.questions || {}, session?.currentQuestion, scores, participants);

  const isSetting = session?.status === 'setting';
  const isReviewing = session?.status === 'reviewing';
  const isEnded = session?.status === 'ended';
  const effectiveReadOnly = readOnly || isEnded || isReviewing;
  const isMaster = adminUser?.role === 'master';

  const voteCounts = useMemo(() => {
    const questions = session?.questions;
    if (!questions) return {};
    const counts = {};
    for (const q of Object.values(questions)) {
      if (!q.votes) continue;
      for (const pid of Object.keys(q.votes)) { counts[pid] = (counts[pid] || 0) + 1; }
    }
    return counts;
  }, [session?.questions]);

  const questionProgress = useMemo(() => {
    const questions = session?.questions || {};
    const sorted = Object.entries(questions).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
    const total = sorted.length;
    if (total === 0) return null;
    const currentQId = session?.currentQuestion;
    const activeIdx = currentQId ? sorted.findIndex(([qId]) => qId === currentQId) : -1;
    return { current: activeIdx >= 0 ? activeIdx + 1 : null, total };
  }, [session?.questions, session?.currentQuestion]);

  const studentUrl = useMemo(() => `${window.location.origin}/?s=${sessionId}`, [sessionId]);
  const drawParticipants = useMemo(
    () => onlineList,
    [onlineList]
  );

  /**
   * 모드 카드를 질문 목록 끝에 추가한다.
   * 수업 흐름을 미리 짜두고 순서대로 누르기 위한 것 — 진행 중에 메뉴를 뒤지지 않아도 된다.
   */
  const addModeCard = useCallback(async (mode) => {
    if (!sessionId || effectiveReadOnly) return;
    const label = modeLabel(mode);
    if (!label) return;
    const existing = Object.values(session?.questions || {});
    const order = existing.length > 0 ? Math.max(...existing.map((q) => q.order || 0)) + 1 : 1;
    try {
      await set(ref(db, `sessions/${sessionId}/questions/${generateQuestionId()}`), {
        type: MODE_CARD_TYPE, mode, title: label, order,
      });
    } catch (err) {
      logger.error('모드 카드 추가 실패:', err);
    }
  }, [sessionId, effectiveReadOnly, session?.questions]);

  // Navigation
  const handleLogin = useCallback(() => { setAdminUser(getAdminUser()); }, []);
  const handleSelectSession = useCallback((id, isReadOnly) => { setSessionId(id); setReadOnly(isReadOnly); setUrlParams({ s: id }); }, []);
  const handleBack = useCallback(() => { setSessionId(''); setReadOnly(false); setPresentMode(false); setUrlParams({}); }, []);
  const handleLogout = useCallback(() => { setAdminUser(null); setSessionId(''); setUrlParams({}); logoutStaff().catch(() => {}); }, []);

  // UI toggles
  const handleChatToggle = useCallback(() => {
    setChatOpen(prev => !prev);
    setHasUnreadChat(false);
  }, []);
  const handleChatClose = useCallback(() => setChatOpen(false), []);
  const handleNewChatMessage = useCallback(() => {
    if (!chatOpen) setHasUnreadChat(true);
  }, [chatOpen]);
  const handlePresentMode = useCallback(() => setPresentMode(true), []);
  const handleExitPresent = useCallback(() => setPresentMode(false), []);
  const handleModeToggle = useCallback(() => setModeOpen(prev => !prev), []);
  const handleCollapseOpen = useCallback(() => setSidebarCollapsed(false), []);
  const handleCollapseClose = useCallback(() => setSidebarCollapsed(true), []);
  const handleShowCenterForm = useCallback(() => { setEditingQuestion(null); setShowCenterForm(true); }, []);
  const handleHideCenterForm = useCallback(() => { setShowCenterForm(false); setEditingQuestion(null); }, []);
  const handleEditQuestion = useCallback((qId) => {
    const q = session?.questions?.[qId];
    if (!q) return;
    setEditingQuestion({ qId, data: q });
    setShowCenterForm(true);
  }, [session?.questions]);
  const handleLeftDrawerOpen = useCallback(() => setLeftDrawerOpen(true), []);
  const handleLeftDrawerClose = useCallback(() => setLeftDrawerOpen(false), []);
  const handleRightDrawerOpen = useCallback(() => setRightDrawerOpen(true), []);
  const handleRightDrawerClose = useCallback(() => setRightDrawerOpen(false), []);

  // Session actions
  const [actionError, setActionError] = useState(null);
  const actionErrorTimerRef = useRef(null);
  const showActionError = useCallback((msg) => {
    setActionError(msg);
    if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    actionErrorTimerRef.current = setTimeout(() => setActionError(null), 4000);
  }, []);

  const switchMode = useCallback(async (mode) => {
    if (effectiveReadOnly) return;
    try {
      const updates = mode === 'leaderboard'
        ? { currentMode: mode }
        : { currentMode: mode, currentQuestion: null };
      // 추첨 계열 진입 시 이전 결과 클리어 — 직전 판의 당첨자가 학생 폰에 다시 뜨지 않게
      if (mode === 'lottery' || mode === 'scratchCard') updates.gameResult = null;
      await update(ref(db, `sessions/${sessionId}`), updates);
    } catch (err) {
      logger.error('Mode switch failed:', err);
      showActionError('모드 전환에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, effectiveReadOnly, showActionError]);

  const handleStartSession = useCallback(async () => {
    try {
      await update(ref(db, `sessions/${sessionId}`), { status: 'active', startedAt: serverTimestamp() });
    } catch (err) {
      logger.error('Session start failed:', err);
      showActionError('세션 시작에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, showActionError]);

  const handleEndSession = useCallback(async () => {
    try {
      const reviewingUntil = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days
      await update(ref(db, `sessions/${sessionId}`), {
        status: 'reviewing',
        currentMode: 'waiting',
        currentQuestion: null,
        reviewingUntil,
      });
    } catch (err) {
      logger.error('Session end failed:', err);
      showActionError('세션 종료에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, showActionError]);

  const handleFullEndSession = useCallback(async () => {
    try {
      await update(ref(db, `sessions/${sessionId}`), { status: 'ended' });
    } catch (err) {
      logger.error('Full session end failed:', err);
      showActionError('세션 완전 종료에 실패했습니다. 다시 시도해주세요.');
    }
  }, [sessionId, showActionError]);

  const handleCenterFormSubmit = useCallback(async (formData) => {
    if (editingQuestion) {
      const success = await updateQuestion(editingQuestion.qId, formData);
      if (success) { setShowCenterForm(false); setEditingQuestion(null); }
      return success;
    }
    const success = await submitQuestion(formData);
    if (success) setShowCenterForm(false);
    return success;
  }, [submitQuestion, updateQuestion, editingQuestion]);

  const handleViewQuestion = useMemo(() => {
    if (!effectiveReadOnly) return undefined;
    return async (qId) => {
      try {
        if (qId === '__summary__') { await update(ref(db, `sessions/${sessionId}`), { currentQuestion: null, currentMode: 'waiting' }); }
        else { await update(ref(db, `sessions/${sessionId}`), { currentQuestion: qId, currentMode: 'poll' }); }
      } catch { /* silent */ }
    };
  }, [effectiveReadOnly, sessionId]);

  return {
    // Auth
    adminUser, isMaster, handleLogin, handleLogout,
    // Session
    sessionId, session, loading, readOnly, effectiveReadOnly, isSetting, isReviewing, isEnded,
    handleSelectSession, handleBack, handleStartSession, handleEndSession, handleFullEndSession,
    // Approvals
    pendingAdmins, pendingCount, approveAdmin, rejectAdmin,
    // Participants & scores
    participants, onlineList, count, scores, leaderboard, resetScores,
    voteCounts, drawParticipants, studentUrl, questionProgress, addModeCard,
    // Timer
    timerRunning, endTime, duration, startTimer, stopTimer,
    // Speed quiz
    speedQuizActive, startSpeedQuiz, endSpeedQuiz, speedQuizCount,
    // UI state
    presentMode, chatOpen, sidebarCollapsed, showCenterForm, modeOpen,
    leftDrawerOpen, rightDrawerOpen,
    // UI handlers
    handleChatToggle, handleChatClose, handleNewChatMessage, hasUnreadChat,
    handlePresentMode, handleExitPresent,
    handleModeToggle, switchMode,
    handleCollapseOpen, handleCollapseClose,
    handleShowCenterForm, handleHideCenterForm, handleEditQuestion, editingQuestion,
    handleLeftDrawerOpen, handleLeftDrawerClose,
    handleRightDrawerOpen, handleRightDrawerClose,
    // Question form
    handleCenterFormSubmit, handleViewQuestion,
    // Reveal actions (퀴즈 점수 반영 + 정답 공개)
    revealQuiz, revealAnswer,
    // Action error
    actionError,
  };
}
