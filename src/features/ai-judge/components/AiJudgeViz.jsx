import { memo } from 'react';
import { Users, Lightbulb } from 'lucide-react';
import { useLiveSubmissions, useLiveJudgeResults } from '../api/useLiveJudging';
import AiJudgePanel from './AiJudgePanel';
import PresenterJudgingOverlay from './PresenterJudgingOverlay';
import SubmissionGrid, { getPresenterGridConfig } from './SubmissionGrid';
import TopThreeStage from './TopThreeStage';

/**
 * AiJudgeViz — 라이브 AI 심사 영역의 진입점.
 * 상태 분기:
 *   - done: TOP 3 시상 무대 (TopThreeStage)
 *   - presenter + judging: 프레젠터 라이브 오버레이 (PresenterJudgingOverlay)
 *   - 그 외: 제출 그리드 + (admin이면) 심사 컨트롤 패널
 */
export default memo(function AiJudgeViz({ sessionId, questionId, isAdmin, isPresenter = false }) {
  const { submissions } = useLiveSubmissions(sessionId, questionId);
  const { top3, judgeState, results, judgeLog } = useLiveJudgeResults(sessionId, questionId);

  const isDone = judgeState?.status === 'done' && top3;
  const isJudging = judgeState?.status === 'judging';

  if (isDone) {
    return (
      <TopThreeStage
        sessionId={sessionId}
        questionId={questionId}
        top3={top3}
        results={results}
        submissions={submissions}
        judgeState={judgeState}
        isAdmin={isAdmin}
        isPresenter={isPresenter}
      />
    );
  }

  // 프레젠터 + 심사 진행 중: 큰 화면용 피드백 오버레이 (판사별 라이브 thinking)
  if (isPresenter && isJudging) {
    return <PresenterJudgingOverlay judgeState={judgeState} judgeLog={judgeLog} submissions={submissions} results={results} />;
  }

  // 헤더도 SubmissionGrid와 같은 폭으로 맞춰 좌우 간격 과다 방지
  const headerCfg = isPresenter && submissions.length > 0 ? getPresenterGridConfig(submissions.length) : null;
  const headerInnerMax = headerCfg?.maxW || '';
  return (
    // isPresenter: 외부 공간이 넓어도 헤더는 그리드 폭과 맞춰 좌우 간격 과다 방지.
    <div className={`w-full ${isPresenter ? 'max-w-[92rem] space-y-3' : 'max-w-3xl space-y-5'} mx-auto px-2`}>
      <div className={`${headerInnerMax} mx-auto flex items-center justify-between px-1`}>
        <h3 className={`font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2 ${isPresenter ? 'text-base' : 'text-lg'}`}>
          <Lightbulb size={isPresenter ? 15 : 18} className="text-slate-400" />
          실시간 제출
        </h3>
        <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <Users size={13} /> {submissions.length}건
        </span>
      </div>

      {/* API 키 입력/심사 시작 패널은 어드민 대시보드에서만. 프레젠터 화면엔 절대 노출 금지 */}
      {isAdmin && !isPresenter && <AiJudgePanel key={`${sessionId}:${questionId}`} sessionId={sessionId} questionId={questionId} />}

      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
          <p className={`text-slate-400 ${isPresenter ? 'text-2xl' : 'text-sm'}`}>학생들의 제출을 기다리는 중...</p>
        </div>
      ) : (
        <SubmissionGrid submissions={submissions} isPresenter={isPresenter} />
      )}
    </div>
  );
});
