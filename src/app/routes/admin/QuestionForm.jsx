import { useAIAvailability } from '@/hooks/useAIAvailability';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { QUIZ_DEFAULTS } from '@/lib/quiz';
import { safeEmbedUrl, embedRejectMessage } from '@/lib/embed';
import { QUESTION_TYPES } from '@/lib/question-types';
import ImageUpload from '@/components/ui/ImageUpload';
import MultiImageUpload from '@/components/ui/MultiImageUpload';
import {
  ChoiceOptionsSection,
  CorrectAnswerSection,
  RankingOptionsSection,
  FillBlankSection,
  OXAnswerSection,
  QuizSettingsSection,
  MysteryBoxSection,
  HintQuizSection,
  ShortAnswerSection,
  AnswerExplanationSection,
  EditLockNote,
} from './QuestionFormSections';
import { questionEditLocks, EDIT_LOCK_MESSAGES } from '@/lib/question-edit';
import { choiceNames, isAutoPhotoName } from '@/lib/option-images';
import { normalizeTimeLimit, supportsTimeLimit } from '@/lib/question-timer';
import TimeLimitSection from './TimeLimitSection';

const COMMON_TYPES = ['choice', 'quiz', 'ox', 'wordcloud', 'subjective', 'check'];
// 공개할 정답이 있는 유형. 객관식(choice)은 정답을 지정했을 때만 해당한다.
const ANSWER_TYPES = ['quiz', 'ox', 'fillinblank', 'shortAnswer', 'mysteryBox', 'hintQuiz', 'ranking'];

const INPUT = 'w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150';

