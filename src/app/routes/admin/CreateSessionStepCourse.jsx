import { motion } from 'framer-motion';
import { BookOpen, Plus, ChevronRight } from 'lucide-react';

export default function CreateSessionStepCourse({ courses, onSelectCourse, onNewCourse }) {
  return (
    <motion.div
      key="course"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">새 클래스 등록</h2>
        <p className="text-slate-400 text-sm mt-1">강의를 선택하세요</p>
      </div>

      {/* 강의가 몇 개든 팝업 높이는 고정 — 목록만 안에서 스크롤된다 */}
      <div className="space-y-2 max-h-[52dvh] overflow-y-auto overscroll-contain -mx-1 px-1">
        {courses.map((course) => (
          <button
            key={course.name}
            onClick={() => onSelectCourse(course)}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 hover:shadow-sm transition-colors duration-150 active:scale-[0.98] text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 flex items-center justify-center">
                <BookOpen size={18} className="text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{course.name}</p>
                <p className="text-slate-400 text-xs">{course.count}개 차수 진행</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors duration-150" />
          </button>
        ))}

      </div>

      <div>
        <button
          onClick={onNewCourse}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 active:scale-[0.98] text-left"
        >
          <div className="w-6 flex items-center justify-center">
            <Plus size={18} className="text-slate-400" />
          </div>
          <p className="font-medium text-slate-500 text-sm">새 강의 만들기</p>
        </button>
      </div>
    </motion.div>
  );
}
