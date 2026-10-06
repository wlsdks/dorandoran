import { useSyncExternalStore } from 'react';
import { setTheme, subscribeTheme, themeSnapshot } from '@/lib/theme-store';

/** All theme controls share the same preference, system resolution and cleanup. */
export function useTheme() {
  const snapshot = useSyncExternalStore(subscribeTheme, themeSnapshot, () => 'dark:dark');
  const [theme, resolved] = snapshot.split(':');
  return { theme, setTheme, isDark: resolved === 'dark' };
}
