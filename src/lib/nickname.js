/**
 * 닉네임 중복 판정용 키 — 대소문자와 공백을 무시한다("민 준", "민준", "MinJun"/"minjun"은 같은 이름).
 * Firebase 키에 쓸 수 없는 문자(. # $ [ ] /)는 밑줄로 바꾼다.
 */
export function nicknameKey(name) {
  return String(name ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.#$[\]/]/g, '_');
}
