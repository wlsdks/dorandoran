import { test, expect } from '@playwright/test';
import {
  testSessionId,
  createTestSession,
  cleanupTestSession,
  setupStudentPage,
  waitForSync,
  firebaseSet,
} from './helpers';

/**
 * 학생 DM(도움 요청) e2e — useStudentDM 본인-스레드 스코프 구독 리팩터 안전망.
 * 검증: (1) 학생이 본인 DM 스레드만 받고 (사생활), (2) 스태프 답변이 학생에게 도달.
 */
let sessionId;

test.describe('학생 DM — 본인 스레드 스코프', () => {
  test.beforeEach(async () => { sessionId = testSessionId(); await createTestSession(sessionId); });
  test.afterEach(async () => { await cleanupTestSession(sessionId); });

  test('포인터(dmByStudent)가 가리키는 본인 스레드의 메시지를 수신, 타 학생 DM은 미수신', async ({ browser, baseURL }) => {
    const pid = 'e2e_dm_student';
    // 내 DM 스레드 + 포인터 시드
    await firebaseSet(`sessions/${sessionId}/dm/mydm`, {
      studentId: pid, studentName: '나학생', status: 'waiting', createdAt: Date.now(),
      messages: { m1: { text: '도와주세요', sender: '나학생', senderType: 'student', timestamp: Date.now() } },
    });
    await firebaseSet(`sessions/${sessionId}/dmByStudent/${pid}`, 'mydm');
    // 타 학생의 DM (내 화면에 절대 안 떠야 함 — 사생활)
    await firebaseSet(`sessions/${sessionId}/dm/otherdm`, {
      studentId: 'someone_else', studentName: '남학생', status: 'waiting', createdAt: Date.now(),
      messages: { m1: { text: '비밀상담내용', sender: '남학생', senderType: 'student', timestamp: Date.now() } },
    });

    const { page, context } = await setupStudentPage(browser, baseURL, sessionId, '나학생', { participantId: pid });
    // 입장 완료 상태로 마킹 (StudentBottomBar/토스트 마운트되도록) 후 재로드.
    // 포맷: { [sessionId]: { participantId } } — hasJoinedSession이 participantId 일치를 확인.
    await page.evaluate(({ sid, pid }) => {
      localStorage.setItem('dorandoran_joined_sessions', JSON.stringify({ [sid]: { participantId: pid, nickname: '나학생' } }));
    }, { sid: sessionId, pid });
    await page.reload();
    await waitForSync(page, 3000);

    // 스태프가 답변을 보냄 → 스코프 구독(포인터→본인 스레드)이 동작하면 학생에게 도달
    await firebaseSet(`sessions/${sessionId}/dm/mydm/messages/m2`, {
      text: '네 도와드릴게요', sender: '스태프', senderType: 'staff', timestamp: Date.now(),
    });

    // 긍정: 스태프 답변 토스트가 학생 화면에 떠야 함 (본인 스레드 구독 정상 동작 증명)
    await expect(page.getByText(/답변을 시작했어요|새 답변/)).toBeVisible({ timeout: 8000 });

    // 사생활: 타 학생 DM 본문은 내 페이지에 절대 없어야 함 (전체 /dm 구독 제거)
    await expect(page.getByText('비밀상담내용')).toHaveCount(0);

    await context.close();
  });
});
