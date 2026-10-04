import { useState, useEffect, useCallback, useRef } from 'react';

/** 전체화면은 사용자 조작으로 시작한다. 늦게 도착한 화면 꺼짐 방지 핸들도 해제한다. */
export function usePresentationScreen({ enabled = true } = {}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const active = useRef(true);
  const ownsFullscreen = useRef(false);
  const fullscreenSupported = typeof document !== 'undefined' && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const exitFullscreen = useCallback(async () => {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) await exit.call(document).catch(() => {});
    ownsFullscreen.current = false;
  }, []);
  const enterFullscreen = useCallback(async () => {
    const element = document.documentElement;
    const request = element.requestFullscreen || element.webkitRequestFullscreen;
    if (!request || !active.current) return false;
    try {
      await request.call(element);
      if (!active.current) { await exitFullscreen(); return false; }
      ownsFullscreen.current = true;
      return true;
    } catch { return false; }
  }, [exitFullscreen]);
  const toggleFullscreen = useCallback(() => document.fullscreenElement || document.webkitFullscreenElement ? exitFullscreen() : enterFullscreen(), [enterFullscreen, exitFullscreen]);
  useEffect(() => {
    active.current = true;
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      active.current = false;
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      if (ownsFullscreen.current) exitFullscreen();
    };
  }, [exitFullscreen]);
  useEffect(() => {
    if (!enabled || !navigator.wakeLock) return;
    let cancelled = false;
    let pending = false;
    let lock = null;
    const acquire = async () => {
      if (cancelled || pending || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      pending = true;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (cancelled || document.visibilityState !== 'visible') await acquired.release().catch(() => {});
        else lock = acquired;
      } catch { /* 화면 꺼짐 방지가 거절돼도 발표는 계속 진행한다. */ }
      finally { pending = false; }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire(); document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisibility); lock?.release().catch(() => {}); };
  }, [enabled]);
  return { isFullscreen, toggleFullscreen, fullscreenSupported, enterFullscreen, exitFullscreen };
}
