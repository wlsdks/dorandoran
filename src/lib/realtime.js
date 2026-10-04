/** 공유되는 빈 값은 렌더마다 새 배열/객체를 만들지 않는다. */
export const EMPTY_RECORD = Object.freeze({});
export const EMPTY_LIST = Object.freeze([]);

export function adaptiveVoteThrottle(count) {
  return count <= 10 ? 0 : count <= 50 ? 50 : 150;
}
