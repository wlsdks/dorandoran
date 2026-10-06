import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { Award, Sun, Moon, Users, Settings, UserRound } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import BottomSheet from '@/components/ui/BottomSheet';
import { SheetList, SheetRow } from '@/components/ui/SheetList';
import ConnectionBanner, { CONNECTION_DETAILS_EVENT } from '@/components/ui/ConnectionBanner';
import ConnectionStatusIcon from '@/components/ui/ConnectionStatusIcon';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useMyScore } from '@/features/quiz/api/useScores';
import { useParticipantCount } from '@/features/participants/api/useParticipants';
import { getNickname, clearSessionJoined } from '@/lib/participant';
import { hapticTap } from '@/lib/haptics';
import QuizScoreGuide from './QuizScoreGuide';
import StudentRankingSheet from './StudentRankingSheet';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';

/** 다른 학생 화면(대기 화면의 점수 카드 등)에서 랭킹 시트를 열 때 쓰는 이벤트. */
export const OPEN_RANKING_EVENT = 'dorandoran:open-ranking';

export default function StudentHeader({ sessionId, question, isSpeedQuiz = false }) {
  const liveCount = useParticipantCount(sessionId);
  const { myScore } = useMyScore(sessionId);
  const { connected, showBanner } = useConnectionStatus();
  const { isDark, setTheme } = useTheme();
  const reduced = useReducedMotion();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreTab, setScoreTab] = useState('ranking');
  // 강사가 '학생 랭킹 숨김'을 켜면 랭킹 탭은 안내만 보여준다(기본은 공개).
  const { value: rankingHidden } = useRealtimeValue(sessionId ? `sessions/${sessionId}/studentRankingHidden` : null);
  const nickname = getNickname();
  const totalScore = Number.isFinite(myScore?.total) ? myScore.total : 0;
  const openRanking = useCallback((tab = 'ranking') => { setScoreTab(tab); setScoreOpen(true); }, []);
  useEffect(() => {
    const handler = event => openRanking(event.detail?.tab);
    window.addEventListener(OPEN_RANKING_EVENT, handler);
    return () => window.removeEventListener(OPEN_RANKING_EVENT, handler);
  }, [openRanking]);
  const handleChangeNickname = useCallback(() => {
    setSettingsOpen(false);
    clearSessionJoined(sessionId);
    window.dispatchEvent(new CustomEvent('dorandoran:change-nickname'));
  }, [sessionId]);
  return <MotionConfig reducedMotion="user">
    <motion.header initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.16 }} aria-label="도란도란 학생 헤더" className="fixed top-0 left-0 right-0 z-20 bg-white/92 dark:bg-slate-800/92 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-700/50 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="flex items-center justify-between gap-2 px-4 py-2 max-w-[620px] mx-auto min-h-16">
        <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
          <span className="shrink-0"><DoranDoranMascot size={30} animated={false} /></span>
          <span className="inline-flex min-w-0 items-center gap-1.5 font-bold text-[15px] text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap"><span className="truncate">도란도란</span>
            {/* 연결 상태 — 평소엔 점, 끊김/복구 안내 중에는 칩. 칩을 누르면 가운데 안내를 다시 연다. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {showBanner ? (
                <motion.button key={showBanner} type="button" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => showBanner === 'offline' && window.dispatchEvent(new CustomEvent(CONNECTION_DETAILS_EVENT))}
                  aria-label={showBanner === 'offline' ? '서버 재연결 중. 연결 안내 열기' : '다시 연결됨'}
                  className={`-my-2 ml-0.5 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full py-2 pl-1 pr-2.5 text-xs font-semibold ${showBanner === 'offline' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  <ConnectionStatusIcon key={showBanner} state={showBanner === 'offline' ? 'retrying' : 'restored'} size={18} />
                  {showBanner === 'offline' ? '재연결 중' : '연결됨'}
                </motion.button>
              ) : (
                <motion.span key="dot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} role="img" aria-label={connected ? '서버 연결됨' : '서버 재연결 중'} />
              )}
            </AnimatePresence>
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* 점수는 읽기 전용 표시, 랭킹은 글자가 있는 별도 버튼 — 눌러야 할 곳이 한눈에 보이게 */}
          <div className="flex flex-col items-end justify-center pr-1.5 leading-none" aria-label={`내 점수 ${totalScore}점`} role="status">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">내 점수</span>
            <span className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-100"><AnimatedNumber value={totalScore} />점</span>
          </div>
          <motion.button type="button" whileTap={{ scale: reduced ? 1 : 0.95 }} onClick={() => { hapticTap(); openRanking('ranking'); }} aria-label="실시간 랭킹 보기" aria-haspopup="dialog"
            className="h-12 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-100 hover:bg-slate-200/80 active:bg-slate-200 dark:hover:bg-slate-700 dark:active:bg-slate-600 text-sm font-semibold transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <Award size={18} aria-hidden="true" className="shrink-0" />랭킹
          </motion.button>
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="학습자 설정" aria-haspopup="dialog" className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 dark:active:bg-slate-600 transition-colors duration-100"><Settings size={20} /></button>
        </div>
      </div>
    </motion.header>
    <BottomSheet open={scoreOpen} onClose={() => setScoreOpen(false)} title={scoreTab === 'ranking' ? '실시간 랭킹' : '점수 기준'} ariaLabel="실시간 랭킹과 점수 기준" closeLabel="랭킹 닫기">
      <div className="space-y-4 pt-1">
        <div role="tablist" aria-label="랭킹 보기" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-700/50 p-1">
          {[['ranking', '전체 랭킹'], ['guide', '점수 기준']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={scoreTab === id} onClick={() => setScoreTab(id)}
              className={`min-h-11 rounded-lg text-sm font-semibold transition-colors ${scoreTab === id ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>{label}</button>
          ))}
        </div>
        {scoreTab === 'ranking'
          ? <StudentRankingSheet sessionId={sessionId} hidden={rankingHidden === true} />
          : <>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-4"><p className="text-sm text-slate-500 dark:text-slate-300">수업 전체 총점</p><p className="mt-1 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totalScore}점</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">지금까지 반영된 퀴즈 점수의 합계예요.</p></div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{question?.type === 'quiz' ? '이번 퀴즈의 점수 기준' : '퀴즈 점수 기준'}</h3>
            <QuizScoreGuide question={question} isSpeedQuiz={isSpeedQuiz} />
          </>}
      </div>
    </BottomSheet>
    <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="내 수업 설정" ariaLabel="학습자 설정" closeLabel="설정 닫기">
      <div className="space-y-4 pt-1">
        <p className="flex items-center gap-2 px-1 text-sm text-slate-600 dark:text-slate-300"><Users size={16} aria-hidden="true" className="text-slate-400" />{liveCount}명 참여 중</p>
        <SheetList label="설정 목록">
          <SheetRow icon={isDark ? Sun : Moon} title="화면 테마" subtitle={isDark ? '어두운 화면을 쓰고 있어요' : '밝은 화면을 쓰고 있어요'} value={isDark ? '다크' : '라이트'} chevron={false}
            ariaLabel={isDark ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기'} onClick={() => { hapticTap(); setTheme(isDark ? 'light' : 'dark'); }} />
          <SheetRow icon={UserRound} title="닉네임 변경" subtitle={nickname || '학습자'} ariaLabel="닉네임 변경" onClick={handleChangeNickname} />
        </SheetList>
      </div>
    </BottomSheet>
    <ConnectionBanner inlineStatus />
  </MotionConfig>;
}
