import { test } from '@playwright/test';
import {
  testSessionId, cleanupTestSession, firebaseSet, waitForSync,
} from './helpers';

/**
 * 학생 모바일(390×844) — 전 voter 유형 + 하단바 기능 전수 캡처.
 * 참가자는 전부 모바일 → 모든 투표 유형 UI/사용성 육안 검수.
 */

const OUT = 'test-results/responsive-voters';
const PID = 'e2e_voter_student';
const W = 390, H = 844;

// 전 voter 유형 질문 시드
const QUESTIONS = {
  c_choice: { title: '좋아하는 언어는?', type: 'choice', options: ['JavaScript', 'Python', 'TypeScript', 'Go'], order: 0 },
  c_ox: { title: '이해가 되셨나요?', type: 'ox', options: ['O', 'X'], order: 1 },
  c_quiz: { title: '한국의 수도는?', type: 'quiz', options: ['서울', '부산', '인천', '대구'], correctAnswer: '서울', order: 2 },
  c_wordcloud: { title: '오늘 수업 한 단어로?', type: 'wordcloud', options: [], order: 3 },
  c_subjective: { title: '가장 인상 깊었던 점을 적어주세요', type: 'subjective', order: 4 },
  c_scale: { title: '수업 만족도는?', type: 'scale', order: 5 },
  c_debate: { title: '재택근무 찬반?', type: 'debate', options: ['찬성', '반대'], order: 6 },
  c_ranking: { title: '우선순위 순서대로', type: 'ranking', options: ['속도', '품질', '비용', '디자인'], order: 7 },
  c_fill: { title: 'React는 ___ 라이브러리다', type: 'fillinblank', correctAnswer: 'UI', order: 8 },
  c_check: { title: '실습 완료하면 체크', type: 'check', order: 9 },
  c_mystery: { title: '미스터리 박스 정답은?', type: 'mysteryBox', order: 10 },
  c_hint: { title: '힌트 퀴즈', type: 'hintQuiz', hints: ['포유류입니다', '줄무늬가 있어요'], revealedHints: 1, order: 11 },
};

async function activate(sid, qid) {
  await firebaseSet(`sessions/${sid}/currentMode`, QUESTIONS[qid].type === 'quiz' ? 'quiz' : 'poll');
  await firebaseSet(`sessions/${sid}/currentQuestion`, qid);
  await firebaseSet(`sessions/${sid}/questions/${qid}/activatedAt`, Date.now());
}

async function shoot(page, label) {
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 1500);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
}

test('학생 모바일 — 전 voter 유형 전수 캡처', async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const sid = testSessionId();
  await firebaseSet(`sessions/${sid}`, {
    status: 'active', currentMode: 'poll', currentQuestion: null,
    courseName: '모바일 UX 점검', roundNumber: 1, createdAt: Date.now(),
    questions: QUESTIONS,
  });
  await page.setViewportSize({ width: W, height: H });

  // 입장 마킹
  await page.goto(`${baseURL}/?s=${sid}`);
  await page.evaluate(({ sid, pid }) => {
    localStorage.setItem('dorandoran_participant_id', pid);
    localStorage.setItem('dorandoran_nickname', '김참가');
    localStorage.setItem('dorandoran_joined_sessions', JSON.stringify({ [sid]: { participantId: pid, nickname: '김참가' } }));
  }, { sid, pid: PID });

  const order = ['c_choice','c_ox','c_quiz','c_wordcloud','c_subjective','c_scale','c_debate','c_ranking','c_fill','c_check','c_mystery','c_hint'];
  for (let i = 0; i < order.length; i++) {
    await activate(sid, order[i]);
    await page.reload();
    await shoot(page, `${String(i + 1).padStart(2, '0')}-${order[i].replace('c_', '')}`);
  }

  await cleanupTestSession(sid);
});
