import { describe, expect, it } from 'vitest';
import { createReactionBucket, takeReaction, refundReaction } from './reaction-rate';

function run(times) {
  let bucket = createReactionBucket();
  return times.map(t => { const r = takeReaction(bucket, t); bucket = r.bucket; return r; });
}

describe('반응 속도 조절', () => {
  it('연속 3번은 바로 보내고 4번째는 1초 이내 대기를 알려준다', () => {
    const r = run([0, 100, 200, 300]);
    expect(r.slice(0, 3).every(x => x.allowed)).toBe(true);
    expect(r[3].allowed).toBe(false);
    expect(r[3].waitMs).toBeGreaterThan(0);
    expect(r[3].waitMs).toBeLessThanOrEqual(1000);
  });
  it('1초가 지나면 한 번 더 보낼 수 있다', () => {
    const r = run([0, 10, 20, 1005, 1010]);
    expect(r.map(x => x.allowed)).toEqual([true, true, true, true, false]);
  });
  it('계속 눌러도 장기 평균은 초당 1번을 넘지 않는다', () => {
    const times = Array.from({ length: 200 }, (_, i) => i * 50); // 10초 동안 초당 20번
    const sent = run(times).filter(x => x.allowed).length;
    expect(sent).toBeLessThanOrEqual(3 + 10);
    expect(sent).toBeGreaterThanOrEqual(3 + 9);
  });
  it('쉬면 다시 3번까지 모인다', () => {
    const r = run([0, 1, 2, 5000, 5001, 5002, 5003]);
    expect(r.map(x => x.allowed)).toEqual([true, true, true, true, true, true, false]);
  });
  it('실패한 전송은 토큰을 돌려준다', () => {
    let b = createReactionBucket();
    for (let i = 0; i < 3; i++) b = takeReaction(b, 0).bucket;
    expect(takeReaction(refundReaction(b), 0).allowed).toBe(true);
  });
});
