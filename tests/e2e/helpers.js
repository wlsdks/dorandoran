/**
 * Shared helpers for Playwright E2E tests.
 * Provides Firebase setup/teardown and common navigation utilities.
 */

// Firebase REST API base
const DB_URL = 'https://jinan-6c884-default-rtdb.asia-southeast1.firebasedatabase.app';

/** Unique test session ID to avoid collisions. */
export function testSessionId() {
  return `e2e_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Write data to Firebase RTDB via REST. */
export async function firebaseSet(path, data) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase PUT ${path} failed: ${res.status}`);
  return res.json();
}

/** Read data from Firebase RTDB via REST. */
export async function firebaseGet(path) {
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status}`);
  return res.json();
}

/** Delete data from Firebase RTDB via REST. */
export async function firebaseDelete(path) {
  const res = await fetch(`${DB_URL}/${path}.json`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Firebase DELETE ${path} failed: ${res.status}`);
}

/** Create a test session in Firebase with basic question setup. */
export async function createTestSession(sessionId, overrides = {}) {
  const session = {
    status: 'active',
    currentQuestion: null,
    currentMode: 'poll',
    courseName: 'E2E 테스트 수업',
    roundNumber: 1,
    createdAt: Date.now(),
    questions: {
      q1: {
        title: '좋아하는 프로그래밍 언어는?',
        type: 'choice',
        options: ['JavaScript', 'Python', 'TypeScript', 'Go'],
        order: 0,
      },
      q2: {
        title: '이번 수업 이해도는?',
        type: 'ox',
        options: ['O', 'X'],
        order: 1,
      },
      q3: {
        title: '수업에서 가장 좋았던 점은?',
        type: 'wordcloud',
        options: [],
        order: 2,
      },
      q4: {
        title: '수도 퀴즈: 한국의 수도는?',
        type: 'quiz',
        options: ['서울', '부산', '인천', '대구'],
        correctAnswer: '서울',
        order: 3,
      },
    },
    ...overrides,
  };
  await firebaseSet(`sessions/${sessionId}`, session);
  return session;
}

/** Activate a specific question in a session. */
export async function activateQuestion(sessionId, questionId) {
  await firebaseSet(`sessions/${sessionId}/currentQuestion`, questionId);
  await firebaseSet(`sessions/${sessionId}/questions/${questionId}/activatedAt`, Date.now());
}

/** Clean up test session from Firebase. */
export async function cleanupTestSession(sessionId) {
  await firebaseDelete(`sessions/${sessionId}`);
}

/**
 * Set up a student browser context with localStorage pre-configured.
 * Returns the page with student identity ready.
 */
export async function setupStudentPage(browser, baseURL, sessionId, nickname, opts = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const participantId = opts.participantId || `e2e_student_${Math.random().toString(36).slice(2, 10)}`;

  // Pre-set localStorage before navigating
  await page.goto(`${baseURL}/?s=${sessionId}`);
  await page.evaluate(({ pid, nick }) => {
    localStorage.setItem('dorandoran_participant_id', pid);
    localStorage.setItem('dorandoran_nickname', nick);
  }, { pid: participantId, nick: nickname });

  // Reload to pick up localStorage
  await page.reload();
  return { page, context, participantId };
}

/**
 * Set up admin page with sessionStorage pre-configured (bypass login).
 */
export async function setupAdminPage(browser, baseURL, role = 'admin', opts = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const adminUser = {
    uid: opts.uid || `e2e_admin_${role}`,
    username: opts.username || `test_${role}`,
    displayName: opts.displayName || `테스트 ${role === 'master' ? '마스터' : role === 'staff' ? '스태프' : '강사'}`,
    role,
  };

  await page.goto(`${baseURL}/admin`);
  await page.evaluate((user) => {
    sessionStorage.setItem('dorandoran_admin', JSON.stringify(user));
  }, adminUser);

  await page.reload();
  return { page, context, adminUser };
}

/** Wait for Firebase real-time sync (debounced). */
export async function waitForSync(page, ms = 2000) {
  await page.waitForTimeout(ms);
}
