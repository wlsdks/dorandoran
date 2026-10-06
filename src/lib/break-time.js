/**
 * 쉬는 시간·대기 시간 표시 계산 — 서버 시각(ms)을 받아 순수하게 계산한다.
 * style: 'countdown' = N분 카운트다운, 'startAt' = "21:40 시작"처럼 시작 시각을 보여준다.
 * 예전 데이터(breakLabel/breakStyle 없음)는 '쉬는 시간' + countdown으로 읽는다.
 */
export const BREAK_LABELS = ['쉬는 시간', '대기 시간'];
export const BREAK_STYLES = ['countdown', 'startAt'];
export const BREAK_PRESET_MINUTES = [5, 10, 15];
export const BREAK_MAX_MINUTES = 180;

export function normalizeBreakLabel(label) {
  return BREAK_LABELS.includes(label) ? label : BREAK_LABELS[0];
}

export function normalizeBreakStyle(style) {
  return BREAK_STYLES.includes(style) ? style : 'countdown';
}

/** 입력 분을 1~180 정수로. 숫자가 아니면 null. */
export function clampBreakMinutes(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, BREAK_MAX_MINUTES);
}

/**
 * 종료(=시작) 시각 계산. startAt은 보이는 시각이 딱 떨어지도록 분 단위로 올림한다
 * ("10분 뒤 시작"이 21:39:42가 아니라 21:40으로 보이게).
 */
export function breakEndsAt(now, minutes, style) {
  const end = now + minutes * 60_000;
  return normalizeBreakStyle(style) === 'startAt' ? Math.ceil(end / 60_000) * 60_000 : end;
}

/** 시:분 (24시간, 앞자리 0). timeZone을 주지 않으면 기기 시간대. */
export function formatClock(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(new Date(ms));
  const get = type => parts.find(p => p.type === type)?.value ?? '00';
  return `${get('hour').padStart(2, '0')}:${get('minute').padStart(2, '0')}`;
}

/** 남은 초 → "MM:SS" (1시간 이상이면 "H:MM:SS"). */
export function formatRemaining(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** 화면 상태 한 번에 계산. endsAt이 없으면 타이머 없음(idle). */
export function breakState({ endsAt, style, label } = {}, now) {
  const base = { label: normalizeBreakLabel(label), style: normalizeBreakStyle(style) };
  if (!endsAt) return { ...base, phase: 'idle', remaining: null };
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return { ...base, phase: remaining > 0 ? 'running' : 'finished', remaining, endsAt };
}
