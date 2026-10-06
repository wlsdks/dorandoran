const STORAGE_KEY = 'dorandoran_theme';
const choices = new Set(['light', 'dark', 'system']);
const listeners = new Set();
let memoryPreference;
let media;

function preference() {
  if (memoryPreference) return memoryPreference;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return choices.has(saved) ? saved : 'dark';
  } catch { return 'dark'; }
}

export function themeSnapshot() {
  if (typeof window === 'undefined') return 'dark:dark';
  const theme = preference();
  const systemDark = (media || window.matchMedia('(prefers-color-scheme: dark)')).matches;
  return `${theme}:${theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light'}`;
}

function publish() {
  const dark = themeSnapshot().endsWith(':dark');
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F172A' : '#F8FAFC');
  for (const notify of listeners) notify();
}

function onStorage(event) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  memoryPreference = undefined;
  publish();
}

export function subscribeTheme(notify) {
  listeners.add(notify);
  if (listeners.size === 1) {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', publish);
    window.addEventListener('storage', onStorage);
    publish();
  }
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) {
      media?.removeEventListener('change', publish);
      window.removeEventListener('storage', onStorage);
      media = undefined;
    }
  };
}

export function setTheme(theme) {
  if (!choices.has(theme)) return;
  memoryPreference = theme;
  try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* Keep the preference for this tab. */ }
  publish();
}
