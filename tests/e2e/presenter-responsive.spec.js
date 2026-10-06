import { test } from '@playwright/test';
import {
  testSessionId, createTestSession, cleanupTestSession,
  activateQuestion, waitForSync, firebaseSet,
} from './helpers';

/**
 * 전자칠판(/live) 반응형 검수 — 프로젝터 해상도 1920×1080 / 2560×1440에서
 * 핵심 모드가 깨짐/여백낭비/잘림 없이 렌더되는지 스크린샷으로 캡처.
 * 동작 테스트 아님(스크린샷 산출이 목적) — 항상 통과, 캡처 파일을 사람이 검수.
 */

const RES = [
  { w: 1920, h: 1080, tag: '1080p' },
  { w: 2560, h: 1440, tag: '1440p' },
];

const OUT = 'test-results/responsive';

async function seedVotes(sid, qid, values) {
  const votes = {};
  values.forEach((v, i) => { votes[`p${i}`] = { value: v }; });
  await firebaseSet(`sessions/${sid}/questions/${qid}/votes`, votes);
}

async function shoot(page, sid, res, label) {
  await page.goto(`/live?s=${sid}`);
  // 레이지 로드(SuspenseFallback "불러오는 중") 사라질 때까지 대기 → 실제 콘텐츠 렌더 보장
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 2800);
  await page.screenshot({ path: `${OUT}/${res.tag}-${label}.png` });
}

for (const res of RES) {
  test(`전자칠판 반응형 캡처 — ${res.tag} (${res.w}×${res.h})`, async ({ page }) => {
    test.setTimeout(120_000);
    const sid = testSessionId();
    await createTestSession(sid);
    await page.setViewportSize({ width: res.w, height: res.h });

    // 투표 시드 (차트가 실제처럼 보이게)
    await seedVotes(sid, 'q1', ['JavaScript','JavaScript','JavaScript','Python','Python','TypeScript','Go','Go','Go','Go']);
    await seedVotes(sid, 'q2', ['O','O','O','O','O','O','X','X','X']);
    await seedVotes(sid, 'q3', ['실습','실습','실습','협업','협업','발표','피드백','실습','협업','코딩','재미','실습']);
    await seedVotes(sid, 'q4', ['서울','서울','서울','서울','서울','부산','인천','대구']);
    // 참여자/점수 시드 (복권·랭킹용)
    const parts = {}; const scores = {};
    for (let i = 0; i < 24; i++) {
      parts[`pp${i}`] = { nickname: `학생${i + 1}`, online: true };
      scores[`pp${i}`] = { nickname: `학생${i + 1}`, total: Math.round(500 - i * 17) };
    }
    await firebaseSet(`sessions/${sid}/participants`, parts);
    await firebaseSet(`sessions/${sid}/scores`, scores);

    // 1) 빈 상태 (currentQuestion 없음, poll)
    await firebaseSet(`sessions/${sid}/currentMode`, 'poll');
    await shoot(page, sid, res, '01-empty');

    // 2) 객관식 막대차트
    await firebaseSet(`sessions/${sid}/currentMode`, 'poll');
    await activateQuestion(sid, 'q1');
    await shoot(page, sid, res, '02-choice');

    // 3) OX 배틀
    await activateQuestion(sid, 'q2');
    await shoot(page, sid, res, '03-ox');

    // 4) 워드클라우드
    await activateQuestion(sid, 'q3');
    await shoot(page, sid, res, '04-wordcloud');

    // 5) 퀴즈
    await firebaseSet(`sessions/${sid}/currentMode`, 'quiz');
    await activateQuestion(sid, 'q4');
    await shoot(page, sid, res, '05-quiz');

    // 6) 랭킹
    await firebaseSet(`sessions/${sid}/currentMode`, 'leaderboard');
    await shoot(page, sid, res, '06-leaderboard');

    // 7) 복권(추첨)
    await firebaseSet(`sessions/${sid}/currentMode`, 'lottery');
    await shoot(page, sid, res, '07-lottery');

    // 8) 쉬는시간 타이머
    await firebaseSet(`sessions/${sid}/currentMode`, 'breakTime');
    await shoot(page, sid, res, '08-breaktime');

    await cleanupTestSession(sid);
  });
}
