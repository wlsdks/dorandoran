import { memo, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
import { getStaffSession } from '@/lib/auth-session';
import { EMPTY_RECORD } from '@/lib/realtime';
import { answerRanking, revealedQuestionEntries } from '@/lib/revealed-ranking';
import { useRevealedQuestionVotes } from '@/hooks/useRevealedQuestionVotes';
import './CombinedRanking.css';

const PAGE_SIZE = 8;

/** Same rhythm as the live leaderboard: podium block, hairline rows, pager in the header. */
export default memo(function CombinedRanking({ sessionId, session }) {
  const questions = session?.questions || EMPTY_RECORD;
  const local = Boolean(getStaffSession()) || !sessionId;
  const remote = useRevealedQuestionVotes(sessionId, questions, { enabled: !local });
  const votes = useMemo(() => local ? Object.fromEntries(Object.entries(questions).map(([id, question]) => [id, question.votes || EMPTY_RECORD])) : remote.votesByQuestion,
    [local, questions, remote.votesByQuestion]);
  const { ranking, respondentCount, totalQuestions } = useMemo(() => answerRanking(questions, votes, { publishedOnly: Boolean(sessionId) }), [questions, votes, sessionId]);
  const scope = `${sessionId || ''}:${JSON.stringify(revealedQuestionEntries(questions).map(([id, question]) => [id, question.revealedAt]))}`;
  const [navigation, setNavigation] = useState({ scope: '', page: 0 });
  const pages = Math.max(1, Math.ceil(ranking.length / PAGE_SIZE));
  const page = navigation.scope === scope ? Math.min(Math.max(navigation.page, 0), pages - 1) : 0;
  const visible = ranking.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const waiting = !local && remote.loading;
  const error = !local && remote.error;
  const meta = waiting ? '공개된 답안을 집계하고 있어요' : error ? '답안 집계를 불러오지 못했어요'
    : `${sessionId ? '공개 문항' : '총 문항'} ${totalQuestions}개 · 응답 ${respondentCount}명`;

  return <section className="combined-ranking-stage" aria-label="합산 랭킹 화면">
    <header className="combined-ranking-header">
      <div className="combined-ranking-heading">
        <DoranDoranMascot size={44} mood="happy" animated={false} />
        <div><h2>합산 랭킹</h2><p>{meta}</p></div>
      </div>
      {pages > 1 && <nav className="combined-ranking-pagination" aria-label="합산 랭킹 페이지">
        <button type="button" aria-label="합산 랭킹 이전 페이지" disabled={page === 0} onClick={() => setNavigation({ scope, page: page - 1 })}><ChevronLeft /></button>
        <span>{page + 1} / {pages}</span>
        <button type="button" aria-label="합산 랭킹 다음 페이지" disabled={page === pages - 1} onClick={() => setNavigation({ scope, page: page + 1 })}><ChevronRight /></button>
      </nav>}
    </header>
    {waiting || error ? <p className="combined-ranking-empty" role="status">{error ? '연결 상태를 확인해 주세요. 집계가 준비되면 다시 표시됩니다.' : '잠시만 기다려 주세요.'}</p>
      : !ranking.length ? <p className="combined-ranking-empty">{!totalQuestions ? '정답을 공개하면 합산 랭킹이 표시됩니다.' : respondentCount ? '아직 정답을 맞힌 학습자가 없어요.' : '아직 답변이 없어요.'}</p>
      : <>
        <ol className="combined-ranking-list">
          {visible.map(entry => <li key={entry.id} data-podium={entry.rank <= 3 ? 'true' : 'false'}>
            <span className="combined-ranking-position" aria-label={`${entry.rank}위`}>{entry.rank}</span>
            <span className="combined-ranking-name">{entry.nickname}</span>
            <span className="combined-ranking-score"><strong>{entry.correct}</strong><span>/ {totalQuestions} 정답</span></span>
          </li>)}
        </ol>
        <p className="combined-ranking-footer">정답을 맞힌 학습자 {ranking.length}명</p>
      </>}
  </section>;
});
