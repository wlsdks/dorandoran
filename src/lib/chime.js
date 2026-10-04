/**
 * DoranDoran Notification Chime — Web Audio API
 *
 * Synthesizes a subtle two-tone ascending chime.
 * No external audio files needed.
 * Respectful volume (0.12 max gain, quick decay).
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a gentle two-note ascending chime.
 * First note: C5 (523 Hz), Second note: E5 (659 Hz).
 * Total duration ~300ms. Volume: soft.
 */
export function playChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Shared gain envelope
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0, now);

    const notes = [
      { freq: 523.25, start: 0, dur: 0.15 },     // C5
      { freq: 659.25, start: 0.1, dur: 0.2 },     // E5
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.12, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(gain);
      gain.connect(masterGain);

      masterGain.gain.setValueAtTime(1, now + start);

      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });
  } catch {
    // Silently fail — audio is non-critical
  }
}

/**
 * Play a bright ascending "correct answer" jingle.
 * Three quick ascending notes: C5 → E5 → G5 (major triad, ~350ms).
 * Duolingo-inspired: happy, satisfying, not too long.
 */
export function playCorrect() {
  if (localStorage.getItem('dorandoran_sound_muted') === 'true') return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes = [
      { freq: 523, start: 0, dur: 0.12 },      // C5
      { freq: 659, start: 0.08, dur: 0.12 },    // E5
      { freq: 784, start: 0.16, dur: 0.22 },    // G5 (longer sustain)
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.14, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });
  } catch { /* */ }
}

/**
 * Play a soft descending "incorrect answer" tone.
 * Two descending notes: E4 → C4 (~250ms). Gentle, not punishing.
 */
export function playIncorrect() {
  if (localStorage.getItem('dorandoran_sound_muted') === 'true') return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes = [
      { freq: 330, start: 0, dur: 0.15 },      // E4
      { freq: 262, start: 0.1, dur: 0.2 },      // C4
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle'; // softer timbre for wrong answer
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.1, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });
  } catch { /* */ }
}

