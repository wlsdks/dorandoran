import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';
import { ref as storageRef, uploadBytes } from 'firebase/storage';

const projectId = 'demo-dorandoran';
const origin = 'http://127.0.0.1:5175';
const password = 'TestFixture-Only-Strong8';
let environment;
const staff = (uid, role) => environment.authenticatedContext(uid, { role, approved: true }).database();
const student = uid => environment.authenticatedContext(uid).database();
const hash = createHash('sha256').update(password).digest('hex');
const fixture = {
  admins: {
    legacy_master: { username: 'qa-master', displayName: '테스트 관리자', role: 'master', approved: true, passwordHash: hash },
    legacy_teacher: { username: 'qa-teacher', displayName: '테스트 강사', role: 'admin', approved: true, passwordHash: hash },
    legacy_staff: { username: 'qa-staff', displayName: '테스트 스태프', role: 'staff', approved: true, passwordHash: hash },
    pending_teacher: { username: 'qa-pending', displayName: '승인 대기', role: 'admin', approved: false, passwordHash: hash },
  },
  courses: { course_a: { name: '함께 생각하는 수업', ownerId: 'legacy_teacher', ownerName: '테스트 강사', createdAt: 1 }, course_b: { name: '다른 강의', ownerId: 'other_teacher', createdAt: 1 } },
  staffCourses: { legacy_staff: { course_a: true } },
  sessions: {
    qa_room: { creatorId: 'legacy_teacher', courseId: 'course_a', courseName: '함께 생각하는 수업', createdAt: 1, currentMode: 'poll', currentQuestion: 'q1', status: 'active',
      participants: { student_a: { nickname: '도란친구', online: true, joinedAt: 1 }, student_b: { nickname: '두런친구', online: true, joinedAt: 1 } },
      questions: { q1: { title: '정답을 고르세요', type: 'quiz', options: ['A', 'B'], correctAnswer: 'B', order: 1 }, q2: { title: '한마디', type: 'wordcloud', order: 2 }, slides: { title: '함께 배우기', type: 'imageSlide', slideImages: ['/qa-slide-1.svg', '/qa-slide-2.svg', '/qa-slide-3.svg'], currentSlide: 0, order: 0 } },
      publicQuestions: { q1: { title: '정답을 고르세요', type: 'quiz', options: ['A', 'B'], order: 1 } },
      dm: { dm_a: { studentId: 'student_a', studentName: '도란친구', status: 'waiting', createdAt: 1, messages: { m1: { text: '비공개 질문', sender: '도란친구', senderType: 'student', timestamp: 1 } } } },
      dmByStudent: { student_a: 'dm_a' },
    },
    other_room: { creatorId: 'other_teacher', courseId: 'course_b', courseName: '다른 강의', createdAt: 1, status: 'active', questions: { q1: { title: '다른 강의', type: 'choice', options: ['A'] } } },
  },
  assignments: { legacy_assignment: { title: '검증 과제', courseName: '함께 생각하는 수업', status: 'open', createdAt: 1,
    submissions: { old_submission: { name: '이전 학생', pin: '5274', code: '<p>기존 제출물</p>', submittedAt: 1 } } } },
};
const api = async (path, body, token) => {
  const response = await fetch(`http://127.0.0.1:5001${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
};
before(async () => {
  environment = await initializeTestEnvironment({ projectId, database: { host: '127.0.0.1', port: 9000, rules: await readFile('database.rules.json', 'utf8') }, storage: { host: '127.0.0.1', port: 9199, rules: await readFile('storage.rules', 'utf8') } });
  await environment.clearDatabase();
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database()), fixture));
});
after(async () => environment?.cleanup());

test('비인증 사용자는 계정·DB 루트·점수에 접근할 수 없다', async () => {
  const db = environment.unauthenticatedContext().database();
  await assertFails(get(ref(db, 'admins')));
  await assertFails(get(ref(db)));
  await assertFails(set(ref(db, 'admins/attacker'), { username: 'attacker', passwordHash: hash, role: 'master', approved: true }));
  await assertFails(set(ref(db, 'sessions/qa_room/scores/student_a'), { nickname: '가짜', total: 10000 }));
});
test('학생은 본인 DM만 읽고 타인 DM·미공개 정답을 읽을 수 없다', async () => {
  const a = student('student_a'); const b = student('student_b');
  await assertSucceeds(get(ref(a, 'sessions/qa_room/dm/dm_a')));
  await assertFails(get(ref(b, 'sessions/qa_room/dm/dm_a')));
  await assertFails(get(ref(a, 'sessions/qa_room/dm')));
  await assertFails(get(ref(a, 'sessions/qa_room/questions')));
  await assertFails(get(ref(a, 'sessions/qa_room/questions/q1/correctAnswer')));
  await assertSucceeds(get(ref(a, 'sessions/qa_room/publicQuestions')));
});
test('학생은 본인 투표만 쓰고 점수·권한을 조작할 수 없다', async () => {
  const db = student('student_a');
  await assertSucceeds(set(ref(db, 'sessions/qa_room/questions/q1/votes/student_a'), { value: 'A', nickname: '도란친구', timestamp: Date.now() }));
  await assertFails(set(ref(db, 'sessions/qa_room/questions/q1/votes/student_b'), { value: 'B', nickname: '다른 학생', timestamp: Date.now() }));
  await assertFails(set(ref(db, 'sessions/qa_room/questions/q1/votes/student_a'), { value: 'B', nickname: '도란친구', timestamp: Date.now(), bet: 999 }));
  await assertFails(set(ref(db, 'sessions/qa_room/scores/student_a'), { nickname: '도란친구', total: 9999 }));
  await assertFails(set(ref(db, 'staffProfiles/student_a/role'), 'master'));
  await assertFails(set(ref(db, 'sessions/qa_room/qaStats/student_a'), { questions: 10000 }));
});
test('승인 강사와 스태프의 강의 제어 범위를 제한한다', async () => {
  await assertSucceeds(set(ref(staff('legacy_teacher', 'admin'), 'sessions/qa_room/currentMode'), 'quiz'));
  await assertFails(set(ref(staff('legacy_teacher', 'admin'), 'sessions/other_room/currentMode'), 'quiz'));
  await assertSucceeds(get(ref(staff('legacy_staff', 'staff'), 'sessions/qa_room/dm')));
  await assertFails(set(ref(staff('legacy_staff', 'staff'), 'sessions/qa_room/currentQuestion'), 'q2'));
  await assertFails(get(ref(student('pending_teacher'), 'sessions/qa_room/dm')));
});
test('학생은 제출물·PIN을 열거할 수 없고 공개 메타만 읽는다', async () => {
  const db = student('student_a');
  await assertFails(get(ref(db, 'assignments')));
  await assertFails(get(ref(db, 'assignments/legacy_assignment/submissions')));
  await assertFails(get(ref(db, 'assignments/legacy_assignment/submissions/old_submission/pin')));
  await assertSucceeds(get(ref(db, 'assignments/legacy_assignment/title')));
});
test('Storage는 비인증·타인 경로·SVG와 HTML 업로드를 거부한다', async () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  await assertFails(uploadBytes(storageRef(environment.unauthenticatedContext().storage(), 'assignments/a/student_a/a.png'), png, { contentType: 'image/png' }));
  const storage = environment.authenticatedContext('student_a').storage();
  await assertSucceeds(uploadBytes(storageRef(storage, 'assignments/a/student_a/a.png'), png, { contentType: 'image/png' }));
  await assertFails(uploadBytes(storageRef(storage, 'assignments/a/student_b/a.png'), png, { contentType: 'image/png' }));
  await assertFails(uploadBytes(storageRef(storage, 'assignments/a/student_a/a.svg'), png, { contentType: 'image/svg+xml' }));
  await assertFails(uploadBytes(storageRef(storage, 'assignments/a/student_a/a.html'), png, { contentType: 'text/html' }));
});
test('기존 강사 로그인은 같은 UID·권한을 유지하고 원자료를 변경하지 않는다', async () => {
  let before;
  await environment.withSecurityRulesDisabled(async context => { before = (await get(ref(context.database(), 'admins'))).val(); });
  const result = await api('/api/staff/login', { username: 'qa-master', password });
  assert.equal(result.status, 200); assert.equal(result.body.profile.uid, 'legacy_master'); assert.equal(result.body.profile.role, 'master');
  assert.ok(result.body.token); assert.equal(result.body.profile.passwordHash, undefined);
  await environment.withSecurityRulesDisabled(async context => assert.deepEqual((await get(ref(context.database(), 'admins'))).val(), before));
});
test('가입 시 master 승격·짧은 비밀번호·기존 아이디 탈취를 거부한다', async () => {
  assert.equal((await api('/api/staff/register', { username: 'new-user', password, displayName: '신규', role: 'master' })).status, 400);
  assert.equal((await api('/api/staff/register', { username: 'new-user', password: '1234', displayName: '신규', role: 'staff' })).status, 400);
  assert.equal((await api('/api/staff/register', { username: 'qa-master', password, displayName: '탈취시도', role: 'admin' })).status, 409);
  assert.equal((await api('/api/staff/approve', { uid: 'pending_teacher' })).status, 401);
});

test('AI 상태 확인은 비인증을 거부하고 테스트 연결을 실제 연결로 표시하지 않는다', async () => {
  assert.equal((await api('/api/gemini/status', { sessionId: 'qa_room' })).status, 401);
  const signup = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const { idToken } = await signup.json();
  const status = await api('/api/gemini/status', { sessionId: 'qa_room' }, idToken);
  assert.equal(status.status, 200);
  assert.equal(status.body.configured, false);
  assert.equal(status.body.available, false);
  assert.equal(status.body.studentFeaturesAvailable, false);
  assert.equal(status.body.key, undefined);
  assert.equal(status.body.token, undefined);
  assert.equal((await api('/api/gemini/status', {}, idToken)).status, 403);
  assert.equal((await api('/api/gemini/v1beta/models/gemini-2.5-flash:generateContent', { contents: '금지된 요청' }, idToken)).status, 403);
});
