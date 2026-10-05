import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Copy, Plus, Loader2, IdCard, Gift, Eye } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * 세션 옵션 토글 한 줄 — 아이콘 + 제목/설명 + 스위치. 옵션이 늘어도 모양이 갈리지 않게 한 곳에 둔다.
 * onPreview가 있으면 '설명 보기'가 붙는다. 토글 영역과 겹치지 않게 스위치 아래 줄에 둔다.
 */
function ModeToggle({
  icon: Icon,
  title,
  description,
  on,
  onToggle,
  onPreview
}) {
  return <div className={`rounded-xl border transition-colors duration-150 ${on ? 'border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-700' : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'}`}>
      <button onClick={onToggle} role="switch" aria-checked={on} className="w-full flex items-center gap-3 p-3 text-left active:scale-[0.98] transition-transform duration-150">
        <Icon size={16} className={on ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${on ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {title}
          </p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
        <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${on ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-600'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${on ? 'left-4' : 'left-0.5'}`} />
        </div>
      </button>
      {onPreview && <button onClick={onPreview} className="w-full flex items-center justify-center gap-1 px-3 pb-2.5 -mt-1 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors duration-150">
          <Eye size={12} />
          설명 보기
        </button>}
    </div>;
}
export default function CreateSessionStepConfirm({
  selectedCourse,
  roundNumber,
  onSetRoundNumber,
  previousRounds,
  duplicateEnabled,
  onToggleDuplicate,
  duplicateSourceId,
  onSetDuplicateSourceId,
  requireEmployeeId,
  onToggleEmployeeId,
  drawOnly,
  onToggleDrawOnly,
  onPreviewMode,
  error,
  creating,
  onBack,
  onCreate
}) {
  return <motion.div key="confirm" initial={{
    opacity: 0,
    x: 12
  }} animate={{
    opacity: 1,
    x: 0
  }} exit={{
    opacity: 0,
    x: 12
  }} transition={{
    duration: 0.2
  }} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">클래스 확인</h2>
        <p className="text-slate-400 text-sm mt-1">정보를 확인하고 등록하세요</p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 text-sm">강의</span>
          <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{selectedCourse}</span>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-600" />
        <div className="flex items-center justify-between">
          <span className="text-slate-500 text-sm">차수</span>
          <div className="flex items-center gap-2">
            <button onClick={() => onSetRoundNumber(Math.max(1, roundNumber - 1))} aria-label="차수 줄이기" className="w-7 h-7 max-sm:w-11 max-sm:h-11 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors duration-150 active:scale-90 text-sm font-medium">
              -
            </button>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-lg w-10 text-center">{roundNumber}</span>
            <button onClick={() => onSetRoundNumber(roundNumber + 1)} aria-label="차수 늘리기" className="w-7 h-7 max-sm:w-11 max-sm:h-11 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors duration-150 active:scale-90 text-sm font-medium">
              +
            </button>
            <span className="text-slate-400 text-sm">차</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {/* 기업 행사모드 — 켜면 학생 입장 시 사번(직원번호) 필수 입력 */}
        <ModeToggle icon={IdCard} title="기업 행사모드" description="입장 시 사번(직원번호)을 필수로 받습니다" on={requireEmployeeId} onToggle={onToggleEmployeeId} onPreview={() => onPreviewMode('requireEmployeeId')} />

        {/* 추첨 전용 모드 — 참여자 입장이 없는 행사용. 명단은 강사가 직접 넣는다 */}
        <ModeToggle icon={Gift} title="추첨 전용 모드" description="참여자 입장 없이, 명단을 직접 입력해 추첨만 진행합니다" on={drawOnly} onToggle={onToggleDrawOnly} onPreview={() => onPreviewMode('drawOnly')} />
      </div>

      {previousRounds.length > 0 && <div className="space-y-3">
          <ModeToggle icon={Copy} title="이전 차수 복제" description="질문 목록을 복사하여 새 클래스에 추가합니다" on={duplicateEnabled} onToggle={onToggleDuplicate} />

          <AnimatePresence>
            {duplicateEnabled && <motion.div initial={{
          opacity: 0,
          height: 0
        }} animate={{
          opacity: 1,
          height: 'auto'
        }} exit={{
          opacity: 0,
          height: 0
        }} transition={{
          duration: 0.2
        }} className="overflow-hidden">
                <div className="space-y-1.5">
                  {previousRounds.map(s => <button key={s.id} onClick={() => onSetDuplicateSourceId(s.id)} className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors duration-150 active:scale-[0.98] text-sm ${duplicateSourceId === s.id ? 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 shadow-sm' : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'}`}>
                      <span className={`font-medium ${duplicateSourceId === s.id ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
                        {s.roundNumber ? `${s.roundNumber}차` : s.id}
                      </span>
                      <span className="text-xs text-slate-400">{s.questionCount}개 질문</span>
                    </button>)}
                </div>
              </motion.div>}
          </AnimatePresence>
        </div>}

      <AnimatePresence>
        {error && <motion.p initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} className="text-red-500 text-sm flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </motion.p>}
      </AnimatePresence>

      <div className="flex gap-2">
        <Button onClick={onBack} variant="secondary" size="md" className="flex-1">
          뒤로
        </Button>
        <Button onClick={onCreate} variant="primary" size="md" className="flex-1" disabled={creating}>
          {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          {creating ? '등록 중...' : '클래스 등록'}
        </Button>
      </div>
    </motion.div>;
}
