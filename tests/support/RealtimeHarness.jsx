import { createRoot } from 'react-dom/client';
import { useLayoutEffect, StrictMode } from 'react';
import { useVotes } from '@/hooks/useVotes';
import { useMyVote, useMyVoteFull } from '@/hooks/useMyVote';
import { useParticipants, useParticipantCount } from '@/features/participants/api/useParticipants';
import { useTimer } from '@/features/timer/api/useTimer';
import { useScores, useMyScore } from '@/features/quiz/api/useScores';
import { useMyHandRaise, useHandRaises } from '@/features/hand-raise/api/useHandRaises';
import { useUrgentQuestions } from '@/features/questions/api/useUrgentQuestions';
import { useStudentDM } from '@/features/dm/api/useStudentDM';
import { useDMTyping } from '@/features/dm/api/useDMTyping';
import { useChat } from '@/features/chat/api/useChat';
import { useStaffChat } from '@/features/dm/api/useStaffChat';
import { useSession } from '@/features/session/api/useSession';
import { useAssignment } from '@/features/assignments/api/useAssignments';
import { useAwards, useAllResults } from '@/features/assignments/api/useAwards';
import { useLiveJudgeResults } from '@/features/ai-judge/api/useLiveJudging';

function Probe(props) {
  const votes = useVotes(props.sessionId, props.questionId);
  const mine = useMyVote(props.sessionId, props.questionId);
  const mineFull = useMyVoteFull(props.sessionId, props.questionId);
  const people = useParticipants(props.sessionId);
  const count = useParticipantCount(props.sessionId);
  const timer = useTimer(props.sessionId);
  const scores = useScores(props.sessionId);
  const score = useMyScore(props.sessionId);
  const hand = useMyHandRaise(props.sessionId);
  const hands = useHandRaises(props.sessionId);
  const urgent = useUrgentQuestions(props.sessionId);
  const dm = useStudentDM(props.sessionId, props.participantId);
  const typing = useDMTyping(props.sessionId, props.dmId, { userId: props.participantId });
  const chat = useChat(props.sessionId);
  const staff = useStaffChat(props.sessionId);
  const session = useSession(props.sessionId);
  const assignment = useAssignment(props.assignmentId);
  const awards = useAwards(props.assignmentId);
  const results = useAllResults(props.assignmentId);
  const judging = useLiveJudgeResults(props.sessionId, props.questionId);
  const result = { scope: props.sessionId, votes: votes.votes, mine: mine.myVote, full: mineFull.myVote, people: people.list, count,
    timer: { running: timer.isRunning, endTime: timer.endTime }, scores: scores.scores, score: score.myScore, hand: hand.raised,
    hands: hands.raisedList, urgent: urgent.questions, dm: dm.activeDM, typing: typing.activeTypers, chat: chat.messages, staff: staff.messages,
    session: session.session, assignment: assignment.assignment, awards: awards.awards, results: results.results, judging: judging.results };
  useLayoutEffect(() => { globalThis.__realtimeFrames.push(result); });
  useLayoutEffect(() => { globalThis.__probeActions = { sendChat: chat.sendMessage, clearTyping: typing.clearTyping }; });
  return <pre id="probe-result">{JSON.stringify(result)}</pre>;
}
let root;
export function renderProbe(props) {
  if (!root) { const element = document.createElement('div'); element.id = 'realtime-probe'; document.body.append(element); root = createRoot(element); globalThis.__realtimeFrames = []; }
  root.render(<StrictMode><Probe {...props} /></StrictMode>);
}
export function destroyProbe() { root?.unmount(); root = null; document.getElementById('realtime-probe')?.remove(); }
