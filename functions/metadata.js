const { httpError } = require('./access');

/** 계정·제출물·DM·투표 본문을 다운로드하지 않고, 키와 필요한 필드만 읽는다. */
async function shallowKeys(db, path) {
  if (!/^[A-Za-z0-9_/-]+$/.test(path)) throw httpError(400, '조회 경로를 확인해주세요.');
  let url;
  let headers;
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    const configured = new URL(db.app.options.databaseURL);
    const namespace = configured.searchParams.get('ns') || configured.hostname.split('.')[0];
    url = new URL(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/${path}.json`);
    url.searchParams.set('ns', namespace);
    headers = { Authorization: 'Bearer owner' };
  } else {
    url = new URL(db.ref(path).toString());
    url.pathname += '.json';
    const credential = db.app.options.credential;
    const token = await credential.getAccessToken();
    headers = { Authorization: `Bearer ${token.access_token}` };
  }
  url.searchParams.set('shallow', 'true');
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw httpError(502, '목록을 불러오지 못했습니다.');
  return Object.keys(await response.json() || {});
}

async function metadataList(db, path, fields, ids) {
  const keys = ids || await shallowKeys(db, path);
  if (keys.length > 2000) throw httpError(503, '목록이 많습니다. 강의별로 조회해주세요.');
  const result = [];
  for (let i = 0; i < keys.length; i += 12) {
    result.push(...await Promise.all(keys.slice(i, i + 12).map(async id => {
      const values = await Promise.all(fields.map(async field => [field, (await db.ref(`${path}/${id}/${field}`).get()).val()]));
      return { id, ...Object.fromEntries(values) };
    })));
  }
  return result;
}
module.exports = { shallowKeys, metadataList };
