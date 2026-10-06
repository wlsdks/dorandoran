// Browser-side instrumentation injected with addInitScript. Keeps per-phase buckets of
// rAF frame gaps, long tasks, long animation frames, layout shifts, event timing, and a
// text-sampled timeline of the board's response / online counts.
module.exports = function instrument({ sampleCounts = false } = {}) {
  const S = (globalThis.__perf = { phase: 'init', phases: {}, countTimeline: [], onlineTimeline: [], marks: [] });
  const bucket = () => (S.phases[S.phase] ||= { frames: [], long: [], loaf: [], cls: 0, events: [], start: performance.now(), startWall: Date.now() });
  bucket();
  let last = performance.now();
  const tick = (t) => { bucket().frames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const observe = (type, fn) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) }); } catch { /* unsupported */ } };
  observe('longtask', (e) => bucket().long.push(Math.round(e.duration)));
  observe('long-animation-frame', (e) => bucket().loaf.push({ d: Math.round(e.duration), b: Math.round(e.blockingDuration || 0), s: (e.scripts || []).slice(0, 2).map((x) => (x.sourceURL || x.invoker || '').split('/').pop()) }));
  observe('layout-shift', (e) => { if (!e.hadRecentInput) bucket().cls += e.value; });
  observe('event', (e) => { if (e.interactionId) bucket().events.push({ n: e.name, d: Math.round(e.duration), i: Math.round(e.processingStart - e.startTime), t: Math.round(e.startTime) }); });
  if (sampleCounts) {
    setInterval(() => {
      const txt = document.body?.textContent || '';
      const m = /응답\s*([\d,]+)\s*명/.exec(txt);
      if (m) { const v = Number(m[1].replace(/,/g, '')); const l = S.countTimeline.at(-1); if (!l || l[1] !== v) S.countTimeline.push([Date.now(), v]); }
      const o = /현재 접속\s*([\d,]+)\s*명/.exec(txt) || /([\d,]+)\s*명 접속 중/.exec(txt);
      if (o) { const v = Number(o[1].replace(/,/g, '')); const l = S.onlineTimeline.at(-1); if (!l || l[1] !== v) S.onlineTimeline.push([Date.now(), v]); }
    }, 50);
  }
  S.setPhase = (name) => { S.phase = name; bucket(); S.marks.push([Date.now(), name]); };
  S.resetCounts = () => { S.countTimeline = []; };
  const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
  S.summary = () => Object.fromEntries(Object.entries(S.phases).map(([name, b]) => {
    const frames = b.frames.length > 1 ? b.frames.slice(1) : [];
    const dur = frames.reduce((a, c) => a + c, 0) / 1000;
    const ev = b.events.map((e) => e.d);
    return [name, {
      seconds: Math.round(dur * 10) / 10, frames: frames.length, fps: dur ? Math.round(frames.length / dur) : null,
      frameP95: pct(frames, 0.95), frameMax: Math.round(Math.max(0, ...frames)), over50: frames.filter((f) => f > 50).length, over100: frames.filter((f) => f > 100).length,
      longTasks: b.long.length, longTaskMs: b.long.reduce((a, c) => a + c, 0), longTaskMax: Math.max(0, ...b.long),
      loaf: b.loaf.length, loafMax: Math.max(0, ...b.loaf.map((x) => x.d)), loafBlocking: b.loaf.reduce((a, c) => a + c.b, 0), loafTop: [...b.loaf].sort((a, c) => c.d - a.d).slice(0, 3),
      cls: Math.round(b.cls * 1000) / 1000,
      interactions: ev.length, inpP50: pct(ev, 0.5), inpP95: pct(ev, 0.95), inpMax: Math.max(0, ...ev), inputDelayMax: Math.max(0, ...b.events.map((e) => e.i)),
    }];
  }));
};
