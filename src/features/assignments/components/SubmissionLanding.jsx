import { motion } from 'framer-motion';
import { Send, Search, Scale, CheckCircle2, Trophy } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Button from '@/components/ui/Button';

/** Landing view for SubmissionPage — shown when view === 'landing'. */
export default function SubmissionLanding({
  assignment,
  isOpen,
  isJudged,
  isJudging,
  isClosed,
  awards,
  lookupName,
  lookupPin,
  resultLookupError,
  resultLookupLoading,
  onLookupNameChange,
  onLookupPinChange,
  onResultLookup,
  onSubmit,
  onLookup,
  onAwardsView,
}) {
  return (
    <>
      {/* Open: 제출 or 조회 */}
      {isOpen && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100dvh - 160px)' }}>
          <div className="w-full space-y-6">
            {/* 마스코트 + 과제 안내 */}
            <div className="flex flex-col items-center">
              <DoranDoranMascot size="lg" mood="happy" />
              {assignment.description && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 mt-5 w-full">
                  <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {assignment.description}
                  </p>
                  {assignment.hasJudging !== false && (
                    <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
                      <Scale size={11} />
                      제출 후 AI 심사위원 7명이 평가합니다
                    </p>
                  )}
                </div>
              )}
              {!assignment.description && assignment.hasJudging !== false && (
                <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
                  <Scale size={11} />
                  제출 후 AI 심사위원 7명이 평가합니다
                </p>
              )}
            </div>

            {/* CTA 버튼 */}
            <div className="space-y-3">
              <Button onClick={onSubmit} variant="primary" size="lg" className="w-full">
                <Send size={16} />
                과제 제출하기
              </Button>
              <Button onClick={onLookup} variant="secondary" size="lg" className="w-full">
                <Search size={16} />
                내 제출물 조회
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Judged: 결과 확인 + 시상 보기 */}
      {isJudged && (
        <div className="flex flex-col justify-center" style={{ minHeight: 'calc(100dvh - 160px)' }}>
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-white dark:text-slate-900" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-5">심사가 완료되었습니다</h2>
            <p className="text-sm text-slate-400 mt-1.5">이름과 조회용 비밀번호로 내 결과를 확인하세요</p>
          </div>

          <div className="space-y-3 mt-8">
            <input
              type="text"
              value={lookupName}
              onChange={(e) => onLookupNameChange(e.target.value)}
              placeholder="이름"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              autoFocus
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={lookupPin}
              onChange={(e) => onLookupPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="조회용 비밀번호 (숫자 4자리)"
              maxLength={4}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onResultLookup()}
              className={`w-full bg-white dark:bg-slate-800 border rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all tracking-[0.3em] ${
                resultLookupError ? 'border-red-400 focus:ring-red-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
              }`}
            />
            {resultLookupError && <p className="text-xs text-red-500">{resultLookupError}</p>}
            <Button
              onClick={onResultLookup}
              variant="primary"
              size="lg"
              disabled={!lookupName.trim() || lookupPin.length !== 4 || resultLookupLoading}
              className="w-full"
            >
              {resultLookupLoading ? '조회 중...' : '내 결과 확인'}
            </Button>
          </div>

          {/* 시상 결과 보기 */}
          {awards && Object.keys(awards).length > 0 && (
            <button
              onClick={onAwardsView}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <Trophy size={14} />
              <span className="underline underline-offset-2">시상 결과 보기</span>
            </button>
          )}
        </div>
      )}

      {/* Judging: 심사 중 */}
      {isJudging && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100dvh - 160px)' }}>
          <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
            <DoranDoranMascot size="lg" mood="happy" />
          </motion.div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-6">심사가 진행 중입니다</h2>
          <p className="text-sm text-slate-400 mt-2 text-center leading-relaxed">
            심사가 완료되면<br />이 페이지에서 결과를 확인할 수 있어요
          </p>
        </div>
      )}

      {/* Closed: 마감 */}
      {isClosed && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100dvh - 160px)' }}>
          <DoranDoranMascot size="lg" mood="waiting" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-6">과제가 마감되었습니다</h2>
          <p className="text-sm text-slate-400 mt-2 text-center leading-relaxed">
            심사 결과가 나오면<br />이 페이지에서 확인할 수 있어요
          </p>
          <div className="w-full mt-8">
            <Button onClick={onLookup} variant="secondary" size="lg" className="w-full">
              <Search size={16} />
              내 제출물 조회
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
