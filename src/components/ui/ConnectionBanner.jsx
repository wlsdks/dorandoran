import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { goOffline, goOnline } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import Modal from './Modal';
import ConnectionStatusIcon from './ConnectionStatusIcon';

// 오프라인 안내는 3초 디바운스 뒤에 뜨므로 경과 시간도 3초부터 센다.
const OFFLINE_DEBOUNCE_SECONDS = 3;
const RETRY_COOLDOWN_MS = 3000;
/** 헤더의 연결 상태 칩이 가운데 안내를 다시 열 때 보내는 이벤트 */
export const CONNECTION_DETAILS_EVENT = 'dorandoran:connection-details';

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
 * ConnectionBanner — 실시간 연결이 끊기면 화면 가운데에 안내를 띄운다(배경 블러).
 * "화면 보기"로 접으면 상단 작은 상태 표시로 바뀌어, 끊긴 동안에도 답을 고를 수 있다
 * (보낸 응답은 연결이 돌아오면 자동 전송된다). 복구되면 같은 자리에서 체크가 그려진 뒤 사라진다.
 * inlineStatus: 헤더가 접힌 상태를 직접 표시하는 화면(학생)에서는 떠 있는 표시를 그리지 않는다.
 */
export default function ConnectionBanner({ inlineStatus = false }) {
  const { showBanner } = useConnectionStatus();
  const deviceOnline = useDeviceOnline();
  const offline = showBanner === 'offline';
  const elapsed = useElapsedSeconds(offline);
  const [minimized, setMinimized] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);

  // 새로 끊길 때마다 다시 가운데 안내부터 보여준다.
  useEffect(() => { if (!showBanner) setMinimized(false); }, [showBanner]);
  useEffect(() => {
    const expand = () => setMinimized(false);
    window.addEventListener(CONNECTION_DETAILS_EVENT, expand);
    return () => window.removeEventListener(CONNECTION_DETAILS_EVENT, expand);
  }, []);
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
  const minimize = useCallback(() => setMinimized(true), []);

  const iconState = offline ? (deviceOnline ? 'retrying' : 'offline') : 'restored';
  const detail = deviceOnline ? `자동으로 다시 연결하는 중 · ${elapsed}초` : '와이파이나 모바일 데이터를 확인해주세요';

  return (
    <MotionConfig reducedMotion="user">
      <Modal open={Boolean(showBanner) && !minimized} onClose={offline ? minimize : undefined} centered
        ariaLabel={offline ? '연결이 끊겼어요' : '다시 연결됐어요'} className="rounded-2xl text-center">
        <div role={offline ? 'alert' : 'status'} aria-live={offline ? 'assertive' : 'polite'} className="flex flex-col items-center">
          <ConnectionStatusIcon key={iconState} state={iconState} />
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{offline ? '연결이 끊겼어요' : '다시 연결됐어요'}</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 tabular-nums">{offline ? detail : '실시간 수업에 다시 참여하고 있어요'}</p>
          {offline && (
            <>
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">끊긴 동안 고른 답은 연결되면 자동으로 전송돼요</p>
              <div className="mt-5 grid w-full gap-2">
                <button type="button" onClick={retryNow} disabled={coolingDown} autoFocus
                  className="min-h-12 w-full rounded-lg bg-slate-900 px-5 font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                  {coolingDown ? '다시 연결하는 중…' : '지금 다시 시도'}
                </button>
                <button type="button" onClick={minimize}
                  className="min-h-12 w-full rounded-lg px-5 font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                  화면 보기
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* 접힌 상태 — 헤더 아래 작은 표시. 누르면 다시 가운데 안내를 연다. */}
      <AnimatePresence>
        {showBanner && minimized && !inlineStatus && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.75rem)] z-30 flex justify-center px-4 pointer-events-none"
          >
            <button type="button" onClick={() => offline && setMinimized(false)} aria-label={offline ? `연결이 끊겼어요. ${detail}. 안내 열기` : '다시 연결됐어요'}
              className="pointer-events-auto flex min-h-11 items-center gap-2.5 rounded-full bg-white py-1.5 pl-2 pr-4 text-sm font-medium text-slate-900 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600">
              <ConnectionStatusIcon key={iconState} state={iconState} size={28} />
              <span className="tabular-nums">{offline ? (deviceOnline ? `다시 연결하는 중 · ${elapsed}초` : '인터넷 연결 확인 필요') : '다시 연결됐어요'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
