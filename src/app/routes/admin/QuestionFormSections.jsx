import { motion } from 'framer-motion';
import { Plus, Trash2, Check, ArrowUp, ArrowDown, X } from 'lucide-react';
import { QUIZ_DEFAULTS, QUIZ_EVENT_PRESETS } from '@/lib/quiz';
import ImageUpload from '@/components/ui/ImageUpload';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];
const RANKING_LABELS = ['1', '2', '3', '4', '5', '6'];
const GAP = 'pt-4';
const MOBILE_ICON_TARGET = 'max-sm:min-h-11 max-sm:min-w-11 max-sm:flex max-sm:items-center max-sm:justify-center max-sm:shrink-0 max-sm:dark:text-slate-300 max-sm:[&>svg]:size-5';
const INPUT = 'w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150';

export function ChoiceOptionsSection({ options, setOptions, correctAnswer, setCorrectAnswer, setLocalError }) {
  function removeOption(index) {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== index);
    setOptions(next);
    if (correctAnswer && !next.includes(correctAnswer)) setCorrectAnswer('');
  }

  return (
    <div className={GAP}>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">선택지</p>
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-base font-bold text-slate-500 dark:text-slate-300 shrink-0">
              {OPTION_LABELS[i]}
            </span>
            <input value={opt}
              onChange={(e) => {
                const next = [...options]; next[i] = e.target.value; setOptions(next);
                if (correctAnswer && !next.includes(correctAnswer)) setCorrectAnswer('');
                setLocalError(null);
              }}
              placeholder={`선택지 ${OPTION_LABELS[i]}`} aria-label={`선택지 ${OPTION_LABELS[i]}`}
              className={`flex-1 ${INPUT} py-2.5`} />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)}
                className={`p-1.5 ${MOBILE_ICON_TARGET} rounded-lg text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors duration-150 active:scale-90`}
                aria-label="선택지 삭제"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
        {options.length < 5 && (
          <button onClick={() => setOptions([...options, ''])}
            className="w-full max-sm:min-h-11 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-500 dark:hover:text-slate-300 transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5">
            <Plus size={14} /> 선택지 추가
          </button>
        )}
      </div>
    </div>
  );
}

