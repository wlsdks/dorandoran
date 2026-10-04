import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'dorandoran_theme';

/**
 * Theme hook — manages light/dark/system preference.
 * Persists choice in localStorage. Toggles `.dark` class on <html>.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      // 디폴트 다크 — 최초 방문자는 다크로 시작, 헤더 토글로 라이트 전환 가능
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const applyTheme = useCallback((t) => {
    const isDark =
      t === 'dark' ||
      (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.classList.toggle('dark', isDark);
    // Update meta theme-color for mobile browsers
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0F172A' : '#0F172A');
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Ignore storage errors
    }
    applyTheme(t);
  }, [applyTheme]);

  // Apply on mount + listen for system preference changes
  useEffect(() => {
    applyTheme(theme);

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return { theme, setTheme, isDark };
}
