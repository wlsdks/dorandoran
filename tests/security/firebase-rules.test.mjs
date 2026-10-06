import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update } from 'firebase/database';
import { ref as storageRef, uploadBytes } from 'firebase/storage';

const projectId = process.env.QA_RULES_PROJECT_ID || 'demo-dorandoran';
if (!/^demo-[a-z0-9-]+$/.test(projectId)) throw new Error('Rules QA requires a demo project.');
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

test('퀴즈 공개 전 집계는 참가자에게 숫자만 허용하고 원본/위조/지난 회차를 거부한다', async () => {
  const path = 'sessions/public_distribution_probe';
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), path), {
    creatorId: 'legacy_master', courseId: 'course_a', createdAt: 1,
    participants: { student_a: { nickname: '도란' }, student_b: { nickname: '두런' } },
    questions: { q: { type: 'quiz', title: '비율 검증', options: ['A', 'B'], correctAnswer: 'B', activatedAt: 101,
      votes: { student_b: { value: 'B', nickname: '두런' } } } },
  }));
  const master = staff('legacy_master', 'master'), guest = student('student_a');
  const aggregatePath = `${path}/publicQuizAggregates/q`;
  const valid = { round: 101, total: 2, counts: [1, 1] };
  await assertSucceeds(set(ref(master, aggregatePath), valid));
  assert.deepEqual((await assertSucceeds(get(ref(guest, aggregatePath)))).val(), valid);
  await assertFails(get(ref(guest, `${path}/questions/q/correctAnswer`)));
  await assertFails(get(ref(guest, `${path}/questions/q/votes`)));
  await assertFails(get(ref(student('outsider'), aggregatePath)));
  await assertFails(set(ref(guest, aggregatePath), { ...valid, total: 999 }));
  await assertFails(set(ref(staff('legacy_staff', 'staff'), aggregatePath), valid));
  for (const invalid of [{ ...valid, nickname: 'leak' }, { ...valid, correctAnswer: 'B' },
    { ...valid, counts: [-1, 3] }, { ...valid, counts: [0.5, 1.5] }, { ...valid, round: 100 }]) {
    await assertFails(set(ref(master, aggregatePath), invalid));
  }
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), `${path}/questions/q/activatedAt`), 202));
  await assertFails(set(ref(master, aggregatePath), valid));
  await assertSucceeds(set(ref(master, aggregatePath), { round: 202, total: 0, counts: [0, 0] }));
});

test('순위 강조는 수업 소유자만 지정하고 참가자는 읽기만 가능하다', async () => {
  const path = 'sessions/qa_room/leaderboardHighlight';
  const owner = staff('legacy_teacher', 'admin');
  const valid = { ranks: [1, 3, 10], activeRank: 3, enabled: true };
  await assertSucceeds(set(ref(owner, path), valid));
  assert.deepEqual((await assertSucceeds(get(ref(student('student_a'), path)))).val(), valid);
  await assertFails(get(ref(student('outsider'), path)));
  await assertFails(set(ref(student('student_a'), path), valid));
  await assertFails(set(ref(staff('legacy_staff', 'staff'), path), valid));
  await assertFails(set(ref(staff('other_teacher', 'admin'), path), valid));
  for (const invalid of [{ ...valid, activeRank: 2 }, { ...valid, ranks: [0] },
    { ...valid, ranks: [1.5] }, { ...valid, ranks: [] }, { ...valid, enabled: false },
    { ...valid, ranks: Array.from({ length: 11 }, (_, i) => i + 1) },
    { ...valid, studentId: 'student_a' }, { ...valid, total: 999 },
    { ...valid, revealed: 11 }, { ...valid, revealed: 1.5 }, { ...valid, revealed: -1 }, { ...valid, revealed: '2' }]) {
    await assertFails(set(ref(owner, path), invalid));
  }
  await assertSucceeds(set(ref(owner, path), { ...valid, revealed: 2 }));
  await assertSucceeds(set(ref(owner, path), null));
});

