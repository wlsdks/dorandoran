import { describe, expect, it } from 'vitest';
import { nicknameKey } from './nickname';

describe('닉네임 중복 키', () => {
  it('대소문자와 공백을 무시한다', () => {
    expect(nicknameKey(' 민 준 ')).toBe(nicknameKey('민준'));
    expect(nicknameKey('MinJun')).toBe(nicknameKey('minjun'));
  });
  it('Firebase 키에 쓸 수 없는 문자를 바꾼다', () => {
    expect(nicknameKey('a.b#c$d[e]f/g')).toBe('a_b_c_d_e_f_g');
  });
  it('다른 이름은 다른 키가 된다', () => {
    expect(nicknameKey('민준')).not.toBe(nicknameKey('지훈'));
  });
});
