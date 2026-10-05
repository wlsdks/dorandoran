import { createRoot } from 'react-dom/client';
import { AIAvailabilityContext } from '@/hooks/useAIAvailability';
import { useLiveJudging } from '@/features/ai-judge/api/useLiveJudging';
import { useJudging } from '@/features/assignments/api/useJudging';
let root;
function Probe({ sessionId, questionId, assignmentId }) {
  const live = useLiveJudging(sessionId, questionId), assignment = useJudging(assignmentId);
  return <div id="judging-probe">
    <button onClick={() => live.startJudging()}>Start live</button>
    <button onClick={() => live.reset()}>Reset live</button>
    <button onClick={() => assignment.startJudging()}>Start assignment</button>
    <button onClick={() => assignment.abort()}>Abort assignment</button>
    <span>{JSON.stringify({ live: live.isJudging, assignment: assignment.isJudging })}</span>
  </div>;
}
export function renderProbe(props) {
  if (!root) { const node = document.createElement('div'); node.id = 'judging-root'; document.body.append(node); root = createRoot(node); }
  root.render(<AIAvailabilityContext.Provider value={{ configured: true, available: true }}><Probe {...props} /></AIAvailabilityContext.Provider>);
}
export function destroyProbe() { root?.unmount(); root = null; document.getElementById('judging-root')?.remove(); }