test('특별 순위 계획은 공개 전까지 enabled:false로 저장되고 activeRank 없이만 허용된다', async () => {
  const path = 'sessions/qa_room/leaderboardHighlight';
  const owner = staff('legacy_teacher', 'admin');
  const plan = { ranks: [1, 2, 3, 27], enabled: false, revealed: 0 };
  await assertSucceeds(set(ref(owner, path), plan));
  assert.deepEqual((await assertSucceeds(get(ref(student('student_a'), path)))).val(), plan);
  await assertFails(set(ref(student('student_a'), path), plan));
  await assertFails(set(ref(staff('other_teacher', 'admin'), path), plan));
  for (const invalid of [{ ...plan, activeRank: 1 }, { ...plan, ranks: [] }, { ...plan, enabled: 'false' },
    { ranks: [1, 2], revealed: 0 }, { ...plan, revealed: 11 }, { ...plan, note: 'x' }]) {
    await assertFails(set(ref(owner, path), invalid));
  }
  await assertSucceeds(set(ref(owner, path), { ranks: [1, 2, 3, 27], enabled: false, revealed: 2 }));
  await assertSucceeds(set(ref(owner, path), { ranks: [1, 2, 3, 27], activeRank: 3, enabled: true, revealed: 3 }));
  await assertSucceeds(set(ref(owner, path), null));
});

test('공개 점수 설정은 원본과 일치하며 미공개 정답·원본 투표는 포함할 수 없다', async () => {
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), 'sessions/public_meta_probe'), {
    creatorId: 'legacy_master', createdAt: 1, status: 'active',
    participants: { student_a: { nickname: '공개 메타 QA', joinedAt: 1 } },
    questions: { q: { type: 'quiz', title: '메타 검증', correctAnswer: 'A', points: 100, maxSpeedBonus: 50, speedWindowMs: 10000 } },
  }));
  const db = staff('legacy_master', 'master');
  const path = 'sessions/public_meta_probe/publicQuestions/q';
  const publicValue = { type: 'quiz', title: '메타 검증', points: 100, maxSpeedBonus: 50, speedWindowMs: 10000 };
  await assertSucceeds(set(ref(db, path), publicValue));
  await assertFails(set(ref(db, path), { ...publicValue, points: 999 }));
  await assertFails(set(ref(db, path), { ...publicValue, correctAnswer: 'A' }));
  await assertFails(set(ref(db, path), { ...publicValue, votes: { student_a: { value: 'A' } } }));
  await assertFails(set(ref(db, path), { ...publicValue, awardedAt: 200 }));
  await assertFails(set(ref(db, path), { ...publicValue, answerImageUrl: 'https://img.example/answer.jpg' }));
  await assertFails(set(ref(db, path), { ...publicValue, answerExplanation: '미공개 해설' }));
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), 'sessions/public_meta_probe/questions/q/revealedAt'), 200);
    await set(ref(context.database(), 'sessions/public_meta_probe/questions/q/awardedAt'), 200);
  });
  await assertSucceeds(set(ref(db, path), { ...publicValue, correctAnswer: 'A', revealedAt: 200, awardedAt: 200 }));
  await assertSucceeds(set(ref(db, path + '/answerImageUrl'), 'https://img.example/answer.jpg'));
  await assertFails(set(ref(db, path + '/answerImageUrl'), 'javascript:alert(1)'));
  // Storage 에뮬레이터 주소(http)도 허용해야 정답 공개 동기화 전체가 막히지 않는다.
  await assertSucceeds(set(ref(db, path + '/answerImageUrl'), 'http://127.0.0.1:9199/v0/b/demo/o/answer.png'));
  await assertSucceeds(get(ref(student('student_a'), path + '/answerImageUrl')));
  await assertSucceeds(set(ref(db, path + '/answerExplanation'), '공개된 해설'));
  await assertFails(set(ref(db, path + '/answerExplanation'), 'x'.repeat(501)));
  await assertSucceeds(get(ref(student('student_a'), path + '/awardedAt')));
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
test('응답 초기화는 그 문항으로 받은 퀴즈 점수를 되돌리고, 학생은 점수를 고칠 수 없다', async () => {
  const base = 'sessions/qa_room';
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), `${base}/questions/reset_probe`), { title: '초기화 문항', type: 'quiz', options: ['A', 'B'], correctAnswer: 'A', revealedAt: 20, awardedAt: 20,
      votes: { s1: { value: 'A', nickname: '학생', timestamp: 1 } } });
    await set(ref(context.database(), `${base}/scores/s1`), { nickname: '학생', total: 245, quizAwards: { reset_probe: { round: 20, points: 145 }, other: { round: 5, points: 100 } } });
  });
  await assertFails(update(ref(student('s1'), base), { 'scores/s1/total': 9999 }));
  await assertSucceeds(update(ref(staff('legacy_teacher', 'admin'), base), {
    'scores/s1/total': 100, 'scores/s1/quizAwards/reset_probe': null,
    'questions/reset_probe/votes': null, 'questions/reset_probe/revealedAt': null, 'questions/reset_probe/awardedAt': null,
  }));
  await environment.withSecurityRulesDisabled(async context => {
    const score = (await get(ref(context.database(), `${base}/scores/s1`))).val();
    assert.equal(score.total, 100); assert.equal(score.quizAwards.reset_probe, undefined); assert.equal(score.quizAwards.other.points, 100);
  });
});

