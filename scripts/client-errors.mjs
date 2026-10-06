// 사용자 기기에서 난 오류(예: 윈도우 사진 업로드) 최근 기록을 본다. 읽기 전용.
// 사용: npm run ops:client-errors
import { execFileSync } from 'node:child_process';
const project = process.env.FIREBASE_PROJECT || 'jinan-6c884';
const raw = execFileSync('npx', ['--yes', 'firebase-tools@15.32.1', 'database:get', '/clientErrors', '--project', project, '--order-by-key', '--limit-to-last', '50'], { encoding: 'utf8' });
const rows = Object.values(JSON.parse(raw || 'null') || {}).map(e => ({ when: new Date(e.at).toLocaleString('ko-KR'), area: e.area, code: e.code, message: e.message?.slice(0, 60), context: e.context?.slice(0, 80), os: /Windows/.test(e.ua) ? 'Windows' : /Mac/.test(e.ua) ? 'Mac' : /Android|iPhone/.test(e.ua) ? 'Mobile' : 'other' }));
console.table(rows);
