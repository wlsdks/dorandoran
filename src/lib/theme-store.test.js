import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let store, storage, media, events, meta, dark;
beforeEach(async () => {
  vi.resetModules();
  storage = new Map(); events = new Map();
  media = { matches: false, addEventListener: vi.fn((_, callback) => { media.callback = callback; }), removeEventListener: vi.fn() };
  meta = { setAttribute: vi.fn() };
  vi.stubGlobal('window', { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, matchMedia: () => media,
    addEventListener: vi.fn((name, callback) => events.set(name, callback)), removeEventListener: vi.fn(name => events.delete(name)) });
  vi.stubGlobal('document', { documentElement: { classList: { toggle: (_, enabled) => { dark = enabled; } }, style: {} }, querySelector: () => meta });
  store = await import('./theme-store.js');
});
afterEach(() => vi.unstubAllGlobals());
it('two mounted controls receive one shared change and mobile chrome follows the theme', () => {
  const first = vi.fn(), second = vi.fn(), a = store.subscribeTheme(first), b = store.subscribeTheme(second);
  first.mockClear(); second.mockClear(); store.setTheme('light');
  expect(store.themeSnapshot()).toBe('light:light'); expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
  expect(dark).toBe(false); expect(meta.setAttribute).toHaveBeenLastCalledWith('content', '#F1F1F3');
  expect(media.addEventListener).toHaveBeenCalledOnce(); a(); expect(media.removeEventListener).not.toHaveBeenCalled(); b();
  expect(media.removeEventListener).toHaveBeenCalledOnce(); expect(events.size).toBe(0);
});
it('system preference reacts to operating-system changes without overwriting the saved choice', () => {
  storage.set('dorandoran_theme', 'system'); const off = store.subscribeTheme(vi.fn());
  expect(store.themeSnapshot()).toBe('system:light'); media.matches = true; media.callback();
  expect(store.themeSnapshot()).toBe('system:dark'); expect(dark).toBe(true); expect(storage.get('dorandoran_theme')).toBe('system'); off();
});
it('another tab can replace or clear the preference after this tab has toggled it', () => {
  const off = store.subscribeTheme(vi.fn()); store.setTheme('light'); storage.set('dorandoran_theme', 'dark');
  events.get('storage')({ key: 'dorandoran_theme' }); expect(store.themeSnapshot()).toBe('dark:dark');
  storage.clear(); events.get('storage')({ key: null }); expect(store.themeSnapshot()).toBe('dark:dark'); off();
});
it('blocked browser storage still permits switching and invalid values do not change the theme', () => {
  window.localStorage.getItem = () => { throw Error('blocked'); }; window.localStorage.setItem = () => { throw Error('blocked'); };
  const off = store.subscribeTheme(vi.fn()); store.setTheme('light'); expect(store.themeSnapshot()).toBe('light:light');
  store.setTheme('invalid'); expect(store.themeSnapshot()).toBe('light:light'); off();
});
