import { useState, useMemo, memo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, Trash2, Users } from 'lucide-react';

const CourseStaffModal = lazy(() => import('./CourseStaffModal'));

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const h12 = hours % 12 || 12;
  return `${month}/${day} ${ampm} ${h12}:${minutes}`;
}

const SessionRow = memo(function SessionRow({ session, onClick, onDelete, onDuplicate, index, hideActions = false }) {
  const isSetting = session.status === 'setting';
  const isActive = session.status === 'active';
  const isReviewing = session.status === 'reviewing';

  function handleDelete(e) {
    e.stopPropagation();
    onDelete?.(session);
  }

  function handleDuplicate(e) {
    e.stopPropagation();
    onDuplicate?.(session);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className="w-full flex items-center gap-4 max-sm:gap-3 px-5 max-sm:px-3.5 py-4.5 text-left transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 dark:active:bg-slate-700 group cursor-pointer"
      onClick={onClick}
    >
      <span className={`text-sm font-bold w-8 shrink-0 ${isSetting ? 'text-slate-500' : isActive || isReviewing ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
        {session.roundNumber ? `${session.roundNumber}차` : session.id ? `#${session.id.slice(-4)}` : '—'}
      </span>
      <span className="text-sm text-slate-500 dark:text-slate-400 w-32 max-sm:w-auto shrink-0 tabular-nums">{formatDate(session.createdAt)}</span>
      <div className="flex items-center gap-1 flex-1 text-xs text-slate-500 dark:text-slate-400 min-w-0 max-sm:hidden tabular-nums">
        <span className="font-medium text-slate-500 dark:text-slate-400">{session.participantCount}</span>명 접속
        <span className="mx-1">·</span>
        <span className="font-medium text-slate-500 dark:text-slate-400">{session.activeCount || 0}</span>명 참여
        <span className="mx-1">·</span>
        <span className="font-medium text-slate-500 dark:text-slate-400">{session.questionCount}</span>개 질문
      </div>
      <span className="hidden max-sm:inline text-xs text-slate-500 dark:text-slate-400 flex-1 text-right">{session.participantCount}명</span>
      {isSetting ? (
        <span className="text-xs font-semibold text-slate-500 shrink-0">세팅중</span>
      ) : isActive ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          진행 중
        </span>
      ) : isReviewing ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
          <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
          질문 받기
        </span>
      ) : (
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">완료</span>
      )}
      {!hideActions && (
        <div className="flex items-center gap-0.5 shrink-0 max-sm:hidden">
          {session.questionCount > 0 && (
            <button
              onClick={handleDuplicate}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-90 max-sm:opacity-60"
              aria-label="세션 복제"
            >
              <Copy size={14} />
            </button>
          )}
          {!isActive && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 active:scale-90 max-sm:opacity-60"
              aria-label="세션 삭제"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
});

export function CourseGroup({ name, sessions, onSelect, onDelete, onDuplicate, startIndex, groupIndex = 0, hideActions = false, courseId = null, canManageStaff = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);

  const stats = useMemo(() => {
    const totalParticipants = sessions.reduce((s, x) => s + (x.totalParticipants || x.participantCount), 0);
    const avgActivity = sessions.length > 0
      ? Math.round(sessions.reduce((s, x) => s + x.activityRate, 0) / sessions.length)
      : 0;
    return { totalParticipants, avgActivity, rounds: sessions.length };
  }, [sessions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: groupIndex * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
      className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <div className="px-5 py-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">{name}</h3>
            {canManageStaff && courseId && (
              <button
                onClick={() => setStaffModalOpen(true)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150"
                aria-label="스태프 관리"
              >
                <Users size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
            aria-label={collapsed ? '펼치기' : '접기'}
          >
            <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} />
            </motion.div>
          </button>
        </div>
        <div className="flex items-center gap-8">
          <div>
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">{stats.rounds}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">차수</span>
          </div>
          <div>
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">{stats.totalParticipants}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">명</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">평균 참여율</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{stats.avgActivity}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.avgActivity}%` }} />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {!collapsed && sessions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 dark:border-slate-700">
              {sessions.map((session, i) => (
                <SessionRow key={session.id} session={session} onClick={() => onSelect(session)} onDelete={onDelete} onDuplicate={onDuplicate} index={startIndex + i} hideActions={hideActions} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {canManageStaff && courseId && staffModalOpen && (
        <Suspense fallback={null}>
          <CourseStaffModal open={staffModalOpen} onClose={() => setStaffModalOpen(false)} courseId={courseId} courseName={name} />
        </Suspense>
      )}
    </motion.div>
  );
}

export function UngroupedSessions({ sessions, onSelect, onDelete, onDuplicate, startIndex, groupIndex = 0, hideActions = false }) {
  if (sessions.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: groupIndex * 0.05, type: 'spring', stiffness: 300, damping: 25 }}>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-shadow duration-200">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">미분류 클래스</span>
        </div>
        <div className="bg-slate-50/50 dark:bg-slate-800/50">
          {sessions.map((session, i) => (
            <SessionRow key={session.id} session={session} onClick={() => onSelect(session)} onDelete={onDelete} onDuplicate={onDuplicate} index={startIndex + i} hideActions={hideActions} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
