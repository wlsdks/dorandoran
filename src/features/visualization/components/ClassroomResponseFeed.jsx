import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { useVotes } from '@/hooks/useVotes';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

/** 발표에서는 한 번에 읽을 수 있는 크기로 응답을 나눠 보여준다. */
export default memo(function ClassroomResponseFeed({ sessionId, questionId, question, onPageChange }) {
  const { voteList } = useVotes(sessionId, questionId);
  const responses = useMemo(() => [...voteList].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)), [voteList]);
  const pageSize = responses.some(item => String(item.value).length > 180) ? 2 : 4;
  const pages = Math.max(1, Math.ceil(responses.length / pageSize));
  const page = Math.min(Math.max(Number.isInteger(question.displayPage) ? question.displayPage : 0, 0), pages - 1);
  const spotlight = question.spotlight;
  return <section className="classroom-response-feed">
    <header className="text-center space-y-3">
      <h2 className="classroom-question-title">{question.title}</h2>
      <p className="classroom-response-caption">{responses.length}명 응답</p>
    </header>
    {spotlight ? <article className="classroom-response-card classroom-response-spotlight">
      <p className="classroom-response-caption">함께 살펴볼 생각 · {spotlight.nickname || '익명'}</p>
      <p className="classroom-response-text">{spotlight.value}</p>
    </article> : responses.length ? <div className="classroom-response-grid">
      {responses.slice(page * pageSize, (page + 1) * pageSize).map(item => <article key={item.id} className="classroom-response-card">
        <p className="classroom-response-caption"><MessageCircle size={20} />{item.nickname || '익명'}</p>
        <p className="classroom-response-text">{item.value}</p>
      </article>)}
    </div> : <div className="classroom-response-empty">
      <DoranDoranMascot size={140} mood="waiting" />
      <p>휴대폰에서 여러분의 생각을 적어주세요</p>
    </div>}
    {!spotlight && pages > 1 && <div className="classroom-response-pagination">
      {onPageChange && <button className="presentation-button" aria-label="이전 답변 페이지" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft size={20} /></button>}
      <span>답변 {page + 1} / {pages}</span>
      {onPageChange && <button className="presentation-button" aria-label="다음 답변 페이지" disabled={page === pages - 1} onClick={() => onPageChange(page + 1)}><ChevronRight size={20} /></button>}
    </div>}
  </section>;
});
