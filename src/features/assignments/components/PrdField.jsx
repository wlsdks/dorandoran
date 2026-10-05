import { useId } from 'react';

/**
 * PRD 텍스트 입력 필드 — 학생 과제 제출 폼의 PRD 작성 영역.
 * 50자 이상이면 hasPrd=true (validation은 부모가 담당).
 */
export default function PrdField({ value, onChange, maxChars }) {
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const trimmedLen = value.trim().length;
  return (
    <div>
      <label htmlFor={fieldId} className="block text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2">
        프로젝트 설명 (PRD)
        <span className="text-red-500 ml-1.5 font-normal">필수</span>
      </label>
      <textarea
        id={fieldId}
        aria-required="true"
        aria-describedby={hintId}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxChars))}
        placeholder={`어떤 문제를 풀려고 했는지 / 누구를 위한 건지 / 어떤 기능을 만들었는지 자유롭게 작성해 주세요.\n\n예) 우리 팀 회의록을 짧게 요약해주는 도구를 만들었습니다. 회의 끝나고 정리하는 게 너무 오래 걸려서…`}
        rows={6}
        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y transition-all leading-relaxed"
      />
      <div className="flex items-start justify-between gap-3 mt-1.5">
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {trimmedLen < 50 && trimmedLen > 0 ? `50자 이상 작성해 주세요. 현재 ${trimmedLen}자예요.` : '프로젝트의 목적과 기능을 50자 이상 설명해 주세요.'}
        </p>
        <p className="text-xs shrink-0 text-slate-500 dark:text-slate-400 tabular-nums">
          {value.length.toLocaleString()}/{maxChars.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
