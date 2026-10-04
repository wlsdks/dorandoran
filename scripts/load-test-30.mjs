if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') throw new Error('부하/정리 도구는 로컬 demo 에뮬레이터에서만 실행하세요.');
/**
 * Load test — 30명 실사용 시뮬레이션.
 *
 * 흐름:
 *   1. 강사가 운영 admin에서 세션 생성 + AI 심사 질문 활성화 (수동)
 *   2. node scripts/load-test-30.mjs <session-id> [n=30]
 *   3. 스크립트: 30 가짜 user를 동시 join → submission 동시 제출 → 결과 구독
 *   4. 강사가 심사 시작 → 결과 도착 시 카운터 출력
 *
 * 단일 Firebase connection 사용 — 30 connection 분산 효과는 미미하지만 DB 쓰기 부하·동시 구독은 동일.
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';

const FB_CONFIG = {
  apiKey: 'AIzaSyCsRs1BTT1NphOpbkoAwKn7rnrdQk16R2I',
  authDomain: 'jinan-6c884.firebaseapp.com',
  databaseURL: 'http://127.0.0.1:9000/?ns=demo-dorandoran',
  projectId: 'demo-dorandoran',
  storageBucket: 'jinan-6c884.firebasestorage.app',
  messagingSenderId: '956378670080',
  appId: '1:956378670080:web:2147d0766564dd00dde4e5',
};

const SID = process.argv[2];
const N = parseInt(process.argv[3] || '30', 10);
if (!SID) {
  console.error('Usage: node scripts/load-test-30.mjs <session-id> [n=30]');
  process.exit(1);
}

const app = initializeApp(FB_CONFIG);
const db = getDatabase(app);

// 30개 학생 — 각자 다른 participantId + 닉네임 + 다양한 품질 HTML
const HTMLS = [
  // 상급 (5)
  `<!DOCTYPE html><html><body style="font-family:system-ui;background:linear-gradient(135deg,#f0f9ff,#e0e7ff);padding:40px"><div style="max-width:400px;margin:auto;background:white;border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,.1)"><h2>프로 카드</h2><p style="color:#475569">고급 기능 + 우선 지원</p><button style="background:#0f172a;color:white;border:none;padding:12px 24px;border-radius:8px">시작</button></div></body></html>`,
  `<!DOCTYPE html><html><body style="background:#fafafa"><article style="max-width:480px;margin:60px auto;background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)"><div style="height:160px;background:linear-gradient(120deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center"><h1 style="color:white">카페 라떼</h1></div><div style="padding:24px"><h3>시그니처 라떼</h3><p style="color:#6b7280">에티오피아 원두</p><span style="font-size:24px;font-weight:700">₩5,500</span></div></article></body></html>`,
  `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#000"><div style="color:#0ff;font-family:monospace;border:2px solid #0ff;padding:32px;box-shadow:0 0 30px #0ff"><h1>CYBER CARD</h1><p>SYSTEM ONLINE</p></div></body></html>`,
  `<!DOCTYPE html><html><body style="background:#fef3c7;padding:40px"><div style="background:white;padding:24px;border-radius:24px;border:4px dashed #f59e0b;max-width:340px"><h2 style="text-align:center;color:#92400e">생일 카드</h2><p style="text-align:center;color:#78350f">생일 축하해요!</p></div></body></html>`,
  `<!DOCTYPE html><html><body style="background:#1e293b;padding:40px"><div style="background:#334155;padding:24px;border-radius:12px;color:#f1f5f9;max-width:320px"><div style="display:inline-block;background:#10b981;color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">NEW</div><h3 style="color:white">다크모드 카드</h3><p style="color:#cbd5e1">어두운 배경에서도 가독성 유지</p></div></body></html>`,
  // 중상 (10)
  `<!DOCTYPE html><html><body style="padding:40px;background:#f8fafc"><div style="max-width:360px;margin:auto;background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)"><h2>제품 카드</h2><p style="color:#64748b">간결한 디자인</p><button style="background:#0f172a;color:white;border:none;padding:10px 20px;border-radius:8px">자세히</button></div></body></html>`,
  `<!DOCTYPE html><html><body><div style="padding:20px;border:1px solid #e2e8f0;border-radius:12px;max-width:320px;margin:50px auto"><h3>상품명</h3><p>사용자 경험을 최우선</p><a href="#" style="color:#3b82f6">더 알아보기</a></div></body></html>`,
  `<!DOCTYPE html><html><body><div style="background:white;padding:24px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:300px;margin:30px"><h2>샘플 카드</h2><p>여기에 설명</p></div></body></html>`,
  `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#fef9ef;padding:60px"><blockquote style="max-width:400px;margin:auto;background:white;padding:32px;border-left:4px solid #c2410c;font-style:italic">"디자인은 작동하는 방식이다"<footer>— Steve Jobs</footer></blockquote></body></html>`,
  `<!DOCTYPE html><html><body><div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;max-width:400px;padding:16px;background:white;border-radius:12px"><div style="width:80px;height:80px;background:#10b981;border-radius:50%"></div><div><h3>김민지</h3><p>프론트엔드 개발자</p></div></div></body></html>`,
  `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;background:#ecfeff"><div style="max-width:380px;margin:auto;background:white;border-radius:16px;padding:28px"><div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:50%;background:#06b6d4"></div><div><p style="margin:0;font-weight:700">Aqua Plan</p><p style="color:#64748b;font-size:13px">베이직</p></div></div><p>월 9,900원으로 시작</p></div></body></html>`,
  `<!DOCTYPE html><html><body><div style="padding:24px;background:#fce7f3;border-radius:16px;max-width:300px;margin:30px"><h2 style="color:#9d174d">핑크 노트</h2><p style="color:#831843">오늘 기억하고 싶은 한 가지</p></div></body></html>`,
  `<!DOCTYPE html><html><body><div style="border:2px solid #16a34a;padding:20px;border-radius:8px;width:280px"><h3 style="color:#16a34a">ECO 인증</h3><p>친환경 소재로 제작</p></div></body></html>`,
  `<!DOCTYPE html><html><body><div style="background:#0f172a;color:#fcd34d;padding:30px;font-family:monospace;max-width:380px;margin:30px;border-radius:8px"><pre style="margin:0">$ npm run build\n✓ done in 2.3s</pre></div></body></html>`,
  `<!DOCTYPE html><html><body><div style="width:300px;height:200px;background:#ec4899;border-radius:16px;color:white;padding:20px"><h3 style="margin:0">SUMMER SALE</h3><p>최대 50% 할인</p><button style="background:white;color:#ec4899;border:none;padding:8px 16px;border-radius:999px">쇼핑</button></div></body></html>`,
  // 중 (10)
  `<!DOCTYPE html><html><body><div style="border:1px solid #ccc;padding:16px;width:300px"><h3>카드</h3><p>내용</p><button>버튼</button></div></body></html>`,
  `<!DOCTYPE html><html><body><div style="background:#f0f0f0;padding:20px;border-radius:5px"><h2>안녕하세요</h2><p>간단한 카드</p></div></body></html>`,
  `<!DOCTYPE html><html><body><div class="card"><h1>제목</h1><p>본문</p></div><style>.card{padding:20px;border:1px solid #999}</style></body></html>`,
  `<!DOCTYPE html><html><body><div style="padding:15px;background:#eee"><b>카드</b><br>설명</div></body></html>`,
  `<!DOCTYPE html><html><body><h2>나의 첫 카드</h2><p>HTML 연습 중</p><button>클릭</button></body></html>`,
  `<!DOCTYPE html><html><body><div style="margin:20px;padding:20px;background:#fff7ed">단순 카드 예시</div></body></html>`,
  `<html><body><div style="border:1px solid black;padding:10px">텍스트</div></body></html>`,
  `<!DOCTYPE html><html><body><div style="background:#dbeafe;padding:16px">파란 카드</div></body></html>`,
  `<!DOCTYPE html><html><body><table border=1 style="margin:30px"><tr><td>제품</td><td>가격</td></tr><tr><td>A</td><td>1000</td></tr></table></body></html>`,
  `<!DOCTYPE html><html><body><div style="background:#fefce8;padding:20px"><h3>노랑 카드</h3><p>설명</p></div></body></html>`,
  // 하 (5)
  `<!DOCTYPE html><html><body><div>카드<br>내용</div></body></html>`,
  `<div>카드 컴포넌트</div>`,
  `<!DOCTYPE html><html><body>내가 만든 카드</body></html>`,
  `<!DOCTYPE html><html></html>`,
  `<!DOCTYPE html><html><body><h1>TODO</h1></body></html>`,
];

const clients = [];
for (let i = 0; i < N; i++) {
  clients.push({
    idx: i + 1,
    pid: `load_${String(i + 1).padStart(2, '0')}_${Math.random().toString(36).slice(2, 8)}`,
    nickname: `학생${i + 1}`,
    code: HTMLS[i % HTMLS.length],
  });
}

function ts() { return new Date().toISOString().slice(11, 19); }
function log(...args) { console.log(`[${ts()}]`, ...args); }

(async () => {
  log(`🎬 Load test — session=${SID}, N=${N}`);

  // 1) 동시 join (참여자 등록)
  log('▶ Step 1: 30명 동시 join');
  const t0 = Date.now();
  const joinResults = await Promise.allSettled(clients.map((c) =>
    set(ref(db, `sessions/${SID}/participants/${c.pid}`), {
      nickname: c.nickname,
      joinedAt: Date.now(),
      online: true,
    })
  ));
  const joinOk = joinResults.filter(r => r.status === 'fulfilled').length;
  const joinFail = joinResults.filter(r => r.status === 'rejected');
  log(`✔ Join: ${joinOk}/${N} 성공, ${Date.now() - t0}ms`);
  if (joinFail.length) {
    log('❌ Join 실패:', joinFail.slice(0, 3).map(r => r.reason?.message).join(' / '));
  }

  // 2) 활성 질문 찾기 — session.currentQuestion이 활성 ID, 또는 activatedAt 있는 aiJudge 질문
  const sessionSnap = await get(ref(db, `sessions/${SID}`));
  const session = sessionSnap.val() || {};
  let aiQid = session.currentQuestion;
  const qs = session.questions || {};
  if (!aiQid || qs[aiQid]?.type !== 'aiJudge') {
    aiQid = Object.keys(qs).find((qid) => qs[qid].type === 'aiJudge' && qs[qid].activatedAt);
  }
  if (!aiQid) {
    log('❌ 활성 AI 심사 질문 없음. admin에서 AI 심사 질문 추가+활성화 후 다시 시도.');
    process.exit(1);
  }
  log(`▶ Active AI judge question: ${aiQid}`);

  // 3) 30명 동시 submission
  log('▶ Step 2: 30명 동시 제출');
  const t1 = Date.now();
  const subResults = await Promise.allSettled(clients.map((c, i) =>
    set(ref(db, `sessions/${SID}/questions/${aiQid}/submissions/${c.pid}`), {
      name: c.nickname,
      title: `카드 ${c.idx}`,
      description: `${c.idx}번째 시도`,
      imageUrl: null,
      code: c.code,
      submittedAt: Date.now() + i,
    })
  ));
  const subOk = subResults.filter(r => r.status === 'fulfilled').length;
  const subFail = subResults.filter(r => r.status === 'rejected');
  log(`✔ Submit: ${subOk}/${N} 성공, ${Date.now() - t1}ms`);
  if (subFail.length) {
    log('❌ Submit 실패:', subFail.slice(0, 3).map(r => r.reason?.message).join(' / '));
  }

  // 4) 30개 onValue 구독 — 결과 도착 모니터
  log('▶ Step 3: 결과 구독 + 강사 심사 트리거 대기');
  log('  강사가 admin 화면에서 "30건 심사 시작" 클릭하면 진행됩니다.');
  let judgedCount = 0;
  const judgedAt = {};
  const watchers = clients.map((c) =>
    onValue(ref(db, `sessions/${SID}/questions/${aiQid}/aiResults/${c.pid}`), (snap) => {
      if (snap.exists() && !judgedAt[c.pid]) {
        judgedAt[c.pid] = Date.now();
        judgedCount++;
        if (judgedCount % 5 === 0 || judgedCount === N) {
          log(`  ◆ 심사 완료: ${judgedCount}/${N} (학생${c.idx}: avg ${snap.val().summary?.avgScore ?? '-'})`);
        }
      }
    })
  );

  // 5) Top3 + 상태 구독
  let judgeStartedAt = null;
  let judgeCompletedAt = null;
  const stateUnsub = onValue(ref(db, `sessions/${SID}/questions/${aiQid}/aiJudgeState`), (snap) => {
    const s = snap.val();
    if (s?.status === 'judging' && !judgeStartedAt) {
      judgeStartedAt = Date.now();
      log(`  🟡 심사 시작 (강사 트리거됨)`);
    }
    if (s?.status === 'done' && !judgeCompletedAt) {
      judgeCompletedAt = Date.now();
      const elapsed = ((judgeCompletedAt - judgeStartedAt) / 1000).toFixed(1);
      log(`  🟢 심사 완료 — 총 ${elapsed}초`);
    }
  });
  const top3Unsub = onValue(ref(db, `sessions/${SID}/questions/${aiQid}/aiTop3`), (snap) => {
    const t = snap.val();
    if (t) {
      log(`  🏆 TOP3 — 1등: ${t.first?.name}/${t.first?.score} · 2등: ${t.second?.name}/${t.second?.score} · 3등: ${t.third?.name}/${t.third?.score}`);
    }
  });

  // 6) 5분 또는 모든 결과 도착 시 정리
  const TIMEOUT_MS = 5 * 60 * 1000;
  const startWait = Date.now();
  while (judgedCount < N && Date.now() - startWait < TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, 2000));
  }

  if (judgedCount < N) {
    log(`⏱  Timeout — ${judgedCount}/${N}만 도착`);
  } else {
    log(`✨ 전원 결과 수신 — ${judgedCount}/${N}`);
  }

  // 7) Cleanup subscriptions
  watchers.forEach(unsub => unsub());
  stateUnsub();
  top3Unsub();

  log('▶ Step 4: 학생 participants 정리 (online=false)');
  await Promise.allSettled(clients.map((c) =>
    remove(ref(db, `sessions/${SID}/participants/${c.pid}`))
  ));
  log('✔ Cleanup 완료');

  process.exit(0);
})();
