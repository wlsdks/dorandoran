import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut, connectAuthEmulator } from 'firebase/auth';
import { app } from './firebase';

export const auth = getAuth(app);
if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
let guestPromise = null;
let verifiedProfile = null;

export async function ensureAuthentication() {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  if (!guestPromise) guestPromise = signInAnonymously(auth).then(({ user }) => user).finally(() => { guestPromise = null; });
  return guestPromise;
}

export async function authenticatedRequest(path, body, options = {}) {
  if (!/^\/api\/(staff|assignments|classroom)\//.test(path)) throw new Error('지원하지 않는 요청 주소입니다.');
  const user = await ensureAuthentication();
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body), signal: options.signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
}

export async function registerStaff(body) {
  const response = await fetch('/api/staff/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '가입에 실패했습니다.');
  return result;
}

export async function loginStaff(username, password) {
  const response = await fetch('/api/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '로그인에 실패했습니다.');
  await signInWithCustomToken(auth, result.token);
  verifiedProfile = result.profile;
  sessionStorage.setItem('dorandoran_admin', JSON.stringify(result.profile));
  return result.profile;
}

export function getStaffSession() {
  return verifiedProfile?.uid === auth.currentUser?.uid ? verifiedProfile : null;
}
export async function restoreStaffProfile(user) {
  verifiedProfile = null;
  if (!user || user.isAnonymous) return;
  const token = await user.getIdTokenResult();
  if (!token.claims.approved || !['master', 'admin', 'staff'].includes(token.claims.role)) return;
  const { profile } = await authenticatedRequest('/api/staff/profile', {});
  if (auth.currentUser?.uid === user.uid && profile?.approved && profile.role === token.claims.role) verifiedProfile = { uid: user.uid, ...profile };
}
export async function logoutStaff() { verifiedProfile = null; sessionStorage.removeItem('dorandoran_admin'); await signOut(auth); }
export { onAuthStateChanged, signInWithCustomToken };
