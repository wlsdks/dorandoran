import { useState, useEffect, useRef } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getParticipantId, getNickname, setNickname as saveNickname, getSessionNickname, getSessionEmployeeId } from '@/lib/participant';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 10;
const EMPLOYEE_ID_MAX = 20;
const FORM_ID = 'join-form';

/** Fetch session course name + 행사모드(사번 필수) flag for display (lightweight one-time read). */
function useSessionInfo(sessionId) {
  const [courseName, setCourseName] = useState(null);
  const [requireEmployeeId, setRequireEmployeeId] = useState(false);
  // 추첨 전용 세션 — 입장을 막는다. 들어온 사람이 그대로 추첨 대상이 되어 명단을 오염시키기 때문.
  const [drawOnly, setDrawOnly] = useState(false);
  // null=확인 중, true/false=판정 — 오타 코드로 조인하면 유령 세션이 생기고 무한 대기하므로 사전 차단
  const [exists, setExists] = useState(null);
  useEffect(() => {
    if (!sessionId) return;
    get(ref(db, `sessions/${sessionId}/courseName`))
      .then((snap) => setCourseName(snap.val() || null))
      .catch(() => {});
    get(ref(db, `sessions/${sessionId}/requireEmployeeId`))
      .then((snap) => setRequireEmployeeId(snap.val() === true))
      .catch(() => {});
    get(ref(db, `sessions/${sessionId}/drawOnly`))
      .then((snap) => setDrawOnly(snap.val() === true))
      .catch(() => {});
    get(ref(db, `sessions/${sessionId}/createdAt`))
      .then((snap) => setExists(snap.exists()))
      .catch(() => setExists(true)); // 네트워크 오류로 확인 불가 시엔 낙관적으로 통과
  }, [sessionId]);
  return { courseName, requireEmployeeId, drawOnly, exists };
}

/**
 * Detects keyboard open state via visualViewport API.
 * Returns true when virtual keyboard is likely visible (viewport shrinks > 120px).
 *
 * 모바일 viewport(<768px)에서만 작동. 데스크톱/태블릿에서 브라우저 창 크기 줄이면
 * height 감소를 키보드로 오인해 hero가 collapse되던 false positive 회피.
 */
function useKeyboardDetect() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    const vv = window.visualViewport;
    if (!vv) return;
    // Capture baseline after initial render (avoids false positive on load)
    let baseline = null;
    const t = setTimeout(() => { baseline = vv.height; }, 300);
    function handleResize() {
      if (baseline === null) return;
      setKeyboardOpen(baseline - vv.height > 120);
    }
    vv.addEventListener('resize', handleResize);
    return () => { clearTimeout(t); vv.removeEventListener('resize', handleResize); };
  }, []);
  return keyboardOpen;
}

