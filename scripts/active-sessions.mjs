// 운영 반영 전 점검: 진행 중(status=active) 수업을 한 번의 인덱스 쿼리로 읽고, 최근 활동·접속자 수만 요약한다.
// 사용: npm run ops:active-sessions  (firebase 로그인 필요, 읽기 전용)
import { execFileSync } from 'node:child_process';

const project = process.env.FIREBASE_PROJECT || 'jinan-6c884';
const raw = execFileSync('npx', ['--yes', 'firebase-tools@15.32.1', 'database:get', '/sessions', '--project', project,
  '--order-by', 'status', '--equal-to', 'active'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const sessions = JSON.parse(raw || 'null') || {};
const now = Date.now();
const rows = Object.entries(sessions).map(([id, s]) => {
  const last = Math.max(s.startedAt || 0, s.createdAt || 0, ...Object.values(s.participants || {}).map(p => p?.joinedAt || 0));
  const online = Object.values(s.participants || {}).filter(p => p?.connections && Object.keys(p.connections).length).length;
  return { id, course: s.courseName || '', mode: s.currentMode || '', online, hoursAgo: Math.round((now - last) / 36e5 * 10) / 10 };
}).sort((a, b) => a.hoursAgo - b.hoursAgo);
const live = rows.filter(r => r.online > 0 || r.hoursAgo < 3);
console.table(live.length ? live : rows.slice(0, 5));
console.log(`active 표시 ${rows.length}개 · 최근 3시간 내 활동 또는 접속자 있는 수업 ${live.length}개`);
