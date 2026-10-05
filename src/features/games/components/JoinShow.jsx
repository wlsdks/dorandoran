import { useEffect, useMemo, memo } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useParticipants } from '@/features/participants/api/useParticipants';
import './JoinShow.css';

/** Retarget from the displayed value; no React render on each animation frame. */
function EntryCount({ value }) {
  const reduced = useReducedMotion();
  const displayed = useMotionValue(value);
  const rounded = useTransform(displayed, number => Math.round(number));
  useEffect(() => {
    const distance = Math.abs(value - displayed.get());
    const control = animate(displayed, value, {
      duration: reduced ? 0 : Math.min(1.25, 0.5 + distance * 0.008),
      ease: [0.22, 1, 0.36, 1],
    });
    return () => control.stop();
  }, [displayed, reduced, value]);
  return <motion.span aria-hidden="true">{rounded}</motion.span>;
}

export default memo(function JoinShow({ sessionId }) {
  const { count, onlineList } = useParticipants(sessionId);
  const reduced = useReducedMotion();
  const studentUrl = sessionId ? `${window.location.origin}/?s=${encodeURIComponent(sessionId)}` : '';
  const recent = useMemo(() => [...onlineList]
    .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, 6), [onlineList]);

  return <section className="entry-stage" aria-label="수업 참여 안내">
    <div className="entry-intro">
      <h2>QR을 찍고<br />닉네임을 입력해주세요.</h2>
      {studentUrl && <a className="entry-qr" href={studentUrl} target="_blank" rel="noreferrer" aria-label="학습자 참여 페이지 열기">
        <QRCodeSVG value={studentUrl} size={200} level="M" marginSize={4} />
      </a>}
    </div>

    <div className="entry-people">
      <p className="entry-count-heading">현재 참여</p>
      <div className="entry-count" aria-label={`${count}명 접속 중`}>
        <EntryCount value={count} /><span className="entry-count-unit" aria-hidden="true">명</span>
      </div>
      <div className="entry-recent">
        {recent.length > 0 && <>
          <p className="entry-recent-label">최근 입장</p>
          <ul className="entry-recent-list">
            {recent.map(person => <motion.li key={person.id}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.28, ease: 'easeOut' }} title={person.nickname || '참여자'}>
              {person.nickname || '참여자'}
            </motion.li>)}
          </ul>
        </>}
      </div>
    </div>
  </section>;
});
