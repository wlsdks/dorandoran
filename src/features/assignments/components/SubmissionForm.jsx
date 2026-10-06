import { submissionImages } from '@/lib/submission-images';
import { auth, ensureAuthentication } from '@/lib/auth-session';
import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, AlertCircle } from 'lucide-react';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase-storage';
import { compressImage, MAX_UPLOAD_MB, uploadErrorMessage } from '@/lib/image-utils';
import { imageRejection, normalizeImageFile } from '@/lib/image-file';
import Button from '@/components/ui/Button';
import SubmissionPreview from './SubmissionPreview';
import SubmissionSuccessView from './SubmissionSuccessView';
import PrdField from './PrdField';
import HtmlCodeField from './HtmlCodeField';
import IdentityFields from './IdentityFields';
import ScreenshotsField from './ScreenshotsField';

const MAX_SCREENSHOTS = 10;
const MAX_PRD_CHARS = 10000;
const MAX_CODE_CHARS = 50000; // HTML 코드 길이 제한 (라이브 AI 심사와 동일)

/**
 * SubmissionForm — 학생 과제 제출 폼.
 * PRD 텍스트(필수) + HTML 코드(필수) + 결과물 스크린샷 다중(선택).
 */
export default function SubmissionForm({ onSubmit, existingSubmission, assignmentId }) {
  const [name, setName] = useState(existingSubmission?.name || '');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [prdContent, setPrdContent] = useState(existingSubmission?.prdContent || '');
  const [screenshots, setScreenshots] = useState(
    submissionImages(existingSubmission?.screenshots)
  );
  const [code, setCode] = useState(existingSubmission?.code || '');
  const [codeFileName, setCodeFileName] = useState('');
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pinError, setPinError] = useState('');
  const [nameError, setNameError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef(null);
  const htmlInputRef = useRef(null);
  const codeErrorTimerRef = useRef(null);

  // codeError 자동 해제 단일 타이머 — 언마운트 미정리 해소
  function showCodeError(msg, ms = 3500) {
    setCodeError(msg);
    if (codeErrorTimerRef.current) clearTimeout(codeErrorTimerRef.current);
    codeErrorTimerRef.current = setTimeout(() => setCodeError(''), ms);
  }
  useEffect(() => () => { if (codeErrorTimerRef.current) clearTimeout(codeErrorTimerRef.current); }, []);

  const isEditMode = !!existingSubmission;

  const handleAddScreenshots = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 같은 파일 재선택 가능하게
    if (!files.length) return;

    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) {
      alert(`최대 ${MAX_SCREENSHOTS}장까지 업로드 가능합니다.`);
      return;
    }
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      alert(`최대 ${MAX_SCREENSHOTS}장까지 가능합니다. ${remaining}장만 업로드합니다.`);
    }

    // 1) placeholder 추가 (uploading 상태)
    const placeholders = toUpload.map((f) => ({
      tempId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      uploading: true,
    }));
    setScreenshots((prev) => [...prev, ...placeholders]);

    // 2) 병렬 업로드
    await Promise.all(
      toUpload.map(async (original, i) => {
        let file = original;
        const placeholder = placeholders[i];
        try {
          // 윈도우는 MIME을 비우거나 옛 이름으로 주므로 파일 내용으로 형식을 확인하고, 큰 사진은 줄여서 올린다
          file = await normalizeImageFile(file);
          const rejection = imageRejection(file, MAX_UPLOAD_MB);
          if (rejection) throw new Error(rejection);
          file = await compressImage(file);
          if (!assignmentId) {
            throw new Error('assignmentId 없음');
          }
          const dotIdx = original.name.lastIndexOf('.');
          const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' })[file.type] || 'jpg';
          const stem = dotIdx > 0 ? original.name.slice(0, dotIdx) : original.name;
          const safeStem = (stem.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)) || 'img';
          await ensureAuthentication();
          const path = `assignments/${assignmentId}/${auth.currentUser.uid}/screenshots/${placeholder.tempId}_${safeStem}.${ext}`;
          const ref = sRef(storage, path);
          await uploadBytes(ref, file, { contentType: file.type });
          const url = await getDownloadURL(ref);
          setScreenshots((prev) =>
            prev.map((s) =>
              s.tempId === placeholder.tempId
                ? { url, name: file.name, size: file.size, path }
                : s
            )
          );
        } catch (err) {
          setScreenshots((prev) =>
            prev.map((s) =>
              s.tempId === placeholder.tempId
                ? { ...s, uploading: false, error: err?.code ? uploadErrorMessage(err) : (err.message || '업로드하지 못했어요') }
                : s
            )
          );
        }
      })
    );
  }, [screenshots.length, assignmentId]);

  const removeScreenshot = useCallback((idx) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // HTML 파일 업로드 — .html/.htm만 허용. 크기 초과 시 앞부분만 사용.
  const handleHtmlFile = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const isHtml = /\.(html|htm)$/i.test(file.name);
    if (!isHtml) {
      showCodeError('HTML 파일(.html, .htm)만 업로드할 수 있어요');
      if (htmlInputRef.current) htmlInputRef.current.value = '';
      return;
    }
    try {
      const text = await file.text();
      const truncated = text.slice(0, MAX_CODE_CHARS);
      setCode(truncated);
      setCodeFileName(file.name);
      if (text.length > MAX_CODE_CHARS) {
        showCodeError(`파일이 50KB를 초과해 앞부분만 사용됩니다 (${Math.round(text.length / 1024)}KB)`, 4000);
      }
    } catch (err) {
      showCodeError(err?.message || '파일 읽기 실패');
    } finally {
      if (htmlInputRef.current) htmlInputRef.current.value = '';
    }
  }, []);

  const validShots = screenshots.filter((s) => s.url && !s.error);
  const anyUploading = screenshots.some((s) => s.uploading);
  const hasPrd = prdContent.trim().length >= 50;
  const hasCode = code.trim().length > 0;
  const pinMatch = isEditMode || (pin.length === 8 && pin === pinConfirm);
  const canSubmit = name.trim() && (isEditMode || pin.length === 8) && pinMatch
    && hasPrd && hasCode && !anyUploading && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setPinError('');
    setNameError('');
    setSubmitError('');
    try {
      await onSubmit({
        name: name.trim(),
        pin,
        prdContent: prdContent.trim() || null,
        screenshots: validShots.map((s) => ({ url: s.url, name: s.name, size: s.size, path: s.path })),
        code: code.trim() || null,
      }, { isEdit: isEditMode });
      setSubmitted(true);
    } catch (err) {
      if (err.message === 'PIN_MISMATCH') {
        setPinError('조회용 비밀번호가 일치하지 않습니다');
      } else if (err.message === 'NAME_TAKEN') {
        setNameError('이미 사용 중인 이름입니다. 다른 이름을 쓰거나, 본인 제출물 수정이라면 "내 제출물 조회"를 이용하세요.');
      } else {
        logger.error('[submission] failed', err);
        setSubmitError('제출에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
    {submitted ? (
      <SubmissionSuccessView onEdit={() => setSubmitted(false)} />
    ) : (
      <motion.div
        key="form"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.15 }}
      >
      <form onSubmit={handleSubmit} className="space-y-5 pb-4">
      <IdentityFields
        name={name}
        onNameChange={(v) => { setName(v); setNameError(''); }}
        nameError={nameError}
        pin={pin}
        onPinChange={(v) => { setPin(v); setPinError(''); }}
        pinError={pinError}
        pinConfirm={pinConfirm}
        onPinConfirmChange={setPinConfirm}
        isEditMode={isEditMode}
      />

      {/* PRD 작성 — 필수 */}
      <PrdField value={prdContent} onChange={setPrdContent} maxChars={MAX_PRD_CHARS} />

      {/* HTML 코드 / 파일 — 필수 */}
      <HtmlCodeField
        code={code}
        onCodeChange={(v) => { setCode(v); if (codeFileName) setCodeFileName(''); }}
        codeFileName={codeFileName}
        codeError={codeError}
        onFileSelect={handleHtmlFile}
        fileInputRef={htmlInputRef}
        maxChars={MAX_CODE_CHARS}
      />

      {/* 결과물 스크린샷 — 다중 업로드 (선택) */}
      <ScreenshotsField
        screenshots={screenshots}
        validShotCount={validShots.length}
        onAddScreenshots={handleAddScreenshots}
        onRemove={removeScreenshot}
        fileInputRef={fileInputRef}
        maxScreenshots={MAX_SCREENSHOTS}
      />

      {/* Validation hint — 제출 가로막는 모든 사유 표시 */}
      {!canSubmit && !submitting && (name.trim() || prdContent.trim() || code.trim()) && (
        <div className="text-xs text-slate-400 px-1 space-y-0.5">
          {!name.trim() && <p>· 이름을 입력해주세요</p>}
          {!isEditMode && pin.length !== 8 && <p>· 조회용 비밀번호 8자리를 입력해주세요</p>}
          {!isEditMode && pin.length === 8 && pin !== pinConfirm && <p>· 조회용 비밀번호 확인이 일치하지 않습니다</p>}
          {!hasPrd && <p>· PRD를 작성해주세요 (50자 이상)</p>}
          {!hasCode && <p>· 결과물 HTML 코드를 입력하거나 파일을 첨부해주세요</p>}
          {anyUploading && <p>· 이미지 업로드가 끝날 때까지 기다려주세요</p>}
        </div>
      )}

      {/* AI 예심 */}
      {hasPrd && hasCode && (
        <SubmissionPreview
          submission={{
            name: name.trim() || '익명',
            prdContent,
            screenshots: validShots,
            code,
          }}
          disabled={!hasPrd || !hasCode}
        />
      )}

      {submitError && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 ring-1 ring-red-100 dark:ring-red-900/40 text-red-600 dark:text-red-400 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Submit — sticky bottom */}
      <div className="sticky bottom-0 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] -mx-5 px-5 bg-gradient-to-t from-slate-50 dark:from-slate-900 via-slate-50/95 dark:via-slate-900/95 to-transparent">
        <Button type="submit" variant="primary" size="lg" disabled={!canSubmit} className="w-full">
          {submitting ? '제출 중...'
            : anyUploading ? '업로드 중...'
            : existingSubmission ? '수정 제출'
            : <><Send size={16} /> 제출하기</>}
        </Button>
      </div>
    </form>
      </motion.div>
    )}
    </AnimatePresence>
  );
}
