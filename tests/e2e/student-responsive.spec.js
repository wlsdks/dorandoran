import { test } from '@playwright/test';
import {
  testSessionId, createTestSession, cleanupTestSession,
  activateQuestion, waitForSync, firebaseSet,
} from './helpers';

/**
 * 학생 화면 반응형 검수 — 모바일(한 손)·좁은 안드로이드·노트북에서
 * 입장화면 + 투표 유형별 + 대기 상태가 깨짐/잘림/thumb-zone 이탈 없이 렌더되는지 캡처.
 * 동작 테스트 아님(스크린샷 산출) — 항상 통과, 캡처를 사람이 검수.
 */

const DEVICES = [
  { w: 390, h: 844, tag: 'mobile' },   // iPhone 14급
  { w: 360, h: 740, tag: 'android' },  // 좁은 안드로이드(최소폭)
  { w: 1366, h: 768, tag: 'laptop' },  // 일반 노트북
];

const OUT = 'test-results/responsive-student';
const PID = 'e2e_resp_student';

async function shoot(page, res, label) {
  await page.getByText('불러오는 중').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await waitForSync(page, 1800);
  await page.screenshot({ path: `${OUT}/${res.tag}-${label}.png`, fullPage: false });
}

for (const res of DEVICES) {
  test(`학생 반응형 캡처 — ${res.tag} (${res.w}×${res.h})`, async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const sid = testSessionId();
    await createTestSession(sid);
    await page.setViewportSize({ width: res.w, height: res.h });

    // 1) 입장 화면 (미입장 상태)
    await page.goto(`${baseURL}/?s=${sid}`);
    await shoot(page, res, '01-join');

    // 입장 완료 마킹 → VotePage 진입
    await page.evaluate(({ sid, pid }) => {
      localStorage.setItem('dorandoran_participant_id', pid);
      localStorage.setItem('dorandoran_nickname', '김학생');
      localStorage.setItem('dorandoran_joined_sessions', JSON.stringify({ [sid]: { participantId: pid, nickname: '김학생' } }));
    }, { sid, pid: PID });

    // 2) 대기 상태 (활성 질문 없음)
    await page.reload();
    await shoot(page, res, '02-waiting');

    // 3) 객관식 투표
    await activateQuestion(sid, 'q1');
    await page.reload();
    await shoot(page, res, '03-choice');

    // 4) OX 투표
    await activateQuestion(sid, 'q2');
    await page.reload();
    await shoot(page, res, '04-ox');

    // 5) 퀴즈 투표
    await firebaseSet(`sessions/${sid}/currentMode`, 'quiz');
    await activateQuestion(sid, 'q4');
    await page.reload();
    await shoot(page, res, '05-quiz');

    // 6) 워드클라우드 입력
    await firebaseSet(`sessions/${sid}/currentMode`, 'poll');
    await activateQuestion(sid, 'q3');
    await page.reload();
    await shoot(page, res, '06-wordcloud');

    await cleanupTestSession(sid);
  });
}
