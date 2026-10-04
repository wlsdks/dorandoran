import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AIAvailabilityContext, AI_UNAVAILABLE } from '@/hooks/useAIAvailability';
import { AI_ENABLED, setVerifiedAIConfiguration, clearVerifiedAIConfiguration } from '@/lib/ai-config';
import { auth, getStaffSession } from '@/lib/auth-session';

/** 미확인 연결을 사용 가능한 기능으로 표시하지 않는다. 학생에게는 지원되지 않는 직접 AI를 제공하지 않는다. */
export default function AIAvailabilityProvider({ children }) {
  const location = useLocation();
  const sessionId = new URLSearchParams(location.search).get('s');
  const assignmentId = new URLSearchParams(location.search).get('a');
  const staff = getStaffSession();
  const uid = auth.currentUser?.uid;
  const eligibleScope = Boolean(sessionId || assignmentId || staff);
  const scope = `${uid || 'learner'}:${sessionId || assignmentId || 'workspace'}`;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    clearVerifiedAIConfiguration();
    if (!AI_ENABLED || !uid || !eligibleScope) return;
    const controller = new AbortController();
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (controller.signal.aborted || auth.currentUser?.uid !== uid) return;
        const response = await fetch('/api/gemini/status', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId, assignmentId }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'AI 연결 상태를 확인하지 못했어요.');
        if (!controller.signal.aborted) { setVerifiedAIConfiguration(uid, data.available); setResult({ scope, revision, status: data.available ? 'configured' : 'unavailable',
          configured: data.configured === true, available: data.available === true, studentFeaturesAvailable: false,
          reason: data.reason || 'AI 연결 필요' }); }
      } catch { if (!controller.signal.aborted) setResult({ scope, revision, ...AI_UNAVAILABLE, status: 'unavailable', reason: 'AI 연결 상태를 확인하지 못했어요.' }); }
    })();
    return () => { controller.abort(); clearVerifiedAIConfiguration(uid); };
  }, [uid, sessionId, assignmentId, scope, revision, eligibleScope]);
  const value = !AI_ENABLED ? { ...AI_UNAVAILABLE, status: 'disabled', reason: '이 서비스에는 AI가 연결되지 않았어요.' }
    : !uid || !eligibleScope ? { ...AI_UNAVAILABLE, status: 'disabled', reason: '' }
      : result?.scope === scope && result?.revision === revision ? result : AI_UNAVAILABLE;
  return <AIAvailabilityContext.Provider value={{ ...value, refresh }}>{children}</AIAvailabilityContext.Provider>;
}
