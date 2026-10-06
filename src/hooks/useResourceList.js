import { useCallback, useEffect, useMemo, useState } from 'react';
import { authenticatedRequest, getStaffSession } from '@/lib/auth-session';
import { EMPTY_LIST } from '@/lib/realtime';

const CHANGE_EVENT = 'dorandoran:resource-changed';

/** 목록을 바꾼 쪽(생성·삭제·수정)이 알리면 같은 종류의 목록이 모두 다시 불러온다. */
export function notifyResourceChange(resource) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: resource }));
}

/** 관리 목록은 필요한 메타만 받는다. 계정/필터가 바뀌면 늦은 응답을 폐기한다. */
export function useResourceList(resource, filter = {}) {
  const actor = getStaffSession();
  const filterKey = JSON.stringify(filter);
  const [revision, setRevision] = useState(0);
  const source = useMemo(() => ({ resource, filterKey, uid: actor?.uid, role: actor?.role, revision }), [resource, filterKey, actor?.uid, actor?.role, revision]);
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!source.uid) return;
    const controller = new AbortController();
    authenticatedRequest('/api/staff/resources', { resource, ...JSON.parse(source.filterKey) }, { signal: controller.signal })
      .then(({ items }) => { if (!controller.signal.aborted) setSnapshot({ source, items, error: null }); })
      .catch(error => { if (!controller.signal.aborted) setSnapshot({ source, items: EMPTY_LIST, error }); });
    return () => controller.abort();
  }, [source, resource]);
  const current = snapshot?.source === source ? snapshot : null;
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const onChange = (event) => { if (event.detail === resource) refresh(); };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [resource, refresh]);
  return { items: current?.items || EMPTY_LIST, loading: Boolean(source.uid && !current), error: current?.error || null, refresh };
}
