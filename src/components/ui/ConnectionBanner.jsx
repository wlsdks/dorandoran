import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Check, RefreshCw, WifiOff } from 'lucide-react';
import { goOffline, goOnline } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

// 오프라인 배너는 3초 디바운스 뒤에 뜨므로 경과 시간도 3초부터 센다.
const OFFLINE_DEBOUNCE_SECONDS = 3;
const RETRY_COOLDOWN_MS = 3000;

function useDeviceOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

function useElapsedSeconds(active) {
  const [seconds, setSeconds] = useState(OFFLINE_DEBOUNCE_SECONDS);
  useEffect(() => {
    if (!active) return;
    setSeconds(OFFLINE_DEBOUNCE_SECONDS);
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return seconds;
}

/**
 * ConnectionBanner — 실시간 연결이 끊기면 헤더 아래에 떠 있는 상태 알림.
 * 끊김: 재연결 시도 중임을 회전 아이콘·경과 시간으로 보여주고 즉시 재시도 버튼을 둔다.
 * 복구: 같은 알림이 초록색 "다시 연결됐어요"로 바뀌었다가 사라진다.
 */
export default function ConnectionBanner() {
  const { showBanner } = useConnectionStatus();
  const deviceOnline = useDeviceOnline();
  const offline = showBanner === 'offline';
  const elapsed = useElapsedSeconds(offline);
  const [coolingDown, setCoolingDown] = useState(false);

  useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(() => setCoolingDown(false), RETRY_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [coolingDown]);

  // Firebase는 스스로 재연결하지만 백오프 간격이 길어질 수 있다. 버튼은 소켓을 즉시 다시 연다.
  const retryNow = useCallback(() => {
    setCoolingDown(true);
    goOffline(db);
    goOnline(db);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {showBanner && (
          <motion.div
            key="connection-banner"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.75rem)] z-30 flex justify-center px-4 pointer-events-none"
          >
            <motion.div
              layout
              role={offline ? 'alert' : 'status'}
              aria-live={offline ? 'assertive' : 'polite'}
              className={`pointer-events-auto flex items-center gap-3 rounded-2xl pl-3 pr-2 py-2 shadow-lg ring-1 transition-colors duration-300 ${offline
                ? 'bg-white text-slate-900 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600'
                : 'bg-emerald-600 text-white ring-emerald-500'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${offline ? 'text-amber-500' : 'text-white'}`}>
                {offline ? (
                  deviceOnline ? (
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} className="flex">
                      <RefreshCw size={20} strokeWidth={2.2} aria-hidden="true" />
                    </motion.span>
                  ) : <WifiOff size={20} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="flex">
                    <Check size={20} strokeWidth={2.6} aria-hidden="true" />
                  </motion.span>
                )}
              </span>

              <div className="min-w-0 pr-1">
                <p className="text-sm font-semibold leading-tight">{offline ? '연결이 끊겼어요' : '다시 연결됐어요'}</p>
                {offline && (
                  <p className="mt-0.5 text-xs leading-tight text-slate-500 dark:text-slate-400 tabular-nums">
                    {deviceOnline ? `자동으로 다시 연결하는 중 · ${elapsed}초` : '인터넷 연결을 확인해주세요'}
                  </p>
                )}
              </div>

              {offline && (
                <button
                  type="button"
                  onClick={retryNow}
                  disabled={coolingDown}
                  className="min-h-11 shrink-0 rounded-xl bg-slate-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:scale-[0.97] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {coolingDown ? '시도 중…' : '지금 다시 시도'}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
