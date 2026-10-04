import { memo } from 'react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { CourseGroup, UngroupedSessions } from './SessionList';
import SessionSearchFilter from './SessionSearchFilter';
import { Plus } from 'lucide-react';

export default memo(function ClassesTab({
  loading,
  isStaff,
  sessions,
  displaySessions,
  filteredSessions,
  courseGroups,
  ungrouped,
  isFiltering,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onNewClass,
  onSelect,
  onDeleteRequest,
  onDuplicate,
  onClearFilter,
  adminUser,
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-shimmer">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-40" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12" />
            </div>
            <div className="flex gap-4 mb-3">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16" />
              <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded mt-3" />
            </div>
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displaySessions.length === 0) {
    if (isStaff) {
      return (
        <EmptyState
          title="진행 중인 수업이 없습니다"
          description="강사가 수업을 시작하면 여기에 표시됩니다"
          mascotSize="lg"
          className="py-12"
        />
      );
    }
    return (
      <>
        <div className="flex justify-end">
          <Button onClick={onNewClass} variant="secondary" size="sm">
            <Plus size={16} />새 클래스
          </Button>
        </div>
        <EmptyState
          title="첫 클래스를 만들어보세요"
          description="도란도란과 함께 학생 참여를 이끌어보세요"
          steps={['위의 버튼으로 클래스를 만드세요', '객관식, 퀴즈, 워드클라우드 등 질문을 추가하세요', 'QR코드를 공유하면 학생들이 바로 참여합니다']}
          mascotSize="lg"
          mood="happy"
          className="py-12"
        />
      </>
    );
  }

  return (
    <>
      {!isStaff && sessions.length >= 3 ? (
        <SessionSearchFilter
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          statusFilter={statusFilter}
          onStatusChange={onStatusChange}
          actionSlot={
            <Button onClick={onNewClass} variant="secondary" size="sm" className="shrink-0 !py-2.5">
              <Plus size={16} />새 클래스
            </Button>
          }
        />
      ) : !isStaff && (
        <div className="flex justify-end">
          <Button onClick={onNewClass} variant="secondary" size="sm">
            <Plus size={16} />새 클래스
          </Button>
        </div>
      )}

      {isFiltering && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {filteredSessions.length > 0 ? `${filteredSessions.length}개 세션` : '검색 결과 없음'}
          </p>
          <button
            onClick={onClearFilter}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
          >
            초기화
          </button>
        </div>
      )}

      {filteredSessions.length === 0 && isFiltering ? (
        <EmptyState
          title="검색 결과가 없습니다"
          description={searchQuery ? `"${searchQuery}"에 해당하는 클래스가 없어요` : '해당 상태의 세션이 없어요'}
          className="py-8"
        />
      ) : (
        <div className="space-y-4">
          {courseGroups.map(([name, list], gi) => {
            // Get courseId from the first session that has one
            const courseId = list.find((s) => s.courseId)?.courseId || null;
            const canManageStaff = !isStaff && (adminUser?.role === 'master' || adminUser?.role === 'admin');
            return (
              <CourseGroup
                key={name}
                name={name}
                sessions={list}
                onSelect={onSelect}
                onDelete={onDeleteRequest}
                onDuplicate={onDuplicate}
                startIndex={gi * 10}
                groupIndex={gi}
                hideActions={isStaff}
                courseId={courseId}
                canManageStaff={canManageStaff}
              />
            );
          })}
          <UngroupedSessions
            sessions={ungrouped}
            onSelect={onSelect}
            onDelete={onDeleteRequest}
            onDuplicate={onDuplicate}
            startIndex={courseGroups.length * 10}
            groupIndex={courseGroups.length}
            hideActions={isStaff}
          />
        </div>
      )}
    </>
  );
});
