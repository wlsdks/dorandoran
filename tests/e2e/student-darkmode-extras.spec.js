import { test } from '@playwright/test';
import {
  testSessionId, cleanupTestSession, firebaseSet, waitForSync,
} from './helpers';

/**
 * 학생 모바일 — 다크모드 전수 + 퀴즈 정답공개/결과 + 리더보드 + 가로모드 캡처.
 */

const OUT = 'test-results/responsive-extra';
const PID = 'e2e_extra_student';

const QUESTIONS = {
  c_choice: { title: '좋아하는 언어는?', type: 'choice', options: ['JavaScript', 'Python', 'TypeScript', 'Go'], order: 0 },
  c_ox: { title: '이해가 되셨나요?', type: 'ox', options: ['O', 'X'], order: 1 },
  c_quiz: { title: '한국의 수도는?', type: 'quiz', options: ['서울', '부산', '인천', '대구'], correctAnswer: '서울', order: 2 },
  c_quiz_w: { title: '가장 큰 행성은?', type: 'quiz', options: ['목성', '토성', '지구', '화성'], correctAnswer: '목성', order: 7 },
  c_wordcloud: { title: '오늘 수업 한 단어로?', type: 'wordcloud', options: [], order: 3 },
  c_subjective: { title: '인상 깊었던 점을 적어주세요', type: 'subjective', order: 4 },
  c_scale: { title: '수업 만족도는?', type: 'scale', order: 5 },
};

async function seedSession(sid) {
  await firebaseSet(`sessions/${sid}`, {
    status: 'active', currentMode: 'poll', currentQuestion: null,
    courseName: '다크모드 점검', roundNumber: 1, createdAt: Date.now(),
    questions: QUESTIONS,
  });
}
async function join(page, baseURL, sid, theme) {
  await page.goto(`${baseURL}/?s=${sid}`);
  await page.evaluate(({ sid, pid, theme }) => {
    localStorage.setItem('dorandoran_participant_id', pid);
    localStorage.setItem('dorandoran_nickname', '김참가');
    localStorage.setItem('dorandoran_joined_sessions', JSON.stringify({ [sid]: { participantId: pid, nickname: '김참가' } }));
    if (theme) localStorage.setItem('dorandoran_theme', theme);
  }, { sid, pid: PID, theme });
}
async function activate(sid, qid, mode = 'poll') {
  await firebaseSet(`sessions/${sid}/currentMode`, mode);
  await firebaseSet(`sessions/${sid}/currentQuestion`, qid);
  await firebaseSet(`sessions/${sid}/questions/${qid}/activatedAt`, Date.now());
}
async function shoot(page, label) {
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 1400);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
}

// 1) 다크모드 전수 (390×844)
test('다크모드 — 학생 전 화면', async ({ page, baseURL }) => {
  test.setTimeout(150_000);
  const sid = testSessionId();
  await seedSession(sid);
  await page.setViewportSize({ width: 390, height: 844 });
  await join(page, baseURL, sid, 'dark');
  await page.reload();
  await shoot(page, 'dark-01-waiting');
  const order = ['c_choice', 'c_ox', 'c_quiz', 'c_wordcloud', 'c_subjective', 'c_scale'];
  for (let i = 0; i < order.length; i++) {
    await activate(sid, order[i], order[i] === 'c_quiz' ? 'quiz' : 'poll');
    await page.reload();
    await shoot(page, `dark-${String(i + 2).padStart(2, '0')}-${order[i].replace('c_', '')}`);
  }
  await cleanupTestSession(sid);
});

// 2) 퀴즈 정답공개/결과 + 리더보드 (라이트 + 다크)
for (const theme of ['light', 'dark']) {
  test(`퀴즈 결과 + 리더보드 — ${theme}`, async ({ page, baseURL }) => {
    test.setTimeout(150_000);
    const sid = testSessionId();
    await seedSession(sid);
    // 점수 시드 (리더보드 + 결과 점수)
    const scores = {};
    for (let i = 0; i < 8; i++) scores[`s${i}`] = { nickname: `학생${i + 1}`, total: 300 - i * 25 };
    scores[PID] = { nickname: '김참가', total: 175 };
    await firebaseSet(`sessions/${sid}/scores`, scores);
    await page.setViewportSize({ width: 390, height: 844 });
    await join(page, baseURL, sid, theme === 'dark' ? 'dark' : 'light');

    // 퀴즈 활성 + 내 정답 투표(정답) + 정답공개
    await activate(sid, 'c_quiz', 'quiz');
    await firebaseSet(`sessions/${sid}/questions/c_quiz/votes/${PID}`, { value: '서울' });
    await page.reload();
    await shoot(page, `${theme}-quiz-voted`); // 정답 공개 대기
    await firebaseSet(`sessions/${sid}/questions/c_quiz/revealedAt`, Date.now());
    await page.reload();
    await shoot(page, `${theme}-quiz-result-correct`);
    // 오답 케이스 — 투표는 write-once라 별도 문항(c_quiz_w)에서 오답 투표
    await activate(sid, 'c_quiz_w', 'quiz');
    await firebaseSet(`sessions/${sid}/questions/c_quiz_w/votes/${PID}`, { value: '토성' });
    await firebaseSet(`sessions/${sid}/questions/c_quiz_w/revealedAt`, Date.now());
    await page.reload();
    await shoot(page, `${theme}-quiz-result-wrong`);

    // 리더보드 학생 화면
    await firebaseSet(`sessions/${sid}/currentMode`, 'leaderboard');
    await page.reload();
    await shoot(page, `${theme}-leaderboard`);
    await cleanupTestSession(sid);
  });
}

// 3) 가로모드 (844×390) — 주요 화면
test('가로모드 — 학생 주요 화면', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const sid = testSessionId();
  await seedSession(sid);
  await page.setViewportSize({ width: 844, height: 390 });
  await join(page, baseURL, sid, 'light');
  await page.reload();
  await shoot(page, 'landscape-01-waiting');
  await activate(sid, 'c_choice');
  await page.reload();
  await shoot(page, 'landscape-02-choice');
  await activate(sid, 'c_quiz', 'quiz');
  await page.reload();
  await shoot(page, 'landscape-03-quiz');
  await cleanupTestSession(sid);
});