test('문항 시간 제한은 5~3600초 정수만 저장된다', async () => {
  const owner = staff('legacy_teacher', 'admin');
  const path = 'sessions/qa_room/questions/timer_probe';
  await assertSucceeds(set(ref(owner, path), { title: '시간 제한', type: 'choice', options: ['A', 'B'], timerDuration: 30 }));
  await assertFails(update(ref(owner, path), { timerDuration: 2 }));
  await assertFails(update(ref(owner, path), { timerDuration: 4000 }));
  await assertFails(update(ref(owner, path), { timerDuration: 12.5 }));
  await assertFails(update(ref(owner, path), { timerDuration: '30' }));
  await assertSucceeds(update(ref(owner, path), { timerDuration: null }));
});

test('순위 맞추기 정답은 항목 번호 순서 문자열("0,2,3,1")만 저장된다', async () => {
  const owner = staff('legacy_teacher', 'admin');
  const path = 'sessions/qa_room/questions/ranking_probe';
  const items = ['DNS 조회', '렌더링', '요청 전송', '응답 생성'];
  await assertSucceeds(set(ref(owner, path), { title: '순서 맞추기', type: 'ranking', options: items, correctAnswer: '0,2,3,1' }));
  // 예전 형식(저장 순서 = 정답)도 그대로 쓸 수 있다.
  await assertSucceeds(update(ref(owner, path), { correctAnswer: '0,1,2,3' }));
  await assertFails(update(ref(owner, path), { correctAnswer: 'DNS 조회' }));
  await assertFails(update(ref(owner, path), { correctAnswer: '0,2,,1' }));
  await assertFails(update(ref(owner, path), { correctAnswer: [0, 2, 3, 1] }));
  await assertFails(update(ref(owner, path), { correctAnswer: 2 }));
  // 다른 유형의 정답은 글자 그대로다.
  await assertSucceeds(set(ref(owner, 'sessions/qa_room/questions/ranking_quiz_probe'), { title: '퀴즈', type: 'quiz', options: ['A', 'B'], correctAnswer: 'B' }));
});

test('서버 예비 집계가 쓴 뒤에도 강사 화면은 집계를 다시 덮고 신호를 보낼 수 있다', async () => {
  const question = 'sessions/qa_room/questions/tally_probe';
  const aggregatePath = 'sessions/qa_room/publicQuizAggregates/tally_probe';
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), question), { title: '퀴즈', type: 'quiz', options: ['A', 'B'], correctAnswer: 'A', activatedAt: 77 });
    // 서버(Admin SDK)가 남기는 모양 — 규칙 밖 필드(source/serverAt)를 포함한다.
    await set(ref(context.database(), aggregatePath), { round: 77, total: 2, counts: [1, 1], heartbeat: 1, source: 'server', serverAt: Date.now() });
  });
  const owner = staff('legacy_teacher', 'admin');
  await assertSucceeds(update(ref(owner, aggregatePath), { heartbeat: Date.now() }));
  await assertSucceeds(set(ref(owner, aggregatePath), { round: 77, total: 2, counts: [1, 1], heartbeat: Date.now() }));
  // 클라이언트는 서버 표시를 흉내 낼 수 없다.
  await assertFails(set(ref(owner, aggregatePath), { round: 77, total: 2, counts: [1, 1], source: 'server' }));
  await assertFails(update(ref(student('student_a'), aggregatePath), { heartbeat: Date.now() }));
});

