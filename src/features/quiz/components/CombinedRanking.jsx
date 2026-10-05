import { memo, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Crown } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import Avatar from '@/components/ui/Avatar';
import { getStaffSession } from '@/lib/auth-session';
import { EMPTY_RECORD } from '@/lib/realtime';
import { answerRanking, revealedQuestionEntries } from '@/lib/revealed-ranking';
import { useRevealedQuestionVotes } from '@/hooks/useRevealedQuestionVotes';
import './CombinedRanking.css';

export default memo(function CombinedRanking({ sessionId, session }) {
  const questions = session?.questions || EMPTY_RECORD;
  const local = Boolean(getStaffSession()) || !sessionId;
  const remote = useRevealedQuestionVotes(sessionId, questions, { enabled: !local });
  const votes = useMemo(() => local ? Object.fromEntries(Object.entries(questions).map(([id, question]) => [id, question.votes || EMPTY_RECORD])) : remote.votesByQuestion,
    [local, questions, remote.votesByQuestion]);
  const { ranking, respondentCount, totalQuestions } = useMemo(() => answerRanking(questions, votes, { publishedOnly: Boolean(sessionId) }), [questions, votes, sessionId]);
  const scope = `${sessionId || ''}:${JSON.stringify(revealedQuestionEntries(questions).map(([id, question]) => [id, question.revealedAt]))}`;
  const [navigation, setNavigation] = useState({ scope: '', page: 0 });
  const pages = Math.max(1, Math.ceil(ranking.length / 6));
  const page = navigation.scope === scope ? Math.min(Math.max(navigation.page, 0), pages - 1) : 0;
  const visible = ranking.slice(page * 6, (page + 1) * 6);
  const waiting = !local && remote.loading;
  const error = !local && remote.error;

  return <section className="combined-ranking-stage" aria-label="합산 랭킹 화면">
    <header className="combined-ranking-header">
      <DoranDoranMascot size={48} mood="happy" animated={false} />
      <div><h2>합산 랭킹</h2><p>{waiting ? '공개된 답안을 집계하고 있어요' : error ? '답안 집계를 불러오지 못했어요' : `${sessionId ? '공개 문항' : '총 문항'} ${totalQuestions}개 · 응답 ${respondentCount}명`}</p></div>
    </header>
    {waiting || error ? <p className="combined-ranking-empty" role="status">{error ? '연결 상태를 확인해 주세요. 집계가 준비되면 다시 표시됩니다.' : '잠시만 기다려 주세요.'}</p>
      : !ranking.length ? <p className="combined-ranking-empty">{!totalQuestions ? '정답을 공개하면 합산 랭킹이 표시됩니다.' : respondentCount ? '아직 정답을 맞힌 학습자가 없어요.' : '아직 답변이 없어요.'}</p>
      : <>
        <ol className="combined-ranking-list">
          {visible.map(entry => <li key={entry.id} data-first={entry.rank === 1}>
            <span className="combined-ranking-position">{entry.rank === 1 ? <Crown aria-label="1위" /> : entry.rank}</span>
            <Avatar name={entry.nickname} size="md" />
            <span className="combined-ranking-name">{entry.nickname}</span>
            <span className="combined-ranking-score"><strong>{entry.correct}</strong><span> / {totalQuestions} 정답</span></span>
          </li>)}
        </ol>
        <div className="combined-ranking-footer">
          <span>정답을 맞힌 학습자 {ranking.length}명</span>
          {pages > 1 && <div className="combined-ranking-pagination">
            <button type="button" className="presentation-button" aria-label="합산 랭킹 이전 페이지" disabled={page === 0} onClick={() => setNavigation({ scope, page: page - 1 })}><ChevronLeft size={20} /></button>
            <span>{page + 1} / {pages}</span>
            <button type="button" className="presentation-button" aria-label="합산 랭킹 다음 페이지" disabled={page === pages - 1} onClick={() => setNavigation({ scope, page: page + 1 })}><ChevronRight size={20} /></button>
          </div>}
        </div>
      </>}
  </section>;
});
