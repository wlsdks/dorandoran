const { createRateLimit } = require('./access');

const DEFAULT_ORIGINS = ['https://jinan-6c884.web.app', 'https://jinan-6c884.firebaseapp.com'];
function createHttpApi(service, { origins = process.env.APP_ALLOWED_ORIGINS || '', emulator = process.env.FUNCTIONS_EMULATOR === 'true', maxBodyBytes = 160_000 } = {}) {
  const allowed = new Set([...DEFAULT_ORIGINS, ...origins.split(',').map((value) => value.trim()).filter(Boolean)]);
  const rateLimit = createRateLimit(10_000);
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const origin = req.get('Origin');
    let local = false;
    try { const url = new URL(origin); local = emulator && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname); } catch { /* 잘못된 출처 */ }
    if (!allowed.has(origin) && !local) return res.status(403).json({ error: '허용되지 않은 출처입니다.' });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).send('');
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });
    if ((req.rawBody?.length || 0) > maxBodyBytes || Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') > maxBodyBytes) {
      return res.status(413).json({ error: '요청이 너무 큽니다.' });
    }
    if (!rateLimit(req.ip || 'unknown')) return res.status(429).json({ error: '요청이 너무 많습니다.' });
    try { return res.status(200).json(await service(req)); }
    catch (err) {
      if (!err.status) console.error('API 요청 처리 실패', { name: err.name, code: err.code });
      return res.status(err.status || 500).json({ error: err.status ? err.message : '요청 처리에 실패했습니다.' });
    }
  };
}
module.exports = { createHttpApi };
