const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);

async function hashCredential(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return { algorithm: 'scrypt', salt, hash: hash.toString('hex') };
}

async function verifyCredential(password, credential, legacyHash) {
  if (credential?.algorithm === 'scrypt' && /^[a-f0-9]{32}$/.test(credential.salt || '') && /^[a-f0-9]{128}$/.test(credential.hash || '')) {
    const actual = await derive(password, credential.salt, 64);
    return timingSafeEqual(actual, Buffer.from(credential.hash, 'hex'));
  }
  if (/^[a-f0-9]{64}$/i.test(legacyHash || '')) {
    return timingSafeEqual(createHash('sha256').update(password).digest(), Buffer.from(legacyHash, 'hex'));
  }
  // 없는 계정도 비슷한 비용으로 확인해 계정 조회의 시간 차이를 줄인다.
  await derive(password, 'credential-not-found', 64);
  return false;
}

function nameKey(name) { return createHash('sha256').update(name.normalize('NFKC').trim().toLowerCase()).digest('hex'); }
function equalLegacyPin(input, stored) {
  return typeof stored === 'string' && stored.length > 0 && timingSafeEqual(createHash('sha256').update(input).digest(), createHash('sha256').update(stored).digest());
}
module.exports = { hashCredential, verifyCredential, nameKey, equalLegacyPin };
