function httpError(status, message) { return Object.assign(new Error(message), { status }); }

async function verifiedUser(req, auth) {
  const match = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
  if (!match) throw httpError(401, '로그인이 필요합니다.');
  try { return await auth.verifyIdToken(match[1], true); }
  catch { throw httpError(401, '로그인을 다시 해주세요.'); }
}

async function verifiedStaff(req, auth, db, role) {
  const user = await verifiedUser(req, auth);
  const profile = await readStaffProfile(db, user.uid);
  if (!profile?.approved || !['master', 'admin', 'staff'].includes(profile.role) || (role && profile.role !== role)) {
    throw httpError(403, '이 작업을 수행할 권한이 없습니다.');
  }
  return { ...user, profile };
}

/** 공격자가 계속 다른 키를 보내도 맵의 크기는 제한한다. */
function createRateLimit(limit, windowMs = 60_000, capacity = 10_000) {
  const entries = new Map();
  return (key) => {
    const now = Date.now();
    if (entries.size >= capacity) for (const [id, entry] of entries) if (entry.until <= now) entries.delete(id);
    const existing = entries.get(key);
    if (!existing || existing.until <= now) {
      if (!existing && entries.size >= capacity) return false;
      entries.set(key, { count: 1, until: now + windowMs });
      return true;
    }
    return ++existing.count <= limit;
  };
}
module.exports = { httpError, verifiedUser, verifiedStaff, createRateLimit };
const { readStaffProfile } = require('./staff-profile');
