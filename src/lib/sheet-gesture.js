/**
 * 바텀 시트 손가락 제스처 판정 — 순수 함수.
 * 놓는 위치가 아니라 "손가락이 향하던 곳"(관성 투영)으로 닫힘을 결정한다.
 * 스크롤 감속과 같은 지수 감쇠식(iOS UIScrollView 방식)을 쓴다.
 */
const DECELERATION = 0.998;

/** 초속 velocity(px/s)로 놓았을 때 더 미끄러질 거리(px). */
export function projectMomentum(velocity, decelerationRate = DECELERATION) {
  if (!Number.isFinite(velocity)) return 0;
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * 시트를 닫을지 판정한다.
 * - 위로 던지면 항상 유지(음수 속도).
 * - 빠른 아래 플릭(flickVelocity 이상)은 거리와 무관하게 닫힌다.
 * - 그 외에는 현재 offset + 투영 거리가 시트 높이의 threshold 비율을 넘으면 닫힌다.
 */
export function shouldDismissSheet({ offset = 0, velocity = 0, height = 0, threshold = 0.5, flickVelocity = 600 } = {}) {
  if (!(height > 0) || offset <= 0) return false;
  if (velocity < 0 && Math.abs(velocity) >= 200) return false;
  if (velocity >= flickVelocity) return true;
  const projected = offset + projectMomentum(Math.max(0, velocity));
  return projected >= height * threshold;
}

/** 당긴 거리에 따라 배경 어둡기를 1→floor로 선형 감소시킨다(드래그 중 즉시 피드백용). */
export function backdropOpacityForDrag(offset, height, floor = 0.25) {
  if (!(height > 0) || !(offset > 0)) return 1;
  return Math.max(floor, 1 - (offset / height) * (1 - floor));
}
