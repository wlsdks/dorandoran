import { get, ref, push, runTransaction, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

/** 포인터 선점 결과로 승자를 판정한다. 재시도 콜백의 외부 플래그와 폴링을 사용하지 않는다. */
export async function ensureDMThread(sessionId, { studentId, studentName, staffId, staffName }) {
  const base = `sessions/${sessionId}`;
  const pointer = ref(db, `${base}/dmByStudent/${studentId}`);
  const observed = (await get(pointer)).val();
  if (observed) {
    const current = (await get(ref(db, `${base}/dm/${observed}`))).val();
    if (current && current.studentId === studentId && current.status !== 'resolved') return { dmId: observed, existed: true };
    if (!current) {
      // 승자가 포인터를 만든 뒤 중단됐으면 같은 ID의 누락 노드만 복구한다.
      await createMissing(observed);
      return { dmId: observed, existed: false };
    }
  }
  const candidate = push(ref(db, `${base}/dm`)).key;
  const claim = await runTransaction(pointer, (current) => current === observed ? candidate : undefined, { applyLocally: false });
  const dmId = claim.snapshot.val();
  if (!dmId) throw new Error('상담 연결을 다시 시도해주세요.');
  await createMissing(dmId);
  return { dmId, existed: dmId !== candidate };

  async function createMissing(dmId) {
    await runTransaction(ref(db, `${base}/dm/${dmId}`), (current) => current ? undefined : {
      studentId, studentName: studentName || '학생', staffId: staffId || null, staffName: staffName || null,
      status: staffId ? 'active' : 'waiting', createdAt: serverTimestamp(),
    }, { applyLocally: false });
  }
}
