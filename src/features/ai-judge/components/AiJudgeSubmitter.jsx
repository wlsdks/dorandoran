import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState, useEffect, useRef, useId, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, Send, Trophy, Trash2, Edit3, AlertCircle, Image as ImageIcon, Code2, Upload, Lightbulb } from 'lucide-react';
import Button from '@/components/ui/Button';
import ImageUpload from '@/components/ui/ImageUpload';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { getParticipantId, getSessionNickname } from '@/lib/participant';
import { useMySubmission, useSubmitLive, useLiveJudgeResults } from '../api/useLiveJudging';
import LiveResultHero from './LiveResultHero';

/**
 * AiJudgeSubmitter — 학생용 AI 심사 제출 폼.
 * 질문 활성화 중: 이미지/제목/설명 제출 (재제출 허용).
 * 심사 완료 시: 본인 결과 + TOP 3 확인.
 */
export default memo(function AiJudgeSubmitter({ sessionId, questionId, disabled }) {
  const fieldId = useId();
  const reducedMotion = useReducedMotion();
  const { available } = useAIAvailability();
  const participantId = getParticipantId();
  const nickname = getSessionNickname(sessionId) || '익명';
  const submission = useMySubmission(sessionId, questionId, participantId);
  const { submit, withdraw } = useSubmitLive(sessionId, questionId);
  const { top3, judgeState, results } = useLiveJudgeResults(sessionId, questionId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [code, setCode] = useState('');
  const [submitTab, setSubmitTab] = useState('image'); // 'image' | 'code'
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [codeFileName, setCodeFileName] = useState(''); // HTML 파일 업로드 시 파일명 표시
  const fileInputRef = useRef(null);
  const errorTimerRef = useRef(null);

  // 에러 표시 + 자동 해제를 단일 타이머로 — 5곳 중복 + 언마운트 미정리 해소.
  function showError(msg, ms = 3500) {
    setSubmitError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setSubmitError(null), ms);
  }
  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  // HTML 파일 업로드 — 시스템 파일 선택 다이얼로그 → 텍스트 읽어 code state로.
  // 50KB 초과 시 앞부분만 가져오고 경고.
  async function handleFileUpload(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    // MIME이 안정적이지 않으니 확장자 + 크기만 1차 체크
    const isHtml = /\.(html|htm)$/i.test(file.name);
    if (!isHtml) {
      showError('HTML 파일(.html, .htm)만 업로드할 수 있어요');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    try {
      const text = await file.text();
      const truncated = text.slice(0, 100000);
      setCode(truncated);
      setCodeFileName(file.name);
      if (text.length > 100000) {
        showError(`파일이 100KB를 초과해 앞부분만 사용됩니다 (${Math.round(text.length / 1024)}KB)`, 4000);
      }
    } catch (err) {
      showError(err?.message || '파일 읽기 실패');
    } finally {
      // 같은 파일 다시 선택 가능하도록 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  useEffect(() => {
    if (submission && !editing) {
      setTitle(submission.title || '');
      setDescription(submission.description || '');
      setImageUrl(submission.imageUrl || '');
      setCode(submission.code || '');
      // 기존 제출물 형태에 맞춰 탭 자동 선택
      if (submission.code && !submission.imageUrl) setSubmitTab('code');
    }
  }, [submission, editing]);

  const hasSubmitted = !!submission;
  const isJudging = judgeState?.status === 'judging';
  const isDone = judgeState?.status === 'done';
  const myResult = results?.[participantId];
  const submissionLocked = isJudging || isDone;

  // 이미지 또는 코드 중 하나라도 있으면 제출 가능
  const hasContent = !!imageUrl || !!code.trim();
  const canSubmit = hasContent && !submitting && !disabled && !submissionLocked;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submit(participantId, {
        name: nickname,
        title: title.trim(),
        description: description.trim(),
        imageUrl,
        code: code.trim(),
      });
      setEditing(false);
    } catch (err) {
      showError(err?.message || '제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdrawConfirmed() {
    setWithdrawConfirmOpen(false);
    try {
      await withdraw(participantId);
      setTitle(''); setDescription(''); setImageUrl(''); setCode('');
      setEditing(false);
    } catch {
      showError('제출 취소에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  // 심사 완료 후: 결과 화면 (TOP 공개는 강사 제어에 따라 단계적)
  if (available && isDone && top3) {
    return (
      <motion.div
        key="result"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <LiveResultHero
          top3={top3}
          myParticipantId={participantId}
          myResult={myResult}
          mySubmission={submission}
          revealedUpTo={judgeState?.revealedUpTo ?? 0}
          results={results}
        />
      </motion.div>
    );
  }

  // 심사 중 — 학생 폰 화면. 현재 누가 심사 중인지 + 내 차례까지 N건 안내.
  if (available && isJudging) {
    const cur = judgeState?.current || 0;
    const total = judgeState?.total || 0;
    const pct = total ? Math.min(100, (cur / total) * 100) : 0;
    const currentName = judgeState?.currentName;
    const isMyTurn = currentName && currentName === nickname;
    // 본인이 아직 심사 안 받았으면 "내 차례까지 약 N건" 추정 — 정확한 위치는 모르나 평균적으로 남은건/2
    const remaining = total > cur ? Math.max(0, total - cur) : 0;

    return (
      <motion.div
        role="status"
        aria-live="polite"
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
      >
        {submission?.imageUrl && (
          <motion.img
            src={submission.imageUrl}
            alt="내 제출물"
            className="w-full max-h-40 object-cover"
            animate={isMyTurn && !reducedMotion ? { scale: [1, 1.02, 1] } : { scale: 1 }}
            transition={isMyTurn ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
          />
        )}
        <div className="p-6 text-center space-y-4">
          {/* 두근거리는 sparkle — 본인 차례엔 indigo로 강조 + scale pulse */}
          <motion.div
            animate={reducedMotion ? { rotate: 0, scale: 1 } : isMyTurn
              ? { rotate: 360, scale: [1, 1.15, 1] }
              : { rotate: 360 }}
            transition={isMyTurn
              ? { rotate: { duration: 1.5, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } }
              : { duration: 2, repeat: Infinity, ease: 'linear' }}
            className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
              isMyTurn ? 'bg-indigo-500 ring-4 ring-indigo-200 dark:ring-indigo-500/30' : 'bg-slate-900 dark:bg-slate-100'
            }`}
          >
            <Lightbulb size={24} className="text-white dark:text-slate-900" />
          </motion.div>

          <div>
            <p className="text-slate-900 dark:text-slate-100 text-lg font-bold">
              {isMyTurn ? '지금 내 작품 심사 중!' : 'AI 심사 진행 중'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {total > 0 ? (
                <>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{cur}</span>
                  <span> / {total}명 심사 완료</span>
                </>
              ) : '곧 결과가 공개됩니다'}
            </p>
          </div>

          {/* 진행률 바 */}
          {total > 0 && (
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-slate-900 dark:bg-slate-100 rounded-full"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          )}

          {/* 현재 심사 중인 학생 + 남은 건수 */}
          {currentName && !isMyTurn && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              지금 <span className="font-semibold text-slate-700 dark:text-slate-200">{currentName}</span>님 심사 중 · 남은 약 {remaining}건
            </p>
          )}

          {submission?.title && (
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
              내 제출: {submission.title}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // 제출 완료 상태 (편집 아님)
  if (hasSubmitted && !editing) {
    return (
      <>
      <motion.div
        role="status"
        aria-live="polite"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
      >
        {submission.imageUrl && (
          <img src={submission.imageUrl} alt="내 제출물" className="w-full max-h-60 object-cover" />
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
              <Check size={13} className="text-white dark:text-slate-900" />
            </div>
            <p className="text-slate-900 dark:text-slate-100 font-semibold">제출 완료</p>
            {submission.code && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                <Code2 size={10} /> 코드 포함
              </span>
            )}
          </div>
          {submission.title && (
            <p className="text-slate-700 dark:text-slate-200 text-base font-medium">{submission.title}</p>
          )}
          {submission.description && (
            <p className="text-slate-500 dark:text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">{submission.description}</p>
          )}
          {submission.code && !submission.imageUrl && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                제출한 코드 보기 ({submission.code.length.toLocaleString()}자)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                {submission.code.slice(0, 2000)}{submission.code.length > 2000 && '\n...'}
              </pre>
            </details>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={() => setEditing(true)} disabled={submissionLocked || disabled} variant="secondary" size="md" className="flex-1 min-h-[44px]">
              <Edit3 size={15} /> 수정
            </Button>
            <button
              onClick={() => setWithdrawConfirmOpen(true)}
              aria-label="제출 취소"
              disabled={submissionLocked || disabled}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <Trash2 size={14} /> 취소
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center pt-1">{submissionLocked ? available ? '심사가 시작되어 수정할 수 없어요.' : isDone ? '제출이 마감됐어요.' : '제출 내용을 확인하고 있어요.' : available ? '심사 시작 전까지 수정 가능' : '마감 전까지 제출 내용을 수정할 수 있어요.'}</p>
        </div>
      </motion.div>

      {/* 취소 확인 다이얼로그 — 제출 완료 상태에서 취소 버튼 눌렀을 때 보여야 함 */}
      <ConfirmModal
        open={withdrawConfirmOpen}
        onCancel={() => setWithdrawConfirmOpen(false)}
        onConfirm={handleWithdrawConfirmed}
        title="제출을 취소할까요?"
        description="업로드한 이미지와 내용이 모두 삭제됩니다."
        confirmLabel="제출 취소"
        variant="danger"
      />
      </>
    );
  }

  // 제출 폼
  return (
    <>
    <motion.form
      onSubmit={handleSubmit}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-slate-500 dark:text-slate-300" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">내 자료 제출</h3>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 [word-break:keep-all]">이미지 또는 HTML 코드 중 하나를 첨부해주세요. 제목과 설명은 선택사항입니다.</p>
      </div>

      {/* 제출 방식 탭 — 이미지 | 코드 */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg" role="tablist" aria-label="필수 제출 자료 방식">
        <button
          type="button"
          role="tab"
          aria-selected={submitTab === 'image'}
          onClick={() => setSubmitTab('image')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 py-2 rounded-md text-sm font-semibold transition-colors ${
            submitTab === 'image'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ImageIcon size={18} /> 이미지
          {imageUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-label="첨부됨" />}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={submitTab === 'code'}
          onClick={() => setSubmitTab('code')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 py-2 rounded-md text-sm font-semibold transition-colors ${
            submitTab === 'code'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Code2 size={18} /> HTML 코드
          {code.trim() && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-label="입력됨" />}
        </button>
      </div>

      {submitTab === 'image' ? (
        <div>
          <ImageUpload value={imageUrl} onChange={setImageUrl} folder={`ai-judge/${sessionId}/${questionId}`} uploadLabel="이미지 첨부" />
          {!hasContent && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">스크린샷이나 사진을 첨부하거나, HTML 코드 탭에서 자료를 넣어주세요.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* 파일 업로드 버튼 — 시스템 파일 선택기로 .html 첨부 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            >
              <Upload size={18} /> HTML 파일 선택
            </button>
            {codeFileName && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <Check size={12} className="text-emerald-500 shrink-0" />
                <span className="truncate">{codeFileName}</span>
              </span>
            )}
            {/* sr-only — display:none이면 일부 Safari에서 click() 차단 사례가 있어 visually hidden 패턴 사용 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={handleFileUpload}
              className="sr-only"
              aria-label="HTML 파일 업로드"
            />
          </div>
          <textarea
            value={code}
            onChange={(e) => { setCode(e.target.value); if (codeFileName) setCodeFileName(''); }}
            placeholder={`파일을 선택하거나 직접 붙여넣으세요\n\n<!DOCTYPE html>\n<html>\n  <body>\n    <!-- HTML/CSS/JS -->\n  </body>\n</html>`}
            aria-label="HTML 코드"
            rows={10}
            maxLength={100000}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3.5 py-2.5 text-base font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>파일 업로드 또는 직접 붙여넣기</span>
            <span className="tabular-nums">{code.length.toLocaleString()}/100,000</span>
          </div>
        </div>
      )}

      <div>
        <label htmlFor={`${fieldId}-title`} className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">제목 <span className="font-normal">(선택)</span></label>
        <input
          id={`${fieldId}-title`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="작품 제목"
          aria-label="작품 제목"
          maxLength={40}
          className="w-full min-h-12 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3.5 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor={`${fieldId}-description`} className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">설명 <span className="font-normal">(선택)</span></label>
        <textarea
          id={`${fieldId}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="이 작품이 어떤 건지 짧게 설명해주세요"
          aria-label="작품 설명"
          rows={3}
          maxLength={300}
          className="w-full min-h-12 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3.5 py-2.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-relaxed"
        />
      </div>

      {available && title.trim() === '' && imageUrl && (
        <p className="text-xs text-slate-400 text-center">제목·설명을 적으면 더 구체적인 심사평을 받을 수 있어요</p>
      )}

      <AnimatePresence>
        {submitError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            className="text-red-500 text-xs flex items-center gap-1.5"
          >
            <AlertCircle size={13} /> {submitError}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="text-sm text-slate-500 dark:text-slate-400" role="status">{hasContent ? '자료가 준비되었어요. 제출할 수 있습니다.' : '이미지 또는 HTML 코드를 넣으면 제출할 수 있어요.'}</p>
      <div className="flex gap-2">
        {editing && (
          <Button type="button" onClick={() => setEditing(false)} variant="secondary" size="md" className="flex-1">
            취소
          </Button>
        )}
        <Button type="submit" variant="primary" size="md" disabled={!canSubmit} className="flex-[2]">
          {submitting ? '제출 중...' : editing ? <><Check size={16} /> 수정 저장</> : <><Send size={16} /> 제출하기</>}
        </Button>
      </div>
    </motion.form>

    <ConfirmModal
      open={withdrawConfirmOpen}
      onCancel={() => setWithdrawConfirmOpen(false)}
      onConfirm={handleWithdrawConfirmed}
      title="제출을 취소할까요?"
      description="업로드한 이미지와 내용이 모두 삭제됩니다."
      confirmLabel="제출 취소"
      variant="danger"
    />
    </>
  );
});
