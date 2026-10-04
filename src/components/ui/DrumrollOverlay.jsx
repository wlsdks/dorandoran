import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import DoranDoranMascot from './DoranDoranMascot';
import { prepareNotificationAudio } from '@/lib/chime';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** 짧은 한 번의 가속→정지→공개. 오디오는 실시간 이벤트가 아닌 사용자 허용을 따른다. */
export default memo(function DrumrollOverlay({ active, onComplete, duration = 2500 }) {
  const [phase, setPhase] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem('dorandoran_sound_muted') === 'true');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => {
    if (!active) { setPhase(0); return; }
    setMuted(localStorage.getItem('dorandoran_sound_muted') === 'true');
    const timers = [setTimeout(() => setPhase(1), duration * 0.3), setTimeout(() => setPhase(2), duration * 0.67),
      setTimeout(() => setPhase(3), duration * 0.9), setTimeout(() => onCompleteRef.current?.(), duration)];
    return () => timers.forEach(clearTimeout);
  }, [active, duration]);
  useEffect(() => {
    if (!active || muted || localStorage.getItem('dorandoran_sound_muted') === 'true') return;
    let cancelled = false;
    const sources = [], nodes = [];
    Promise.resolve().then(() => prepareNotificationAudio()).then(ctx => {
      if (!ctx || cancelled) return;
      const start = ctx.currentTime + 0.025;
      const total = duration / 1000;
      const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.15), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      for (let time = 0.06; time < total * 0.88; time += Math.max(0.065, 0.22 - time / total * 0.17)) {
        const beat = start + time;
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
        source.buffer = noise; filter.type = 'highpass'; filter.frequency.value = 1000;
        gain.gain.setValueAtTime(0.045 + time / total * 0.035, beat); gain.gain.exponentialRampToValueAtTime(0.001, beat + 0.085);
        source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start(beat); source.stop(beat + 0.11);
        sources.push(source); nodes.push(source, filter, gain);
      }
      const kick = ctx.createOscillator(), gain = ctx.createGain();
      kick.frequency.setValueAtTime(130, start + total * 0.86); kick.frequency.exponentialRampToValueAtTime(50, start + total * 0.86 + 0.14);
      gain.gain.setValueAtTime(0.12, start + total * 0.86); gain.gain.exponentialRampToValueAtTime(0.001, start + total * 0.86 + 0.18);
      kick.connect(gain); gain.connect(ctx.destination); kick.start(start + total * 0.86); kick.stop(start + total * 0.86 + 0.2);
      sources.push(kick); nodes.push(kick, gain);
    }).catch(() => {});
    return () => { cancelled = true; sources.forEach(source => { try { source.stop(); } catch { /* 이미 끝난 비트 */ } }); nodes.forEach(node => node.disconnect()); };
  }, [active, duration, muted]);
  const toggleSound = () => setMuted(value => { localStorage.setItem('dorandoran_sound_muted', String(!value)); return !value; });
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{active && <motion.div role="status" aria-live="polite"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
    className="fixed inset-0 z-[80] bg-slate-950/95 flex items-center justify-center p-6">
    <div className="text-center w-full max-w-3xl">
      <p className="text-indigo-200 text-lg sm:text-2xl font-semibold mb-6">잠시 후, 정답을 공개합니다</p>
      <motion.div animate={reduced ? {} : { scale: phase === 3 ? 1 : [1, 1.025, 1] }} transition={{ duration: phase > 1 ? 0.25 : 0.5 }} className="flex justify-center mb-6">
        <DoranDoranMascot size={180} mood={phase === 3 ? 'happy' : 'thinking'} animated={false} />
      </motion.div>
      <p className="text-[clamp(2.5rem,6vw,6rem)] font-extrabold tracking-tight text-slate-50 leading-tight">{phase === 3 ? '정답은…' : '두구두구'}</p>
      <div className="mt-8 h-2 max-w-md mx-auto bg-slate-700 rounded-full overflow-hidden"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: duration / 1000, ease: 'linear' }} className="h-full w-full origin-left bg-indigo-300" /></div>
    </div>
    <button className="absolute top-6 right-6 h-12 px-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 text-slate-100" onClick={toggleSound} aria-label={muted ? '효과음 켜기' : '효과음 끄기'}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}<span>{muted ? '소리 끔' : '소리 켬'}</span></button>
  </motion.div>}</AnimatePresence>, document.body);
});
