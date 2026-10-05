import { expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ auth: { authStateReady: vi.fn(async () => {}), currentUser: null }, anonymous: vi.fn() }));
vi.mock('./firebase', () => ({ app: {} }));
vi.mock('firebase/auth', () => ({ getAuth: () => fixture.auth, signInAnonymously: fixture.anonymous,
  onAuthStateChanged: vi.fn(), signInWithCustomToken: vi.fn(), signOut: vi.fn(), connectAuthEmulator: vi.fn() }));
import { ensureAuthentication } from './auth-session';
it('동시 입장 준비는 익명 인증 하나를 공유하고 기존 UID는 재사용한다', async () => {
  const user = { uid: 'guest-id', isAnonymous: true };
  fixture.anonymous.mockImplementation(async () => { await Promise.resolve(); fixture.auth.currentUser = user; return { user }; });
  const users = await Promise.all(Array.from({ length: 50 }, () => ensureAuthentication()));
  expect(users.every(value => value === user)).toBe(true); expect(fixture.anonymous).toHaveBeenCalledTimes(1);
  expect(await ensureAuthentication()).toBe(user); expect(fixture.anonymous).toHaveBeenCalledTimes(1);
});
