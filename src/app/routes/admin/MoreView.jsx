import { version } from '../../../../package.json';
import { QUESTION_TYPES } from '@/lib/question-types';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import ProfileSection from './ProfileSection';
import { Keyboard, Info, ArrowRight, ArrowLeft, Trophy, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

import { list as stagger } from '@/lib/motion';

// ─── Theme Switcher ──────────────────────────────────
const THEME_OPTIONS = [
  { key: 'light', label: '라이트', icon: Sun },
  { key: 'dark', label: '다크', icon: Moon },
  { key: 'system', label: '시스템', icon: Monitor },
];

function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <motion.div variants={stagger.item} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-5">
        <Moon size={18} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">화면 테마</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTheme(key)}
            className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl text-sm font-medium transition-colors duration-150 active:scale-[0.97] ${
              theme === key
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Keyboard Shortcuts Guide ────────────────────────
const SHORTCUTS = [
  { group: '질문 이동', items: [
    { label: '다음 질문', key: <ArrowRight size={12} /> },
    { label: '이전 질문', key: <ArrowLeft size={12} /> },
    { label: '다음으로 넘기기', key: 'Space' },
  ]},
  { group: '퀴즈 진행', items: [
    { label: '정답 공개', key: 'R' },
    { label: '리더보드 표시', key: 'L' },
  ]},
  { group: '기타', items: [
    { label: '대기 화면으로', key: 'Esc' },
  ]},
];

function KeyBadge({ children }) {
  const isIcon = typeof children !== 'string';
  return (
    <span className={`inline-flex items-center justify-center ${isIcon ? 'w-7' : 'min-w-[28px] px-2'} h-7 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]`}>
      {children}
    </span>
  );
}

function ShortcutsSection() {
  return (
    <motion.div variants={stagger.item} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-5">
        <Keyboard size={18} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">키보드 단축키</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">세션 진행 중 키보드로 빠르게 수업을 진행하세요. 입력 필드에 포커스 시 비활성화됩니다.</p>
      <div className="space-y-5">
        {SHORTCUTS.map(({ group, items }) => (
          <div key={group}>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{group}</p>
            <div className="space-y-2">
              {items.map((sc) => (
                <div key={sc.label} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{sc.label}</span>
                  <KeyBadge>{sc.key}</KeyBadge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Quick Stats ─────────────────────────────────────
function QuickStats({ sessions }) {
  const stats = useMemo(() => {
    if (!sessions?.length) return null;
    return {
      total: sessions.length,
      ended: sessions.filter((s) => s.status === 'ended' || s.status === 'reviewing').length,
      participants: sessions.reduce((sum, s) => sum + (s.totalParticipants || s.participantCount || 0), 0),
      questions: sessions.reduce((sum, s) => sum + (s.questionCount || 0), 0),
    };
  }, [sessions]);

  if (!stats) return null;

  const items = [
    { label: '전체 클래스', value: stats.total, suffix: '개' },
    { label: '완료된 클래스', value: stats.ended, suffix: '개' },
    { label: '누적 참여자', value: stats.participants, suffix: '명' },
    { label: '누적 질문', value: stats.questions, suffix: '개' },
  ];

  return (
    <motion.div variants={stagger.item} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-5">
        <Trophy size={18} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">나의 활동</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium uppercase tracking-wide">{item.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">{item.value}<span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-0.5">{item.suffix}</span></p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── App Info ────────────────────────────────────────
function AppInfo() {
  return (
    <motion.div variants={stagger.item} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-5">
        <Info size={18} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">앱 정보</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">버전</span>
          <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">플랫폼</span>
          <span className="text-sm text-slate-600 dark:text-slate-300">웹 (PWA)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">지원 유형</span>
          <div className="flex gap-1.5">
            {['객관식', 'O/X', '퀴즈', `+${QUESTION_TYPES.length - 3}`].map((t) => (
              <span key={t} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-full font-medium">{t}</span>
            ))}
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
          <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener noreferrer" className="min-h-11 flex items-center justify-center text-sm text-slate-600 dark:text-slate-300 hover:underline">오픈소스 라이선스 고지</a>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">도란도란 &mdash; 실시간 강의 참여 플랫폼</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main MoreView ───────────────────────────────────
export default function MoreView({ adminUser, sessions }) {
  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-5">
      <ProfileSection adminUser={adminUser} />
      <ThemeSection />
      <QuickStats sessions={sessions} />
      <ShortcutsSection />
      <AppInfo />
    </motion.div>
  );
}
