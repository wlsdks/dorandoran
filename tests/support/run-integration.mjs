import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('demo 에뮬레이터 안에서만 검증합니다.');
const env = { ...process.env, VITE_GEMINI_API_KEY: '', VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_PROJECT_ID: 'demo-dorandoran',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-dorandoran.firebaseapp.com', VITE_FIREBASE_DATABASE_URL: 'https://demo-dorandoran.firebaseio.com',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-dorandoran.appspot.com', VITE_FIREBASE_EMULATORS: 'true', VITE_AI_ENABLED: 'true' };
const children = [];
function start(command, args) { const child = spawn(command, args, { env, stdio: 'inherit' }); children.push(child); return child; }
async function run(command, args) { const child = start(command, args); const [code] = await once(child, 'exit'); if (code) throw new Error(`${command} 검증 실패 (${code})`); }
try {
  start('node', ['tests/support/api-server.cjs']);
  // QA_SUITE=security: PR마다 도는 빠른 검증 — 보안 규칙·리소스 수명만 본다(브라우저·Vite 불필요).
  if (process.env.QA_SUITE === 'security') {
    for (let i = 0; i < 60; i++) {
      try { await fetch('http://127.0.0.1:5001'); break; } catch { /* 시작 대기 */ }
      if (i === 59) throw new Error('API 서버 시작 실패');
      await pause(250);
    }
    await run('node', ['--test', 'tests/security/resource-lifecycle.test.cjs']);
    await run('node', ['--test', 'tests/security/firebase-rules.test.mjs']);
    await run('node', ['--test', 'tests/security/quiz-tally-fallback.test.cjs']);
    process.exitCode = 0;
  } else {
  start('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5175', '--strictPort', '--mode', 'qa']);
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:5175'); if (r.ok) break; } catch { /* 시작 대기 */ }
    if (i === 59) throw new Error('QA 서버 시작 실패');
    await pause(250);
  }
  await run('node', ['--test', 'tests/security/resource-lifecycle.test.cjs']);
  await run('node', ['--test', 'tests/security/firebase-rules.test.mjs']);
  await run('node', ['--test', 'tests/security/quiz-tally-fallback.test.cjs']);
  await run('node', ['tests/support/seed-runtime.cjs']);
  await run('node', ['tests/support/realtime-stress.cjs']);
  await run('node', ['tests/support/judging-lifecycle-qa.cjs']);
  await run('node', ['tests/support/presentation-qa.cjs']);
  await run('node', ['tests/support/quiz-audience-qa.cjs']);
  await run('node', ['tests/support/quiz-interaction-qa.cjs']);
  await run('node', ['tests/support/achievement-lifecycle-qa.cjs']);
  await run('node', ['tests/support/ranking-highlight-qa.cjs']);
  await run('node', ['tests/support/reaction-sheet-qa.cjs']);
  await run('node', ['tests/support/end-state-qa.cjs']);
  await run('node', ['tests/support/dialog-layer-qa.cjs']);
  await run('node', ['tests/support/combined-ranking-qa.cjs']);
  await run('node', ['tests/support/student-qa.cjs']);
  await run('node', ['tests/support/vote-ack-qa.cjs']);
  await run('node', ['tests/support/quiz-awards-qa.cjs']);
  await run('node', ['tests/support/lesson-event-qa.cjs']);
  await run('node', ['tests/support/quiz-event-selection-qa.cjs']);
  await run('node', ['tests/support/speed-quiz-qa.cjs']);
  await run('node', ['tests/support/game-pages-qa.cjs']);
  await run('node', ['tests/support/submission-qa.cjs']);
  await run('node', ['tests/support/silent-ui-qa.cjs']);
  await run('node', ['tests/support/classroom-ui-qa.cjs']);
  await run('node', ['tests/support/classroom-ux-qa.cjs']);
  await run('node', ['tests/support/classroom-load-qa.cjs']);
  await run('node', ['tests/support/quiz-load-qa.cjs']);
  }
} finally { for (const child of children) if (child.exitCode === null) child.kill('SIGTERM'); }