export default function QuestionForm({ onSubmit, onCancel, error, initialData }) {
  const { available, reason } = useAIAvailability();
  const reducedMotion = useReducedMotion();
  const isEdit = !!initialData;
  const [type, setType] = useState(initialData?.type || 'choice');
  const [showMoreTypes, setShowMoreTypes] = useState(Boolean(initialData?.type && !COMMON_TYPES.includes(initialData.type)));
  const [title, setTitle] = useState(initialData?.title || '');
  const [options, setOptions] = useState(
    // 사진만 넣은 보기의 자동 이름('사진 A')은 다시 열 때 빈칸으로 돌려 둔다 — 강사가 쓴 글처럼 보이지 않게.
    initialData?.options?.length
      ? initialData.options.map((o, i) => (initialData.optionImages?.[i] && isAutoPhotoName(o) ? '' : o))
      : ['', '']
  );
  const [correctAnswer, setCorrectAnswer] = useState(initialData?.correctAnswer || '');
  const [points, setPoints] = useState(initialData?.points || QUIZ_DEFAULTS.points);
  const [event, setEvent] = useState(initialData?.event || null);
  const [betting, setBetting] = useState(initialData?.betting || false);
  const [hints, setHints] = useState(initialData?.hints?.length ? [...initialData.hints] : ['', '']);
  const [mysteryItems, setMysteryItems] = useState(initialData?.mysteryItems?.join('\n') || '');
  const [answerReasons, setAnswerReasons] = useState(initialData?.answerReasons?.length ? [...initialData.answerReasons] : []);
  const [acceptableAnswers, setAcceptableAnswers] = useState(initialData?.acceptableAnswers?.length ? [...initialData.acceptableAnswers] : []);
  const [winners, setWinners] = useState(initialData?.winners?.length ? [...initialData.winners] : []);
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [optionImages, setOptionImages] = useState(initialData?.optionImages?.length ? [...initialData.optionImages] : []);
  const [answerImageUrl, setAnswerImageUrl] = useState(initialData?.answerImageUrl || '');
  const [answerExplanation, setAnswerExplanation] = useState(initialData?.answerExplanation || '');
  const [hideTitle, setHideTitle] = useState(initialData?.hideTitle || false);
  const [slideImages, setSlideImages] = useState(initialData?.slideImages || []);
  const [modelAnswer, setModelAnswer] = useState(initialData?.modelAnswer || '');
  const [embedUrl, setEmbedUrl] = useState(initialData?.embedUrl || '');
  const [timerDuration, setTimerDuration] = useState(normalizeTimeLimit(initialData?.timerDuration));
  const [localError, setLocalError] = useState(null);
  // 수업에서 이미 쓴 문항: 응답·점수를 망가뜨리는 부분은 잠근다(보관함 문항처럼 응답이 없으면 잠금 없음).
  const locks = isEdit ? questionEditLocks(initialData) : questionEditLocks(null);

  const isChoiceLike = type === 'choice' || type === 'quiz';
  const isRanking = type === 'ranking';
  const isFillInBlank = type === 'fillinblank';
  const isMysteryBox = type === 'mysteryBox';
  const isHintQuiz = type === 'hintQuiz';
  const isSubjective = type === 'subjective';
  const isShortAnswer = type === 'shortAnswer';
  const isWebEmbed = type === 'webEmbed';
  // 사진만 있는 보기는 '사진 A'처럼 이름을 채운다 — 투표 값이 보기 글자라 비어 있으면 안 된다.
  const optionNames = choiceNames(options, optionImages);
  const hasAnswer = ANSWER_TYPES.includes(type) || (type === 'choice' && optionNames.includes(correctAnswer) && !!correctAnswer);

  async function handleAdd() {
    if (!title.trim()) { setLocalError('질문 내용을 입력해주세요.'); return; }
    const choicePairs = isChoiceLike
      ? optionNames.map((text, i) => ({ text, image: optionImages[i] || '' })).filter(p => p.text)
      : null;
    const cleanOptions = choicePairs ? choicePairs.map(p => p.text) : options.filter((o) => o.trim());
    if (choicePairs && new Set(cleanOptions).size !== cleanOptions.length) { setLocalError('선택지 내용이 서로 달라야 합니다.'); return; }
    if (isChoiceLike && cleanOptions.length < 2) { setLocalError('최소 2개의 선택지가 필요합니다.'); return; }
    if (isRanking && cleanOptions.length < 3) { setLocalError('순위 맞추기는 최소 3개 항목이 필요합니다.'); return; }
    if (isFillInBlank && !title.includes('___')) { setLocalError('빈칸 위치를 ___ (밑줄 3개)로 표시해주세요.'); return; }
    if (isFillInBlank && !correctAnswer.trim()) { setLocalError('정답을 입력해주세요.'); return; }
    if (type === 'quiz' && !cleanOptions.includes(correctAnswer)) { setLocalError('정답을 선택해주세요.'); return; }
    if (type === 'ox' && !correctAnswer) { setLocalError('정답을 선택해주세요.'); return; }
    if (isMysteryBox && !correctAnswer.trim()) { setLocalError('정답을 입력해주세요.'); return; }
    if (isShortAnswer && !correctAnswer.trim()) { setLocalError('정답을 입력해주세요.'); return; }
    if (isHintQuiz && !correctAnswer.trim()) { setLocalError('정답을 입력해주세요.'); return; }
    if (isHintQuiz && hints.filter(h => h.trim()).length === 0) { setLocalError('최소 1개의 힌트가 필요합니다.'); return; }
    if (type === 'imageSlide' && slideImages.length === 0) { setLocalError('최소 1장의 이미지가 필요합니다.'); return; }
    if (isSubjective && available && !modelAnswer.trim()) { setLocalError('모범답안을 입력해주세요. AI 채점 기준이 됩니다.'); return; }
    // 주소는 저장 전에 정규화한다. 스킴 없는 입력은 https로 읽고, 위험한 스킴과 앱 자신은 막는다.
    let safeEmbed = '';
    if (isWebEmbed) {
      const { url, reason } = safeEmbedUrl(embedUrl);
      if (!url) { setLocalError(embedRejectMessage(reason)); return; }
      safeEmbed = url;
    }
    setLocalError(null);
    const submitData = { type, title, options: cleanOptions, correctAnswer, points, event, betting, hideTitle };
    if (imageUrl) submitData.imageUrl = imageUrl;
    if (choicePairs?.some(p => p.image)) submitData.optionImages = choicePairs.map(p => p.image);
    if (hasAnswer && answerImageUrl) submitData.answerImageUrl = answerImageUrl;
    if (hasAnswer && answerExplanation.trim()) submitData.answerExplanation = answerExplanation.trim();
    if (isWebEmbed) submitData.embedUrl = safeEmbed;
    if (isSubjective) submitData.modelAnswer = modelAnswer.trim();
    if (supportsTimeLimit(type) && timerDuration) submitData.timerDuration = timerDuration;
    if (isMysteryBox) {
      submitData.mysteryItems = mysteryItems.split('\n').map(s => s.trim()).filter(Boolean);
      const validReasons = answerReasons.filter(r => r.trim());
      if (validReasons.length > 0) submitData.answerReasons = validReasons;
    }
    if (isHintQuiz) {
      submitData.hints = hints.filter(h => h.trim());
      const validAcceptable = acceptableAnswers.filter(a => a.trim());
      if (validAcceptable.length > 0) submitData.acceptableAnswers = validAcceptable;
    }
    if (isShortAnswer) {
      const validAcceptable = acceptableAnswers.filter(a => a.trim());
      if (validAcceptable.length > 0) submitData.acceptableAnswers = validAcceptable;
    }
    if (isMysteryBox || isHintQuiz) {
      const validWinners = winners.filter(w => w.trim());
      if (validWinners.length > 0) submitData.winners = validWinners;
    }
    if (type === 'imageSlide') {
      submitData.slideImages = slideImages;
    }
    const success = await onSubmit(submitData);
    // 호출부가 오류 문구를 넘기지 않아도 실패는 반드시 보이게 한다(아무 반응 없이 멈춘 것처럼 보이지 않게).
    if (!success && !error) setLocalError(isEdit ? '질문을 수정하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.' : '질문을 저장하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.');
    if (success) {
      setTitle(''); setOptions(['', '']); setOptionImages([]); setCorrectAnswer('');
      setPoints(QUIZ_DEFAULTS.points); setEvent(null); setBetting(false);
      setModelAnswer('');
      onCancel();
    }
  }

  const displayError = localError || error;

  return (
    <div>
      {/* 질문 유형 */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">질문 유형</p>
        <div className="grid grid-cols-3 gap-2">
          {QUESTION_TYPES.filter(t => showMoreTypes || COMMON_TYPES.includes(t.value)).map((t) => {
            const Icon = t.icon;
            const selected = type === t.value;
            return (
              <motion.button key={t.value} aria-pressed={type === t.value} disabled={(t.value === 'aiJudge' && !available) || (locks.typeLocked && t.value !== type)} title={t.value === 'aiJudge' && !available ? reason : undefined}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  setType(t.value); setLocalError(null);
                  if (t.value === 'ranking' && options.length < 3) setOptions(['', '', '']);
                }}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 ${
                  selected ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <Icon size={20} strokeWidth={selected ? 2 : 1.6} />
                <span className="text-sm font-medium leading-tight">{t.label}</span>
              </motion.button>
            );
          })}
        </div>
        {locks.typeLocked && <EditLockNote>{EDIT_LOCK_MESSAGES.type}</EditLockNote>}
        {showMoreTypes && !available && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">AI 심사는 지금 쓸 수 없어요{reason ? ` · ${reason}` : ''}</p>}
        <button type="button" onClick={() => setShowMoreTypes(value => !value)} aria-expanded={showMoreTypes} className="mt-2 min-h-12 w-full rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
          {showMoreTypes ? '자주 쓰는 유형만 보기' : `다른 문항 유형 ${QUESTION_TYPES.length - COMMON_TYPES.length}개 보기`}
        </button>
      </div>

      {/* 질문 내용 */}
      <div className="pt-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">질문 내용</p>
        <textarea value={title}
          onChange={(e) => { setTitle(e.target.value); setLocalError(null); }}
          placeholder={isFillInBlank ? 'HTTP 상태코드 ___는 페이지를 찾을 수 없음을 의미한다' : type === 'check' ? '실습을 완료하셨으면 체크해주세요' : '학생들에게 보여줄 질문을 입력하세요'}
          aria-label="질문 내용" rows={3}
          className={`${INPUT} resize-none text-base leading-relaxed`} autoFocus />
      </div>

      {/* 제목 표시 설정 */}
      <div className="pt-2">
        <button type="button" onClick={() => setHideTitle(!hideTitle)} aria-pressed={hideTitle}
          className="flex max-sm:min-h-11 items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          <span aria-hidden="true" className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${hideTitle ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600'}`}>
            {hideTitle && <Check size={12} strokeWidth={3} />}
          </span>
          프레젠터/전자칠판에서 제목 숨기기
        </button>
      </div>

      {/* 이미지 첨부 (웹페이지 유형은 주소 입력이 그 자리를 대신한다) */}
      <div className="pt-2">
        {isWebEmbed ? (
          <div className="space-y-1.5">
            <label htmlFor="question-embed-url" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              웹페이지 주소
            </label>
            <input
              id="question-embed-url"
              type="url"
              inputMode="url"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="example.com/docs"
              className={INPUT}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              발표 화면 안에서 그대로 엽니다. 임베드를 허용하지 않는 사이트는 새 창으로 열도록 안내합니다.
            </p>
          </div>
        ) : type === 'imageSlide' ? (
          <MultiImageUpload images={slideImages} onChange={setSlideImages} />
        ) : (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">질문 이미지 <span className="normal-case font-normal">(선택)</span></p>
            <ImageUpload value={imageUrl} onChange={setImageUrl} uploadLabel="질문 이미지 첨부" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">문제 전체에 쓰는 사진이에요. 보기마다 사진을 넣으려면 아래 선택지 옆 사진 버튼을 누르세요.</p>
          </div>
        )}
      </div>

      {/* Only the selected type is mounted: departed controls cannot overlap the new form. */}
      <motion.div key={type} initial={reducedMotion ? false : { opacity: .8 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : .12 }}>
        {isChoiceLike && <ChoiceOptionsSection lockedNames={locks.lockedOptions} options={options} setOptions={setOptions} optionImages={optionImages} setOptionImages={setOptionImages}
          correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} setLocalError={setLocalError} />}
        {isRanking && <fieldset disabled={locks.rankingLocked || locks.answerLocked} className="min-w-0 disabled:opacity-70">
          <RankingOptionsSection options={options} setOptions={setOptions} setLocalError={setLocalError} />
          {(locks.rankingLocked || locks.answerLocked) && <EditLockNote>{EDIT_LOCK_MESSAGES.ranking}</EditLockNote>}
        </fieldset>}
        <fieldset disabled={locks.answerLocked} className="min-w-0 disabled:opacity-70">
        {isFillInBlank && <FillBlankSection title={title} correctAnswer={correctAnswer}
          setCorrectAnswer={setCorrectAnswer} setLocalError={setLocalError} />}
        {isShortAnswer && <ShortAnswerSection correctAnswer={correctAnswer}
          setCorrectAnswer={setCorrectAnswer} acceptableAnswers={acceptableAnswers}
          setAcceptableAnswers={setAcceptableAnswers} setLocalError={setLocalError} />}
        {isChoiceLike && <CorrectAnswerSection optional={type === 'choice'} options={optionNames} optionImages={optionImages} correctAnswer={correctAnswer}
          setCorrectAnswer={setCorrectAnswer} setLocalError={setLocalError} />}
        {type === 'quiz' && <QuizSettingsSection points={points} setPoints={setPoints}
          event={event} setEvent={setEvent} betting={betting} setBetting={setBetting} />}
        {type === 'ox' && <OXAnswerSection correctAnswer={correctAnswer}
          setCorrectAnswer={setCorrectAnswer} setLocalError={setLocalError} />}
        {isMysteryBox && <MysteryBoxSection correctAnswer={correctAnswer}
          setCorrectAnswer={setCorrectAnswer} mysteryItems={mysteryItems}
          setMysteryItems={setMysteryItems} answerReasons={answerReasons}
          setAnswerReasons={setAnswerReasons} winners={winners}
          setWinners={setWinners} setLocalError={setLocalError} />}
        {isHintQuiz && <HintQuizSection correctAnswer={correctAnswer}
          setCorrectAnswer={setCorrectAnswer} hints={hints}
          setHints={setHints} acceptableAnswers={acceptableAnswers}
          setAcceptableAnswers={setAcceptableAnswers} winners={winners}
          setWinners={setWinners} setLocalError={setLocalError} />}
        {locks.answerLocked && !isRanking && <EditLockNote>{EDIT_LOCK_MESSAGES.answer}</EditLockNote>}
        </fieldset>
        {supportsTimeLimit(type) && <TimeLimitSection value={timerDuration} onChange={setTimerDuration} />}
        {hasAnswer && <AnswerExplanationSection answerExplanation={answerExplanation} setAnswerExplanation={setAnswerExplanation}
          answerImageUrl={answerImageUrl} setAnswerImageUrl={setAnswerImageUrl} />}
        {isSubjective && available && (
          <div className="overflow-hidden">
            <div className="pt-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">모범답안 (AI 채점 기준)</p>
              <textarea value={modelAnswer}
                onChange={(e) => { setModelAnswer(e.target.value); setLocalError(null); }}
                placeholder="핵심 키워드와 기대하는 답변 내용을 적어주세요. AI가 이 기준으로 학생 답변을 0~100점으로 채점합니다."
                aria-label="모범답안" rows={3}
                className={`${INPUT} resize-none leading-relaxed`} />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">학생에게는 보이지 않습니다. 채점 시에만 사용돼요.</p>
            </div>
          </div>
        )}

      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {displayError && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} role="alert"
            className="text-red-700 dark:text-red-400 text-sm flex items-center gap-1.5 pt-3">
            <AlertCircle size={14} />{displayError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onCancel} variant="secondary" size="md" className="flex-1">취소</Button>
        <Button onClick={handleAdd} variant="primary" size="md" className="flex-[2]">{isEdit ? '수정하기' : '추가하기'}</Button>
      </div>
    </div>
  );
}
