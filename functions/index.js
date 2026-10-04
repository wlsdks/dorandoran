/**
 * Gemini API 프록시 — Firebase Cloud Function.
 *
 * 존재 이유: DoranDoran은 백엔드 없는 SPA다. 브라우저에서 Gemini를 직접 부르면 `VITE_` 환경변수가
 * 빌드 번들(dist/assets/*.js)에 평문으로 인라인되어 API 키가 그대로 유출된다.
 * (2026-07-02에 실제로 이 경로로 유출됐다.) 키는 Secret Manager에만 두고, 클라이언트는
 * 키 없이 이 함수를 경유한다.
 *
 * Hosting rewrite로 `/api/gemini/**` → 이 함수에 연결된다. 앱과 같은 출처라 CORS가 필요 없다.
 * 클라이언트(@google/generative-ai)는 requestOptions.baseUrl을 `/api/gemini`로 두고,
 * `{baseUrl}/v1beta/models/{model}:generateContent` 형태로 요청하며 키를 `x-goog-api-key`
 * 헤더에 싣는다 — 그 헤더는 여기서 버리고 진짜 키로 교체한다.
 *
 * ⚠️ 배포 시 반드시 함수를 지정할 것:  firebase deploy --only functions:geminiProxy
 *    이 Firebase 프로젝트에는 다른 코드베이스가 배포한 함수 19개가 함께 살고 있다.
 *    `--only functions` 로 배포하면 CLI가 그 함수들을 삭제 대상으로 본다.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/**
 * 업스트림 주소. 로컬 검증에서만 GEMINI_UPSTREAM으로 덮어쓴다(가짜 업스트림을 세워
 * 어떤 키가 실제로 전송되는지 확인하기 위한 이음매). 배포 환경에는 설정하지 않는다.
 */
const UPSTREAM = process.env.GEMINI_UPSTREAM || 'https://generativelanguage.googleapis.com';

/** 이 앱이 실제로 쓰는 모델만 통과시킨다 — 범용 Gemini 게이트웨이가 되지 않도록. */
const ALLOWED_MODELS = new Set(['gemini-2.5-flash-lite', 'gemini-2.5-flash']);

/** SDK가 부르는 task는 generateContent 뿐이다 (스트리밍 미사용). */
const ALLOWED_TASKS = new Set(['generateContent']);

/** 브라우저에서 이 함수를 부를 수 있는 출처. 같은 출처 요청은 Origin이 없거나 아래와 일치한다. */
const ALLOWED_ORIGINS = new Set([
  'https://jinan-6c884.web.app',
  'https://jinan-6c884.firebaseapp.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.APP_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);

/** 라이브 심사는 이미지 inlineData를 실어 보낸다 — 넉넉하되 무제한은 아니게. */
const MAX_BODY_BYTES = 6 * 1024 * 1024;

const PATH_RE = /^\/v1beta\/models\/([a-z0-9.-]+):([a-zA-Z]+)$/;

/**
 * IP당 rate limit — 인스턴스 메모리 기반이라 근사치다.
 * 인스턴스가 여러 개면 각자 세므로 실제 허용량은 (한도 × 인스턴스 수)까지 늘 수 있다.
 * 정확한 전역 카운터가 필요하면 RTDB나 Redis로 옮겨야 한다. 여기서는 maxInstances로
 * 상한을 묶어 최악의 경우를 제한하고, 진짜 안전망은 AI Studio의 일일 quota다.
 */
const WINDOW_MS = 60_000;
/**
 * 한도는 "사용자 1명"이 아니라 "교실 하나"를 기준으로 잡는다.
 * (1) 과제 심사는 제출물 1건마다 판사 7명을 동시에 호출한다(lib/judging/gemini.js judgeSubmission).
 *     50명 심사 = 350회를 7~8분에 쏘므로 분당 50회가 정상 트래픽이다.
 * (2) 교실 전원이 학교 NAT를 거치면 공인 IP가 하나로 합쳐져 학생용 AI 기능까지 같은 카운터를 쓴다.
 * 30회였을 때는 5번째 제출물부터 자기 요청을 스스로 막았다. 개별 스로틀이 아니라 폭주 상한이다.
 */
const MAX_PER_WINDOW = 300;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start >= WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    // 창이 지난 항목 정리 — 메모리 누수 방지.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now - v.start >= WINDOW_MS) hits.delete(k);
    }
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

function deny(res, status, message) {
  res.status(status).json({ error: { message } });
}

exports.geminiProxy = onRequest(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY],
    // 최악의 경우 과금 폭주를 막는 상한. 교실 규모에는 충분하다.
    maxInstances: 5,
    memory: '256MiB',
    timeoutSeconds: 120,
    // Hosting rewrite를 통해서만 부르므로 CORS는 필요 없다. 직접 호출 시엔 Origin 검사로 막는다.
    cors: false,
  },
  async (req, res) => {
    // 브라우저는 같은 출처라도 POST에는 Origin을 붙인다(Fetch 표준). 이 앱은 POST만 쓰므로
    // Origin을 필수로 요구할 수 있고, 그러면 헤더를 안 붙이는 순진한 curl 호출이 걸러진다.
    // (Origin은 위조 가능하므로 이건 차단이 아니라 억제다.)
    const origin = req.get('Origin');
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return deny(res, 403, 'Origin이 허용되지 않았습니다.');
    }
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'content-type, x-goog-api-key, x-goog-api-client');
      res.set('Access-Control-Max-Age', '86400');
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return deny(res, 405, 'POST만 허용됩니다.');
    }

    // Hosting rewrite는 원본 경로(/api/gemini/v1beta/...)를 그대로 전달한다.
    const path = (req.path || '').replace(/^\/api\/gemini/, '');
    const match = PATH_RE.exec(path);
    if (!match) {
      return deny(res, 404, '지원하지 않는 경로입니다.');
    }

    const [, model, task] = match;
    if (!ALLOWED_MODELS.has(model)) {
      return deny(res, 400, `허용되지 않은 모델입니다: ${model}`);
    }
    if (!ALLOWED_TASKS.has(task)) {
      return deny(res, 400, `허용되지 않은 작업입니다: ${task}`);
    }

    const ip = req.ip || 'unknown';
    if (rateLimited(ip)) {
      return deny(res, 429, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }

    // onRequest는 body를 이미 파싱해 둔다. 다시 직렬화해 크기를 재고 그대로 전달한다.
    const body = JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return deny(res, 413, '요청 본문이 너무 큽니다.');
    }

    // 클라이언트가 보낸 헤더는 신뢰하지 않는다. 필요한 것만 새로 조립하고
    // x-goog-api-key는 서버 시크릿으로 덮어쓴다.
    let upstream;
    try {
      upstream = await fetch(`${UPSTREAM}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY.value(),
        },
        body,
      });
    } catch (err) {
      console.error('업스트림 호출 실패', err);
      return deny(res, 502, 'Gemini 호출에 실패했습니다.');
    }

    const text = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    return res.send(text);
  },
);