export function CorrectAnswerSection({ optional = false, options, correctAnswer, setCorrectAnswer, setLocalError }) {
  return (
    <div className={GAP}>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{optional ? '정답 선택 (선택)' : '정답 선택'}</p>
      {optional && <>
        <p className="text-sm text-slate-500 dark:text-slate-300 mb-2">의견을 묻는 투표는 정답 없이 진행할 수 있어요.</p>
        <button type="button" aria-pressed={!correctAnswer} onClick={() => { setCorrectAnswer(''); setLocalError(null); }} className="min-h-11 px-3 mb-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200">정답 없음 · 의견 투표</button>
      </>}
      <div className="flex flex-wrap gap-2">
        {options.filter((o) => o.trim()).map((option, i) => {
          const isCorrect = correctAnswer === option;
          return (
            <button key={option} aria-pressed={isCorrect} onClick={() => { setCorrectAnswer(option); setLocalError(null); }}
              className={`min-h-11 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.96] flex items-center gap-1.5 ${
                isCorrect ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>
              {isCorrect && <Check size={14} />}
              <span className="font-bold">{OPTION_LABELS[i]}</span>{option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RankingOptionsSection({ options, setOptions, setLocalError }) {
  function moveRankingItem(index, direction) {
    const next = [...options];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    setOptions(next);
  }

  function removeOption(index) {
    if (options.length <= 3) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  return (
    <div className={GAP}>
      <div className="flex items-baseline gap-2 mb-2 max-sm:flex-col max-sm:items-start max-sm:gap-1">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">정답 순서</p>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">아래 순서가 정답입니다. 화살표로 조정하세요</span>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-300 shrink-0">
              {RANKING_LABELS[i]}
            </span>
            <input value={opt}
              onChange={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); setLocalError(null); }}
              placeholder={`${i + 1}번째 항목`} aria-label={`순위 ${i + 1}번째 항목`}
              className={`flex-1 ${INPUT} py-2.5`} />
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveRankingItem(i, 'up')} disabled={i === 0}
                className={`p-1 ${MOBILE_ICON_TARGET} rounded text-slate-500 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 transition-colors duration-150 active:scale-90`}
                aria-label="위로 이동"><ArrowUp size={12} /></button>
              <button onClick={() => moveRankingItem(i, 'down')} disabled={i === options.length - 1}
                className={`p-1 ${MOBILE_ICON_TARGET} rounded text-slate-500 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 transition-colors duration-150 active:scale-90`}
                aria-label="아래로 이동"><ArrowDown size={12} /></button>
            </div>
            {options.length > 3 && (
              <button onClick={() => removeOption(i)}
                className={`p-1.5 ${MOBILE_ICON_TARGET} rounded-lg text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors duration-150 active:scale-90`}
                aria-label="항목 삭제"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button onClick={() => setOptions([...options, ''])}
            className="w-full max-sm:min-h-11 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-500 dark:hover:text-slate-300 transition-colors duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5">
            <Plus size={14} /> 항목 추가
          </button>
        )}
      </div>
    </div>
  );
}

export function FillBlankSection({ title, correctAnswer, setCorrectAnswer, setLocalError }) {
  return (
    <div className={GAP}>
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">빈칸 미리보기</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {title.includes('___')
              ? title.split('___').map((part, i, arr) => (
                  <span key={i}>{part}
                    {i < arr.length - 1 && (
                      <span className="inline-block mx-1 px-3 py-0.5 bg-slate-100 dark:bg-slate-600 border border-dashed border-slate-300 dark:border-slate-500 rounded-md text-slate-500 dark:text-slate-400 text-xs font-medium">빈칸</span>
                    )}
                  </span>
                ))
              : <span className="text-slate-500 dark:text-slate-400">질문에 ___ 를 포함해주세요</span>}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">정답</p>
          <input value={correctAnswer}
            onChange={(e) => { setCorrectAnswer(e.target.value); setLocalError(null); }}
            placeholder="빈칸에 들어갈 정답" aria-label="빈칸 정답"
            className={`${INPUT} py-2.5`} />
        </div>
      </div>
    </div>
  );
}

export function ShortAnswerSection({ correctAnswer, setCorrectAnswer, acceptableAnswers, setAcceptableAnswers, setLocalError }) {
  const charCount = Array.from((correctAnswer || '').replace(/\s/g, '')).length;
  function addAcceptable() { if (acceptableAnswers.length < 5) setAcceptableAnswers(prev => [...prev, '']); }
  function removeAcceptable(index) { setAcceptableAnswers(prev => prev.filter((_, i) => i !== index)); }
  return (
    <div className={GAP}>
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">정답</p>
          <input value={correctAnswer}
            onChange={(e) => { setCorrectAnswer(e.target.value); setLocalError(null); }}
            placeholder="정답 (예: 블렌디드 러닝)" aria-label="단답 정답"
            maxLength={50}
            className={`${INPUT} py-2.5`} />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            공개 전 전자칠판엔 <span className="font-semibold text-slate-500 dark:text-slate-400">{charCount > 0 ? '○'.repeat(Math.min(charCount, 12)) : '○○○'}</span> 처럼 글자수만 표시돼요{charCount > 0 ? ` (${charCount}글자)` : ''}. 대소문자·띄어쓰기는 무시하고 채점합니다.
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">허용 답변 <span className="normal-case font-normal">(선택, 최대 5개)</span></p>
            {acceptableAnswers.length < 5 && (
              <button onClick={addAcceptable}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5 transition-colors duration-150">
                <Plus size={12} /> 추가
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">정답과 다른 표현도 정답 인정 (예: "대한민국", "한국")</p>
          {acceptableAnswers.length > 0 && (
            <div className="space-y-1.5">
              {acceptableAnswers.map((ans, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={ans}
                    onChange={(e) => { const next = [...acceptableAnswers]; next[i] = e.target.value; setAcceptableAnswers(next); }}
                    placeholder="허용할 다른 표현" aria-label={`허용 답변 ${i + 1}`}
                    maxLength={50}
                    className={`flex-1 ${INPUT} py-2`} />
                  <button onClick={() => removeAcceptable(i)}
                    className="p-1 rounded-lg text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors duration-150 active:scale-90"
                    aria-label="허용 답변 삭제"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OXAnswerSection({ correctAnswer, setCorrectAnswer, setLocalError }) {
  return (
    <div className={GAP}>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">정답 선택</p>
      <div className="flex gap-2">
        {['O', 'X'].map((val) => {
          const isCorrect = correctAnswer === val;
          return (
            <button key={val} onClick={() => { setCorrectAnswer(val); setLocalError(null); }}
              className={`flex-1 py-3 rounded-lg text-lg font-bold tracking-tight transition-colors duration-150 active:scale-[0.96] flex items-center justify-center gap-2 ${
                isCorrect ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>
              {isCorrect && <Check size={16} />}{val}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WinnersSection({ winners, setWinners }) {
  function addWinner() {
    if (winners.length < 3) setWinners(prev => [...prev, '']);
  }
  function removeWinner(index) {
    setWinners(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">당첨자 <span className="normal-case font-normal">(선택, 최대 3명)</span></p>
        {winners.length < 3 && (
          <button onClick={addWinner}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5 transition-colors duration-150">
            <Plus size={12} /> 추가
          </button>
        )}
      </div>
      {winners.length > 0 && (
        <div className="space-y-2">
          {winners.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
              <input value={name}
                onChange={(e) => { const next = [...winners]; next[i] = e.target.value; setWinners(next); }}
                placeholder={`${i + 1}등 당첨자 이름`} aria-label={`당첨자 ${i + 1}`}
                maxLength={20}
                className={`flex-1 ${INPUT} py-2`} />
              <button onClick={() => removeWinner(i)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors duration-150 active:scale-90"
                aria-label="당첨자 삭제"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MysteryBoxSection({ correctAnswer, setCorrectAnswer, mysteryItems, setMysteryItems, answerReasons, setAnswerReasons, winners, setWinners, setLocalError }) {
  function addReason() {
    if (answerReasons.length < 4) setAnswerReasons(prev => [...prev, '']);
  }
  function removeReason(index) {
    setAnswerReasons(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className={GAP}>
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">정답</p>
          <input value={correctAnswer}
            onChange={(e) => { setCorrectAnswer(e.target.value); setLocalError(null); }}
            placeholder="박스에서 나올 정답" aria-label="미스터리 박스 정답"
            maxLength={50}
            className={`${INPUT} py-2.5`} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">정답 사유 <span className="normal-case font-normal">(선택, 최대 4개)</span></p>
            {answerReasons.length < 4 && (
              <button onClick={addReason}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5 transition-colors duration-150">
                <Plus size={12} /> 추가
              </button>
            )}
          </div>
          {answerReasons.length > 0 && (
            <div className="space-y-2 mb-3">
              {answerReasons.map((reason, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <input value={reason}
                    onChange={(e) => { const next = [...answerReasons]; next[i] = e.target.value; setAnswerReasons(next); }}
                    placeholder={`왜 이것이 정답인가요?`} aria-label={`정답 사유 ${i + 1}`}
                    maxLength={100}
                    className={`flex-1 ${INPUT} py-2`} />
                  <button onClick={() => removeReason(i)}
                    className="p-1 rounded-lg text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors duration-150 active:scale-90"
                    aria-label="사유 삭제"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <WinnersSection winners={winners} setWinners={setWinners} />
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">돌아갈 텍스트 <span className="normal-case font-normal">(줄바꿈 구분, 비우면 ? 표시)</span></p>
          <textarea value={mysteryItems}
            onChange={(e) => setMysteryItems(e.target.value)}
            placeholder={"사과\n바나나\n딸기\n포도"}
            rows={3}
            className={`${INPUT} py-2.5 resize-none`} />
        </div>
      </div>
    </div>
  );
}

export function HintQuizSection({ correctAnswer, setCorrectAnswer, hints, setHints, acceptableAnswers, setAcceptableAnswers, winners, setWinners, setLocalError }) {
  function addHint() {
    if (hints.length < 5) setHints(prev => [...prev, '']);
  }

  function removeHint(index) {
    if (hints.length > 1) setHints(prev => prev.filter((_, i) => i !== index));
  }

  function addAcceptable() {
    if (acceptableAnswers.length < 5) setAcceptableAnswers(prev => [...prev, '']);
  }

  function removeAcceptable(index) {
    setAcceptableAnswers(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className={GAP}>
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">정답</p>
          <input value={correctAnswer}
            onChange={(e) => { setCorrectAnswer(e.target.value); setLocalError(null); }}
            placeholder="대표 정답 (화면에 표시)" aria-label="힌트 퀴즈 정답"
            maxLength={50}
            className={`${INPUT} py-2.5`} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">허용 답변 <span className="normal-case font-normal">(선택, 최대 5개)</span></p>
            {acceptableAnswers.length < 5 && (
              <button onClick={addAcceptable}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5 transition-colors duration-150">
                <Plus size={12} /> 추가
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">정답과 다른 표현도 정답으로 인정합니다 (예: "대한민국", "한국")</p>
          {acceptableAnswers.length > 0 && (
            <div className="space-y-1.5">
              {acceptableAnswers.map((ans, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={ans}
                    onChange={(e) => { const next = [...acceptableAnswers]; next[i] = e.target.value; setAcceptableAnswers(next); }}
                    placeholder="허용할 다른 표현" aria-label={`허용 답변 ${i + 1}`}
                    maxLength={50}
                    className={`flex-1 ${INPUT} py-2`} />
                  <button onClick={() => removeAcceptable(i)}
                    className="p-1 rounded-lg text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors duration-150 active:scale-90"
                    aria-label="허용 답변 삭제"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">힌트 <span className="normal-case font-normal">(최소 1개, 최대 5개)</span></p>
            {hints.length < 5 && (
              <button onClick={addHint}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5 transition-colors duration-150">
                <Plus size={12} /> 추가
              </button>
            )}
          </div>
          <div className="space-y-2">
            {hints.map((hint, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <input value={hint}
                  onChange={(e) => { const next = [...hints]; next[i] = e.target.value; setHints(next); setLocalError(null); }}
                  placeholder={`힌트 ${i + 1}`} aria-label={`힌트 ${i + 1}`}
                  maxLength={100}
                  className={`flex-1 ${INPUT} py-2.5`} />
                {hints.length > 1 && (
                  <button onClick={() => removeHint(i)}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors duration-150 active:scale-90"
                    aria-label="힌트 삭제"><X size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <WinnersSection winners={winners} setWinners={setWinners} />
      </div>
    </div>
  );
}

export function QuizSettingsSection({ points, setPoints, event, setEvent, betting, setBetting }) {
  return (
    <>
      {/* 점수 설정 */}
      <div className={GAP}>
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">점수 설정</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">(+속도 보너스 최대 {QUIZ_DEFAULTS.maxSpeedBonus}점)</span>
        </div>
        <div className="flex gap-1.5">
          {[50, 100, 200, 500].map((v) => (
            <button key={v} onClick={() => setPoints(v)}
              className={`flex-1 max-sm:min-h-11 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.96] ${
                points === v ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>
              {v}점
            </button>
          ))}
        </div>
      </div>

      {/* 이벤트 */}
      <div className={GAP}>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">이벤트 <span className="normal-case font-normal">(선택)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {QUIZ_EVENT_PRESETS.map((preset) => {
            const isSelected = event?.id === preset.id;
            return (
              <button key={preset.id} onClick={() => setEvent(isSelected ? null : preset)}
                className={`max-sm:min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                  isSelected ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 포인트 베팅 */}
      <div className={GAP}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">포인트 베팅</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">학생이 배율을 선택 (1x/2x/3x)</p>
          </div>
          <button onClick={() => setBetting(!betting)}
            className="w-11 h-6 max-sm:h-11 shrink-0 flex items-center justify-center"
            role="switch" aria-checked={betting} aria-label="포인트 베팅 활성화">
            <span className={`relative block w-11 h-6 rounded-full transition-colors duration-150 ${betting ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <motion.div animate={{ x: betting ? 20 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

export function AnswerImageSection({ answerImageUrl, setAnswerImageUrl }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} className={GAP}>
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">정답 참고 이미지 <span className="normal-case font-normal">(선택)</span></p>
      <ImageUpload value={answerImageUrl} onChange={setAnswerImageUrl} uploadLabel="정답 공개 때 보여줄 이미지 첨부" />
      <p className="text-[11px] text-slate-400 mt-1.5">정답을 공개하면 발표 화면과 학생 화면에 함께 나타납니다. 공개 전에는 학생에게 전송되지 않아요.</p>
    </motion.div>
  );
}
