const { randomUUID } = require('node:crypto');
const { hashCredential, verifyCredential, nameKey } = require('./credentials');
const { httpError, verifiedStaff, createRateLimit } = require('./access');
const { readStaffProfile } = require('./staff-profile');
const { createResourceService } = require('./resource-service');

function createStaffService({ auth, db }) {
  const rateLimit = createRateLimit(100);
  const loginLimit = createRateLimit(10);
  const resources = createResourceService({ auth, db });
  return async (req) => {
    if (!rateLimit(req.ip || 'unknown')) throw httpError(429, '잠시 후 다시 시도해주세요.');
    const action = req.path.split('/').filter(Boolean).at(-1);
    const body = req.body || {};
    if (action === 'resources') return resources(req);
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 8192) throw httpError(413, '요청이 너무 큽니다.');
    if (action === 'login') {
      const { username, password } = body;
      if (typeof username !== 'string' || username.length > 20 || typeof password !== 'string' || password.length > 128) {
        throw httpError(400, '아이디와 비밀번호를 확인해주세요.');
      }
      if (!loginLimit(`${req.ip || 'unknown'}:${nameKey(username)}`)) throw httpError(429, '잠시 후 다시 시도해주세요.');
      let uid = (await db.ref(`staffUsernames/${nameKey(username)}`).get()).val();
      if (!uid) {
        const matches = (await db.ref('admins').orderByChild('username').equalTo(username.trim()).limitToFirst(2).get()).val() || {};
        if (Object.keys(matches).length === 1) uid = Object.keys(matches)[0];
      }
      const account = uid ? (await db.ref(`admins/${uid}`).get()).val() : null;
      if (!await verifyCredential(password, account?.credential, account?.passwordHash)) throw httpError(401, '아이디 또는 비밀번호가 틀렸습니다.');
      // 기존 아이디/권한은 유지한다. 강화된 규칙 아래 계정 정보는 서버만 접근한다.
      const profile = await readStaffProfile(db, uid);
      if (!profile?.approved || !['master', 'admin', 'staff'].includes(profile.role)) throw httpError(403, '관리자 승인 또는 계정 이관이 필요합니다.');
      try { await auth.getUser(uid); } catch (err) { if (err.code !== 'auth/user-not-found') throw err; await auth.createUser({ uid }); }
      const claims = { role: profile.role, approved: true };
      await auth.setCustomUserClaims(uid, claims);
      return { token: await auth.createCustomToken(uid, claims), profile: { uid, ...profile } };
    }
    if (action === 'register') {
      const { username, password, displayName, role } = body;
      if (typeof username !== 'string' || username.trim().length < 2 || username.length > 20 || typeof password !== 'string'
        || password.length < 8 || password.length > 128 || typeof displayName !== 'string' || !displayName.trim() || displayName.length > 20
        || !['admin', 'staff'].includes(role)) throw httpError(400, '가입 정보를 확인해주세요. 비밀번호는 8자 이상이어야 합니다.');
      if ((await db.ref('admins').orderByChild('username').equalTo(username.trim()).limitToFirst(1).get()).exists()) {
        throw httpError(409, '이미 사용 중인 아이디입니다.');
      }
      const uid = randomUUID();
      const index = db.ref(`staffUsernames/${nameKey(username)}`);
      const claim = await index.transaction((current) => current === null ? uid : undefined);
      if (!claim.committed) throw httpError(409, '이미 사용 중인 아이디입니다.');
      try {
        const profile = { username: username.trim(), displayName: displayName.trim(), role, approved: false, createdAt: Date.now() };
        await db.ref().update({ [`admins/${uid}`]: { username: profile.username, credential: await hashCredential(password) }, [`staffProfiles/${uid}`]: profile });
        return { pending: true };
      } catch (err) { await index.transaction((current) => current === uid ? null : undefined); throw err; }
    }
    if (action === 'profile') {
      const user = await verifiedStaff(req, auth, db);
      return { profile: user.profile };
    }
    if (action === 'profile-update') {
      const user = await verifiedStaff(req, auth, db);
      if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 20) throw httpError(400, '이름을 확인해주세요.');
      const modern = (await db.ref(`staffProfiles/${user.uid}`).get()).exists();
      await db.ref(`${modern ? 'staffProfiles' : 'admins'}/${user.uid}/displayName`).set(body.displayName.trim());
      return { profile: await readStaffProfile(db, user.uid) };
    }
    if (action === 'list') {
      await verifiedStaff(req, auth, db, 'master');
      const [legacy, modern] = await Promise.all([db.ref('admins').get(), db.ref('staffProfiles').get()]);
      const ids = new Set([...Object.keys(legacy.val() || {}), ...Object.keys(modern.val() || {})]);
      return { profiles: await Promise.all([...ids].map((uid) => readStaffProfile(db, uid))) };
    }
    if (action === 'approve' || action === 'reject') {
      await verifiedStaff(req, auth, db, 'master');
      const uid = body.uid;
      if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw httpError(400, '계정을 확인해주세요.');
      const profile = await readStaffProfile(db, uid);
      if (!profile || profile.role === 'master' || profile.approved) throw httpError(409, '승인 대기 계정만 변경할 수 있습니다.');
      const modern = (await db.ref(`staffProfiles/${uid}`).get()).exists();
      if (action === 'approve') await db.ref(`${modern ? 'staffProfiles' : 'admins'}/${uid}/approved`).set(true);
      else {
        await db.ref().update({ [`staffProfiles/${uid}`]: null, [`admins/${uid}`]: null });
        await db.ref(`staffUsernames/${nameKey(profile.username)}`).transaction((current) => current === uid ? null : undefined);
      }
      return { ok: true };
    }
    throw httpError(404, '지원하지 않는 요청입니다.');
  };
}
module.exports = { createStaffService };
