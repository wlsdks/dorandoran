import { useState, useEffect, useMemo, useCallback } from 'react';
import { authenticatedRequest } from '@/lib/auth-session';

/** 비밀번호가 없는 서버 응답만 읽는다. 기존 강사 ID와 승인 상태는 그대로 유지한다. */
export function useAdminApprovals(enabled = false) {
  const [state, setState] = useState({ profiles: [], loading: false, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ profiles: [], loading: true, error: null });
    authenticatedRequest('/api/staff/list', {}).then(({ profiles }) => {
      if (active) setState({ profiles, loading: false, error: null });
    }).catch((error) => { if (active) setState({ profiles: [], loading: false, error }); });
    return () => { active = false; };
  }, [enabled, revision]);
  const pendingAdmins = useMemo(() => enabled ? state.profiles.filter((profile) => profile && !profile.approved)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [], [enabled, state.profiles]);
  const approveAdmin = useCallback(async (uid) => { await authenticatedRequest('/api/staff/approve', { uid }); setRevision((value) => value + 1); }, []);
  const rejectAdmin = useCallback(async (uid) => { await authenticatedRequest('/api/staff/reject', { uid }); setRevision((value) => value + 1); }, []);
  return { pendingAdmins, pendingCount: pendingAdmins.length, approveAdmin, rejectAdmin, loading: enabled && state.loading, error: state.error };
}
