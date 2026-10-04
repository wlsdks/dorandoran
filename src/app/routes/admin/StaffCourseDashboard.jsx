import { authenticatedRequest } from '@/lib/auth-session';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, BookOpen, ChevronRight, Users, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCourses } from '@/features/course/api/useCourses';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';

/**
 * Staff-only dashboard: shows assigned courses, then sessions within a selected course.
 */
export default function StaffCourseDashboard({ adminUser, onSelectSession, onLogout }) {
  const { courses, loading } = useCourses(adminUser?.uid, 'staff');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseSessions, setCourseSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Nickname modal state
  const [pendingSession, setPendingSession] = useState(null);
  const [staffNickname, setStaffNickname] = useState(() => {
    try { return sessionStorage.getItem('dorandoran_staff_nickname') || ''; } catch { return ''; }
  });

  function handleSessionClick(session) {
    if (!staffNickname) setStaffNickname(adminUser?.displayName || '');
    setPendingSession(session);
  }

  function handleNicknameConfirm() {
    const name = staffNickname.trim();
    if (!name || !pendingSession) return;
    try { sessionStorage.setItem('dorandoran_staff_nickname', name); } catch { /* silent */ }
    // Store nickname on adminUser so StaffPage can use it
    const updated = { ...adminUser, staffNickname: name };
    try { sessionStorage.setItem('dorandoran_admin', JSON.stringify(updated)); } catch { /* silent */ }
    setPendingSession(null);
    onSelectSession(pendingSession.id, pendingSession.status === 'reviewing');
  }

  // Fetch sessions for selected course
  useEffect(() => {
    if (!selectedCourse) { setCourseSessions([]); return; }
    setSessionsLoading(true);
    authenticatedRequest('/api/staff/resources', { resource: 'sessions' }).then(({ items }) => {
      const data = Object.fromEntries(items.map(item => [item.id, item]));
      const list = Object.entries(data)
        .filter(([, s]) =>
          s.courseId === selectedCourse.id &&
          (s.status === 'active' || s.status === 'reviewing')
        )
        .map(([id, s]) => ({
          id,
          status: s.status,
          roundNumber: s.roundNumber || null,
          participantCount: s.participants ? Object.values(s.participants).filter((p) => p.online).length : 0,
          createdAt: s.createdAt || 0,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setCourseSessions(list);
    }).catch(() => {
      setCourseSessions([]);
    }).finally(() => {
      setSessionsLoading(false);
    });
  }, [selectedCourse]);

  // Active session counts per course
  const [activeCountMap, setActiveCountMap] = useState({});
  useEffect(() => {
    if (courses.length === 0) return;
    authenticatedRequest('/api/staff/resources', { resource: 'sessions' }).then(({ items }) => {
      const data = Object.fromEntries(items.map(item => [item.id, item]));
      const counts = {};
      Object.values(data).forEach((s) => {
        if (s.courseId && (s.status === 'active' || s.status === 'reviewing')) {
          counts[s.courseId] = (counts[s.courseId] || 0) + 1;
        }
      });
      setActiveCountMap(counts);
    }).catch(() => {});
  }, [courses]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
        <DoranDoranMascot size="md" mood="thinking" />
        <p className="text-sm text-slate-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-6 max-sm:px-5 py-5 max-sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {selectedCourse ? (
            <button
              onClick={() => setSelectedCourse(null)}
              className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <DoranDoranMascot size="sm" />
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {selectedCourse ? selectedCourse.name : '도란도란'}
            </h1>
            <p className="text-slate-400 text-xs">
              {selectedCourse ? `${selectedCourse.ownerName || '강사'} · 세션 선택` : '배정된 강의'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 font-medium max-sm:hidden">{adminUser?.displayName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">스태프</span>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors duration-150">
            <LogOut size={16} /><span className="max-sm:hidden">로그아웃</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 max-sm:px-4 py-8">
        <AnimatePresence mode="wait">
          {!selectedCourse ? (
            <motion.div
              key="courses"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="space-y-3"
            >
              {courses.length === 0 ? (
                <EmptyState
                  title="배정된 강의가 없습니다"
                  description="강사가 강의에 배정하면 여기에 표시됩니다"
                  mascotSize="lg"
                  className="py-16"
                />
              ) : (
                courses.map((course, i) => (
                  <motion.button
                    key={course.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                    onClick={() => setSelectedCourse(course)}
                    className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <BookOpen size={20} className="text-slate-500 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 tracking-tight">{course.name}</p>
                        <p className="text-slate-400 text-sm mt-0.5">
                          {course.ownerName || '강사'}
                          {activeCountMap[course.id] > 0 && (
                            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              · {activeCountMap[course.id]}개 진행 중
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors duration-150" />
                  </motion.button>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="space-y-3"
            >
              {sessionsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <DoranDoranMascot size="sm" mood="thinking" />
                  <p className="text-sm text-slate-400">불러오는 중...</p>
                </div>
              ) : courseSessions.length === 0 ? (
                <EmptyState
                  title="진행 중인 세션이 없습니다"
                  description="강사가 세션을 시작하면 여기에 표시됩니다"
                  mascotSize="md"
                  className="py-12"
                />
              ) : (
                courseSessions.map((session, i) => (
                  <motion.button
                    key={session.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
                    onClick={() => handleSessionClick(session)}
                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 w-10">
                        {session.roundNumber ? `${session.roundNumber}차` : `#${session.id.slice(-4)}`}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          {session.status === 'active' ? (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              진행 중
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                              질문 받기
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Users size={12} />
                          {session.participantCount}명 접속
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </motion.button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nickname modal */}
      <Modal open={!!pendingSession} onClose={() => setPendingSession(null)}>
        <div className="space-y-5">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Avatar name={staffNickname || adminUser?.displayName || ''} size="lg" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">닉네임 설정</h2>
            <p className="text-slate-400 text-sm">세션에서 사용할 이름을 입력하세요</p>
          </div>
          <input
            type="text"
            value={staffNickname}
            onChange={(e) => setStaffNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleNicknameConfirm()}
            placeholder={adminUser?.displayName || '닉네임'}
            maxLength={10}
            autoFocus
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-center text-lg text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <Button
            onClick={handleNicknameConfirm}
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!staffNickname.trim()}
          >
            입장하기
            <ArrowRight size={18} />
          </Button>
        </div>
      </Modal>
    </div>
  );
}
