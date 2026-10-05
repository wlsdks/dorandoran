import { useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import Avatar from '@/components/ui/Avatar';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';
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
    .slice(0, 3), [onlineList]);

  const latest = recent[0];

  return <section className="entry-stage" aria-label="수업 참여 안내">
    <header className="entry-intro">
      <div className="entry-brand">
        <DoranDoranMascot size={72} mood="happy" animated={false} className="entry-mascot" />
        <h2>수업에 참여해 주세요</h2>
      </div>
      <p className="entry-description">QR 코드를 스캔한 뒤 닉네임을 입력해 주세요.</p>
    </header>

    {studentUrl && <a className="entry-qr" href={studentUrl} target="_blank" rel="noreferrer" aria-label="학습자 참여 페이지 열기">
      <QRCodeSVG value={studentUrl} size={200} level="M" marginSize={4} />
    </a>}

    <div className="entry-summary">
      <p className="entry-count-heading">참여자</p>
      <div className="entry-count" aria-label={`${count}명 접속 중`}>
        <EntryCount value={count} /><span className="entry-count-unit" aria-hidden="true">명</span>
      </div>
    </div>

    <div className="entry-welcome" role="status" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait" initial={false}>
        {latest ? <motion.div key={latest.id} className="entry-welcome-line"
          initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
          transition={{ duration: reduced ? 0 : 0.24, ease: 'easeOut' }}>
          <div className="entry-avatar-stack" aria-hidden="true">
            {[...recent].reverse().map(person => <Avatar key={person.id} name={person.nickname || '학습자'} size="md" className="entry-avatar" />)}
          </div>
          <p className="entry-welcome-message"><strong>{latest.nickname || '학습자'}</strong> 님이 참여했어요</p>
        </motion.div> : <p key="waiting" className="entry-waiting">참여자를 기다리고 있어요</p>}
      </AnimatePresence>
    </div>
  </section>;
});
