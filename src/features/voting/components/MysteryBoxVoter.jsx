import { memo } from 'react';
import { HelpCircle } from 'lucide-react';
import TextInput from './TextInput';

/**
 * MysteryBoxVoter — 학생이 미스터리 박스 정답을 추측하는 텍스트 입력.
 */
export default memo(function MysteryBoxVoter({ sessionId, questionId, disabled = false }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
        <HelpCircle size={18} />
        <span className="text-sm font-medium">정답을 추측해보세요</span>
      </div>
      <TextInput
        sessionId={sessionId}
        questionId={questionId}
        type="mysteryBox"
        placeholder="정답을 입력하세요"
        maxLength={50}
        disabled={disabled}
      />
    </div>
  );
});
