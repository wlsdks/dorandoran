/** 접속은 탭별 서버 연결로 판단한다. 이전 online 불리언과 역사 기록은 변경하지 않는다. */
export function participantIsOnline(participant) {
  return Object.values(participant?.connections || {}).some(value => value === true);
}
