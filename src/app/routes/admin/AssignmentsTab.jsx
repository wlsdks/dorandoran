import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAssignmentList } from '@/features/assignments/api/useAssignments';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import EmptyState from '@/components/ui/EmptyState';
import AssignmentDetail from '@/features/assignments/components/AssignmentDetail';
import AssignmentCard from './AssignmentCard';
import CreateAssignmentModal from './CreateAssignmentModal';

/**
 * AssignmentsTab — 과제 관리 탭.
 */
export default function AssignmentsTab({ sessions }) {
  const { assignments, loading } = useAssignmentList();
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <AnimatePresence mode="wait">
    {selectedAssignment ? (
      <motion.div
        key="detail"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        <AssignmentDetail
          assignmentId={selectedAssignment}
          onBack={() => setSelectedAssignment(null)}
        />
      </motion.div>
    ) : (
      <motion.div
        key="list"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">과제</h2>
            {assignments.length > 0 && (
              <p className="text-sm text-slate-400 mt-0.5">{assignments.length}개</p>
            )}
          </div>
          <Button onClick={() => setShowCreateModal(true)} variant="primary" size="sm">
            <Plus size={16} />
            과제 등록
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <DoranDoranMascot size="sm" mood="thinking" />
            <p className="text-sm text-slate-400">불러오는 중...</p>
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState
            title="아직 등록된 과제가 없습니다"
            description="과제를 등록하고 학생들의 제출물을 AI로 심사해보세요"
            mascotSize="lg"
            mood="waiting"
            className="py-16"
          />
        ) : (
          <div className="space-y-3">
            {assignments.map(a => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                onClick={() => setSelectedAssignment(a.id)}
              />
            ))}
          </div>
        )}

        <CreateAssignmentModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          sessions={sessions}
        />
      </motion.div>
    )}
    </AnimatePresence>
  );
}
