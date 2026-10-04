import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Trophy, Ticket, Volume2, VolumeOff, Sun, Moon, Users } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Avatar from '@/components/ui/Avatar';
import ConnectionBanner from '@/components/ui/ConnectionBanner';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useMyScore } from '@/features/quiz/api/useScores';
import { useParticipantCount } from '@/features/participants/api/useParticipants';
import { getNickname, clearSessionJoined } from '@/lib/participant';

function ThemeToggle() {
  const { isDark, setTheme } = useTheme();
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? '라이트 모드' : '다크 모드'}
      className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </motion.button>
  );
}

/** Animated score counter for the header. */
function HeaderScore({ value }) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const displayRef = useRef(null);
  const prevRef = useRef(0);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = `${v}점`;
    });
    // Guard: if value decreased (network jitter), set instantly without animation
    if (value < prevRef.current) {
      motionVal.set(value);
    } else {
      var controls = animate(motionVal, value, {
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1],
      });
    }
    prevRef.current = value;
    return () => { controls?.stop(); unsubscribe(); };
  }, [value, motionVal, rounded]);

  return <span ref={displayRef}>{value}점</span>;
}

export default function StudentHeader({ sessionId }) {
  // 실시간 참여자 수 — 경과시간보다 학생에게 유의미. useParticipantCount는 300ms 디바운스 +
  // count 변할 때만 리렌더라 300명 규모에서도 부하 최소(입장/퇴장 시에만 갱신).
  const liveCount = useParticipantCount(sessionId);
  const { myScore } = useMyScore(sessionId);
  const { connected, showBanner } = useConnectionStatus();
  // dot은 debounce된 showBanner 기준 — 와이파이 jitter마다 amber 깜빡이던 것 방지(확정 오프라인에서만 amber)
  const showOffline = showBanner === 'offline';
  const nickname = getNickname();
  const totalScore = myScore?.total || 0;
  const tickets = myScore?.tickets || 0;

  // Sound mute toggle
  const [muted, setMuted] = useState(
    () => localStorage.getItem('dorandoran_sound_muted') === 'true'
  );
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem('dorandoran_sound_muted', String(next));
      return next;
    });
  }, []);

  // 티켓 툴팁 — 탭(모바일)/호버(데스크탑)로 용도 안내, 바깥 터치 시 닫기
  const [ticketTip, setTicketTip] = useState(false);
  const ticketTipRef = useRef(null);
  useEffect(() => {
    if (!ticketTip) return;
    const onOutside = (e) => {
      if (ticketTipRef.current && !ticketTipRef.current.contains(e.target)) setTicketTip(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [ticketTip]);

  const handleChangeNickname = useCallback(() => {
    clearSessionJoined(sessionId);
    window.dispatchEvent(new CustomEvent('dorandoran:change-nickname'));
  }, [sessionId]);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        aria-label="도란도란 학생 헤더"
        className="fixed top-0 left-0 right-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200/70 dark:border-slate-700/50"
      >
        {/* 393px 폰에서 점수·티켓 칩 등장 시 줄바꿈 방지 — 간격 축소 + nowrap */}
        <div className="flex items-center justify-between px-4 py-4 max-w-[620px] mx-auto">
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <DoranDoranMascot size="xs" />
              {/* 연결 상태 dot — emerald 연결 / amber 끊김 (debounced).
                  CLAUDE.md 페르소나 "Wi-Fi 불안정 시 연결 상태 표시 중요" 충족. */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-800 transition-colors duration-300 ${
                  showOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
                aria-label={connected ? '서버 연결됨' : '서버 재연결 중'}
                title={connected ? '실시간 연결됨' : '재연결 중...'}
              />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">도란도란</span>
            {liveCount > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums"
                title="실시간 참여자 수"
              >
                <Users size={13} />
                {liveCount}
              </motion.span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {totalScore > 0 && (
              <motion.span
                key="score"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap tabular-nums"
              >
                <Trophy size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <HeaderScore value={totalScore} />
              </motion.span>
            )}
            {tickets > 0 && (
              <span className="relative" ref={ticketTipRef}>
                <motion.button
                  key="tickets"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setTicketTip((v) => !v)}
                  onMouseEnter={() => setTicketTip(true)}
                  onMouseLeave={() => setTicketTip(false)}
                  aria-label={`티켓 ${tickets}장 — 추첨 응모권`}
                  className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap tabular-nums"
                >
                  <Ticket size={14} className="text-slate-500 dark:text-slate-400" />
                  {tickets}
                </motion.button>
                <AnimatePresence>
                  {ticketTip && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-56 z-40 rounded-xl bg-slate-900 text-white shadow-xl ring-1 ring-white/15 px-3.5 py-3 text-left"
                    >
                      <p className="text-[13px] font-bold flex items-center gap-1.5 mb-1">
                        <Ticket size={13} className="text-amber-400" />추첨 응모권
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        많이 모을수록 추첨에서 당첨 확률이 올라가요!
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        퀴즈 참여 +1장 · 정답 +2장 · 우수 답변 선정 +3장
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </span>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              aria-label={muted ? '알림음 켜기' : '알림음 끄기'}
              aria-pressed={!muted}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150"
            >
              {muted
                ? <VolumeOff size={16} />
                : <Volume2 size={16} />
              }
            </motion.button>
            <ThemeToggle />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleChangeNickname}
              aria-label="닉네임 변경"
              className="relative group"
            >
              <Avatar name={nickname} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-slate-300">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      <ConnectionBanner />
    </>
  );
}
