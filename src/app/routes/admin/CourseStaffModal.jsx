import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, X, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { useStaffAssignment } from '@/features/course/api/useStaffAssignment';

export default function CourseStaffModal({ open, onClose, courseId, courseName }) {
  const { staffList, loading, searchStaff, searchResults, searchLoading, searchError, assignStaff, removeStaff } = useStaffAssignment(courseId);
  const [query, setQuery] = useState('');
  const [assigning, setAssigning] = useState(null);
  const [removing, setRemoving] = useState(null);

  const handleSearch = useCallback((e) => {
    const v = e.target.value;
    setQuery(v);
    searchStaff(v);
  }, [searchStaff]);

  async function handleAssign(staff) {
    setAssigning(staff.uid);
    try {
      await assignStaff(staff.uid, staff.displayName);
      setQuery('');
      searchStaff('');
    } finally {
      setAssigning(null);
    }
  }

  async function handleRemove(uid) {
    setRemoving(uid);
    try {
      await removeStaff(uid);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">스태프 관리</h2>
          <p className="text-slate-400 text-sm mt-0.5">{courseName}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="스태프 이름 또는 아이디 검색"
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Search results */}
        <AnimatePresence>
          {query.trim() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {searchLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              ) : searchError ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-3">{searchError}</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-3">검색 결과가 없습니다 · 승인된 스태프 계정만 찾을 수 있어요</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((staff) => (
                    <div key={staff.uid} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={staff.displayName} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{staff.displayName}</p>
                          <p className="text-xs text-slate-400">@{staff.username}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAssign(staff)}
                        disabled={assigning === staff.uid}
                      >
                        {assigning === staff.uid ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        배정
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Assigned staff list */}
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            배정된 스태프 ({staffList.length}명)
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="animate-spin text-slate-400" />
            </div>
          ) : staffList.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">배정된 스태프가 없습니다</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {staffList.map((staff) => (
                <motion.div
                  key={staff.uid}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={staff.displayName} size="sm" />
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{staff.displayName}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(staff.uid)}
                    disabled={removing === staff.uid}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                    aria-label={`${staff.displayName} 배정 해제`}
                  >
                    {removing === staff.uid ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  );
}