export default function JoinPage({ sessionId, onJoin }) {
  const [nickname, setNickname] = useState(() => getSessionNickname(sessionId) || getNickname());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);
  // 사번(선택) — 기본 닫힘. 이전에 입력했으면 펼친 채로 복원.
  const [employeeId, setEmployeeId] = useState(() => getSessionEmployeeId(sessionId));
  const [showEmployeeId, setShowEmployeeId] = useState(() => !!getSessionEmployeeId(sessionId));
  const inputRef = useRef(null);
  const inputWrapRef = useRef(null);
  const { courseName, requireEmployeeId, drawOnly, exists } = useSessionInfo(sessionId);
  const keyboardOpen = useKeyboardDetect();

  const trimmed = nickname.trim();
  const tooShort = touched && trimmed.length > 0 && trimmed.length < NICKNAME_MIN;
  const nicknameValid = trimmed.length >= NICKNAME_MIN;
  // 기업 행사모드: 사번 필수. 그 외: 선택.
  const employeeOk = !requireEmployeeId || employeeId.trim().length > 0;
  const isValid = nicknameValid; // 닉네임 유효(아바타 미리보기용)
  const canJoin = nicknameValid && employeeOk; // 입장 가능 = 닉네임 + (필수 시)사번

  // 행사모드(사번 필수)면 입력창을 자동으로 펼침
  useEffect(() => {
    if (requireEmployeeId) setShowEmployeeId(true);
  }, [requireEmployeeId]);

  // Reliable autoFocus for mobile browsers (slight delay for page transition)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  // When keyboard opens, scroll input into view
  function handleInputFocus() {
    setTimeout(() => {
      inputWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!canJoin || exists === false || drawOnly) return;
    setJoining(true);
    setError(null);
    // presence 기록(participant 노드 + onDisconnect)은 App.jsx의 syncPresence가 일원화 담당.
    // 여기서 직접 write하지 않아 (1) join 시 중복 full-set 제거, (2) 약한 네트워크에서
    // write를 await하다 "입장 중…"에 무한 대기하던 문제를 피한다(낙관적 입장).
    const participantId = getParticipantId();
    saveNickname(trimmed);
    onJoin(participantId, trimmed, employeeId.trim());
  }

  // 존재하지 않는 세션 코드 — 참여를 막고 코드 재확인 안내 (유령 세션 생성 방지)
  if (exists === false) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center space-y-4 max-w-sm"
        >
          <div className="flex justify-center"><DoranDoranMascot size="md" mood="sad" /></div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">세션을 찾을 수 없어요</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              입력하신 코드 <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{sessionId}</span>에 해당하는 세션이 없습니다.
              <br />세션 코드를 다시 확인해주세요.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // 추첨 전용 세션 — 입장한 사람이 곧 추첨 대상이 되므로 링크를 열어도 참여를 막는다.
  if (drawOnly) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center space-y-4 max-w-sm"
        >
          <div className="flex justify-center"><DoranDoranMascot size="md" mood="waiting" /></div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">추첨 전용 세션이에요</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              이 세션은 진행자가 명단으로 추첨만 진행합니다.
              <br />앞 화면에서 결과를 확인해주세요.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-5 pt-[14vh] pb-32">
        <div className="w-full max-w-sm">
          {/* Header — collapses when keyboard is open to maximize input visibility */}
          <motion.div
            animate={keyboardOpen
              ? { opacity: 0, height: 0, marginBottom: 0 }
              : { opacity: 1, height: 'auto', marginBottom: 32 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="text-center space-y-3 overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, y: [0, -3, 0] }}
              transition={{
                scale: { type: 'spring', stiffness: 300, damping: 25, delay: 0.1 },
                opacity: { duration: 0.3, delay: 0.1 },
                y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 },
              }}
              className="flex justify-center mb-1"
            >
              <DoranDoranMascot size="md" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">도란도란</h1>
              <p className={`text-sm mt-1.5 ${courseName ? 'text-slate-500 dark:text-slate-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                {courseName || '닉네임을 정하고 참여하세요'}
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
              {sessionId}
            </span>
          </motion.div>

          {/* Compact header shown when keyboard is open */}
          <motion.div
            animate={keyboardOpen
              ? { opacity: 1, height: 'auto', marginBottom: 20 }
              : { opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">도란도란</span>
              {courseName && (
                <span className="text-sm text-slate-400 dark:text-slate-500 truncate">{courseName}</span>
              )}
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-medium">{sessionId}</span>
            </div>
          </motion.div>

          {/* Form */}
          <form id={FORM_ID} onSubmit={handleJoin}>
            {/* Input with inline avatar preview */}
            <div ref={inputWrapRef} className="space-y-3">
              <div className="relative">
                {/* Avatar floats left when nickname is valid */}
                <AnimatePresence>
                  {isValid && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
                    >
                      <Avatar name={trimmed} size="sm" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.input
                  ref={inputRef}
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (!touched) setTouched(true);
                    if (error) setError(null);
                  }}
                  onFocus={handleInputFocus}
                  onBlur={() => setTouched(true)}
                  placeholder="닉네임 입력"
                  aria-label="닉네임"
                  aria-invalid={tooShort || !!error}
                  maxLength={NICKNAME_MAX}
                  autoComplete="off"
                  enterKeyHint="go"
                  animate={isValid ? { paddingLeft: '3rem' } : { paddingLeft: '1rem' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className={`w-full bg-white dark:bg-slate-800 border rounded-2xl pr-4 py-4 text-lg text-center text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-700 transition-colors duration-150 ${
                    tooShort || error
                      ? 'border-red-300 focus:ring-red-500/15 focus:border-red-400'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400'
                  }`}
                />
              </div>

              {/* Helper row: hint/error + char count */}
              <div className="flex items-center justify-between px-1 min-h-[18px]">
                <AnimatePresence mode="wait">
                  {tooShort || error ? (
                    <motion.span
                      key="error"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ duration: 0.15 }}
                      className="text-xs text-red-400"
                      role="alert"
                    >
                      {error || `${NICKNAME_MIN}자 이상 입력해주세요`}
                    </motion.span>
                  ) : (
                    <motion.span
                      key={isValid ? 'ready' : 'hint'}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`text-xs ${isValid ? 'text-emerald-500 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                      {isValid ? '참여 준비 완료' : '2~10자로 입력해주세요'}
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className={`text-xs tabular-nums transition-colors duration-150 ${
                  trimmed.length >= NICKNAME_MAX ? 'text-amber-500 font-medium' : 'text-slate-300 dark:text-slate-600'
                }`}>
                  {trimmed.length}/{NICKNAME_MAX}
                </span>
              </div>

              {/* 사번 입력 — 행사모드면 필수(항상 표시), 아니면 선택(토글). */}
              <div className="pt-0.5">
                {!showEmployeeId ? (
                  <button
                    type="button"
                    onClick={() => setShowEmployeeId(true)}
                    className="w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1.5"
                  >
                    + 사번 입력하기 <span className="text-slate-300 dark:text-slate-600">(선택)</span>
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="overflow-hidden space-y-1.5 pt-1"
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      onFocus={handleInputFocus}
                      placeholder={requireEmployeeId ? '사번 입력 (필수)' : '사번 입력 (선택)'}
                      aria-label={requireEmployeeId ? '사번 (필수)' : '사번 (선택사항)'}
                      aria-required={requireEmployeeId}
                      maxLength={EMPLOYEE_ID_MAX}
                      autoComplete="off"
                      className={`w-full bg-white dark:bg-slate-800 border rounded-2xl px-4 py-3.5 text-base text-center text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-2 transition-colors duration-150 ${
                        requireEmployeeId && touched && employeeId.trim().length === 0
                          ? 'border-red-300 focus:ring-red-500/15 focus:border-red-400'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400'
                      }`}
                    />
                    <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
                      {requireEmployeeId
                        ? '이 행사는 사번 입력이 필요해요'
                        : '선택사항이에요 — 입력하지 않아도 참여할 수 있어요'}
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Sticky bottom CTA — always in thumb zone, respects safe-area.
          gradient 배경으로 스크롤 텍스트가 버튼 뒤로 비쳐 읽힘 저하되는 것 방지 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.15 }}
        className="sticky bottom-0 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-50 dark:from-slate-900 via-slate-50/95 dark:via-slate-900/95 to-transparent"
      >
        <div className="max-w-sm mx-auto">
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            size="lg"
            disabled={!canJoin || joining}
            className="w-full rounded-2xl shadow-lg"
          >
            {joining ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                입장 중...
              </>
            ) : (
              <>
                참여하기
                <ArrowRight size={18} />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