test('정답 공개된 문항도 강사는 필드 단위로 수정할 수 있고 학생 투표는 보존된다', async () => {
  const path = 'sessions/qa_room/questions/edit_probe';
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), path), {
    title: '공개된 문항', type: 'quiz', options: ['A', 'B'], correctAnswer: 'A', revealedAt: 10,
    votes: { s1: { value: 'A', nickname: '학생', timestamp: 1 } },
  }));
  const owner = staff('legacy_teacher', 'admin');
  // 문항 전체 set은 투표까지 다시 써서 거부된다 — 수정은 update로 해야 한다.
  await assertFails(set(ref(owner, path), { title: '바뀐 제목', type: 'quiz', options: ['A', 'B'], correctAnswer: 'A', revealedAt: 10, votes: { s1: { value: 'A', nickname: '학생', timestamp: 1 } } }));
  await assertSucceeds(update(ref(owner, path), { title: '바뀐 제목', options: ['A', 'C'], optionImages: null }));
  await environment.withSecurityRulesDisabled(async context => {
    const value = (await get(ref(context.database(), path))).val();
    assert.equal(value.title, '바뀐 제목'); assert.equal(value.votes.s1.value, 'A');
  });
});

test('닉네임 색인은 먼저 쓴 학생 것이고, 점수 이름은 본인 닉네임과 같을 때만 바꿀 수 있다', async () => {
  const base = 'sessions/nick_probe';
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), base), {
    creatorId: 'legacy_teacher', courseId: 'course_a', createdAt: 1, status: 'active',
    participants: { stu_a: { nickname: '민준' } }, scores: { stu_a: { nickname: '민준', total: 100 } },
  }));
  const a = student('stu_a'), b = student('stu_b');
  await assertSucceeds(set(ref(a, `${base}/nicknames/민준`), 'stu_a'));
  await assertFails(set(ref(b, `${base}/nicknames/민준`), 'stu_b'));
  await assertFails(set(ref(b, `${base}/nicknames/민준`), null));
  await assertSucceeds(update(ref(a, base), { 'participants/stu_a/nickname': '지훈', 'scores/stu_a/nickname': '지훈', 'nicknames/민준': null, 'nicknames/지훈': 'stu_a' }));
  await assertFails(update(ref(a, base), { 'scores/stu_a/nickname': '다른이름' }));
  await assertFails(update(ref(a, base), { 'scores/stu_a/total': 999 }));
});

test('학생은 자기 수업 질문에 공감할 수 없다', async () => {
  const base = 'sessions/qa_upvote_probe';
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), base), {
    creatorId: 'legacy_teacher', courseId: 'course_a', createdAt: 1, status: 'active',
    participants: { stu_a: { nickname: '가' }, stu_b: { nickname: '나' } },
    classQuestions: { q: { text: '질문', nickname: '가', participantId: 'stu_a', timestamp: 1 } },
  }));
  await assertFails(set(ref(student('stu_a'), `${base}/classQuestions/q/upvotes/stu_a`), true));
  await assertSucceeds(set(ref(student('stu_b'), `${base}/classQuestions/q/upvotes/stu_b`), true));
});

test('토론 시간이 끝나면 학생 메모를 받지 않는다', async () => {
  const base = 'sessions/discussion_probe';
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), base), {
    creatorId: 'legacy_teacher', courseId: 'course_a', createdAt: 1, status: 'active',
    participants: { stu_a: { nickname: '가' } }, discussion: { duration: 60, endTime: Date.now() + 60000 },
  }));
  await assertSucceeds(set(ref(student('stu_a'), `${base}/discussion/memos/m1`), { text: '메모', nickname: '가', pid: 'stu_a', timestamp: 1 }));
  await environment.withSecurityRulesDisabled(async context => set(ref(context.database(), `${base}/discussion/endTime`), Date.now() - 60000));
  await assertFails(set(ref(student('stu_a'), `${base}/discussion/memos/m2`), { text: '늦은 메모', nickname: '가', pid: 'stu_a', timestamp: 2 }));
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

test('사용자 기기 오류 보고는 로그인 사용자가 한 번만 쓰고 아무도 읽을 수 없다', async () => {
  const me = student('error_reporter');
  const entry = { area: 'image-upload', code: 'storage/unknown', message: '실패', context: '{}', ua: 'Windows', at: Date.now() };
  await assertSucceeds(set(ref(me, 'clientErrors/e1'), entry));
  await assertFails(set(ref(me, 'clientErrors/e1'), entry));
  await assertFails(set(ref(me, 'clientErrors/e2'), { ...entry, extra: 'x' }));
  await assertFails(get(ref(me, 'clientErrors')));
  await assertFails(set(ref(environment.unauthenticatedContext().database(), 'clientErrors/e3'), entry));
});
