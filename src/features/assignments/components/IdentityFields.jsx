import { motion, AnimatePresence } from 'framer-motion';

/**
 * 학생 과제 제출 폼의 ID 영역 — 이름 + PIN(조회용 비밀번호) + PIN 확인.
 * isEditMode일 때 이름은 readOnly + PIN 영역 숨김 (기존 PIN 유지).
 */
export default function IdentityFields({
  name,
  onNameChange,
  nameError,
  pin,
  onPinChange,
  pinError,
  pinConfirm,
  onPinConfirmChange,
  isEditMode,
}) {
  return (
    <>
      {/* 이름 */}
      <div>
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">이름</p>
        <input
          type="text"
          value={name}
          onChange={(e) => { if (!isEditMode) onNameChange(e.target.value); }}
          placeholder="이름을 입력하세요"
          maxLength={20}
          readOnly={isEditMode}
          className={`w-full border rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
            nameError
              ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-white dark:bg-slate-800'
              : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
          } ${isEditMode ? 'bg-slate-100 dark:bg-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`}
          autoFocus={!isEditMode}
        />
        {nameError && <p className="text-xs text-red-500 mt-1.5 leading-relaxed">{nameError}</p>}
      </div>

      {/* 조회용 비밀번호 8자리 — 수정 모드에서는 숨김 */}
      {!isEditMode && (
        <div>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">
            조회용 비밀번호
            <span className="text-slate-300 dark:text-slate-500 ml-1.5 font-normal">숫자 8자리</span>
          </p>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="••••••••"
            maxLength={8}
            className={`w-full bg-white dark:bg-slate-800 border rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all tracking-[0.3em] ${
              pinError
                ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
                : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
            }`}
          />
          {pinError && <p className="text-xs text-red-500 mt-1.5">{pinError}</p>}
          <p className="text-xs text-slate-300 dark:text-slate-500 mt-1.5">나중에 본인 제출물 조회·수정·취소 시 필요해요</p>
        </div>
      )}

      {/* 조회용 비밀번호 확인 — 신규 제출 시만 */}
      <AnimatePresence>
        {!isEditMode && pin.length === 8 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">조회용 비밀번호 확인</p>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pinConfirm}
                onChange={(e) => onPinConfirmChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••••••"
                maxLength={8}
                className={`w-full bg-white dark:bg-slate-800 border rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all tracking-[0.3em] ${
                  pinConfirm.length === 4 && pin !== pinConfirm
                    ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              {pinConfirm.length === 4 && pin !== pinConfirm && (
                <p className="text-xs text-red-500 mt-1.5">조회용 비밀번호가 일치하지 않습니다</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
