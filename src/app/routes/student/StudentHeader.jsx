import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Sun, Moon, Users, Settings, X, UserRound } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import Modal from '@/components/ui/Modal';
import ConnectionBanner from '@/components/ui/ConnectionBanner';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useMyScore } from '@/features/quiz/api/useScores';
import { useParticipantCount } from '@/features/participants/api/useParticipants';
import { getNickname, clearSessionJoined } from '@/lib/participant';
export default function StudentHeader({
  sessionId
}) {
  const liveCount = useParticipantCount(sessionId);
  const {
    myScore
  } = useMyScore(sessionId);
  const {
    connected,
    showBanner
  } = useConnectionStatus();
  const {
    isDark,
    setTheme
  } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const nickname = getNickname();
  const totalScore = myScore?.total || 0;
  const handleChangeNickname = useCallback(() => {
    setSettingsOpen(false);
    clearSessionJoined(sessionId);
    window.dispatchEvent(new CustomEvent('dorandoran:change-nickname'));
  }, [sessionId]);
  const rowClass = 'w-full min-h-12 rounded-xl px-3 py-3 flex items-center gap-3 text-left text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700';
  return <>
      <motion.header initial={{
      opacity: 0,
      y: -8
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: 0.2
    }} aria-label="도란도란 학생 헤더" className="fixed top-0 left-0 right-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200/70 dark:border-slate-700/50 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="flex items-center justify-between gap-2 px-4 py-2 max-w-[620px] mx-auto min-h-[64px]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0"><DoranDoranMascot size="xs" /><span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-800 ${showBanner === 'offline' ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-label={connected ? '서버 연결됨' : '서버 재연결 중'} /></div>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">도란도란</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {totalScore > 0 && <span className="flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300 tabular-nums"><Trophy size={15} aria-hidden="true" /><AnimatedNumber value={totalScore} />점</span>}
            <button type="button" onClick={() => setSettingsOpen(true)} aria-label="학습자 설정" aria-haspopup="dialog" className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><Settings size={21} /></button>
          </div>
        </div>
      </motion.header>
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} ariaLabel="학습자 설정">
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">내 수업 설정</h2><button type="button" onClick={() => setSettingsOpen(false)} aria-label="설정 닫기" className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500"><X size={20} /></button></div>
          <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 dark:bg-slate-700 p-4 text-base text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-2"><Trophy size={18} />{totalScore}점</span>

            <span className="flex items-center gap-2"><Users size={18} />{liveCount}명 참여 중</span>

          </div>
          <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? '라이트 모드' : '다크 모드'} className={rowClass}>{isDark ? <Sun size={22} /> : <Moon size={22} />}<span className="flex-1">화면 테마</span><span>{isDark ? '다크' : '라이트'}</span></button>
          <button type="button" onClick={handleChangeNickname} aria-label="닉네임 변경" className={rowClass}><UserRound size={22} /><span className="min-w-0 flex-1 truncate">{nickname || '학습자'}</span><span className="shrink-0">닉네임 변경</span></button>
        </div>
      </Modal>
      <ConnectionBanner />
    </>;
}
