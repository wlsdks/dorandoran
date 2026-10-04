import { afterEach, expect, it } from 'vitest';
import { clearVerifiedAIConfiguration, hasVerifiedAIConfiguration, setVerifiedAIConfiguration } from './ai-config';

afterEach(() => clearVerifiedAIConfiguration());
it('연결 상태가 확인되지 않으면 사용 가능한 것으로 표시하지 않는다', () => {
  expect(hasVerifiedAIConfiguration('teacher')).toBe(false);
});
it('한 강사의 연결 확인을 다른 계정의 준비 상태로 재사용하지 않는다', () => {
  setVerifiedAIConfiguration('teacher', true);
  expect(hasVerifiedAIConfiguration('teacher')).toBe(true);
  expect(hasVerifiedAIConfiguration('another')).toBe(false);
});
it('수업 전환이나 연결 해제 이후에는 이전 준비 상태가 남지 않는다', () => {
  setVerifiedAIConfiguration('teacher', true); clearVerifiedAIConfiguration('teacher');
  expect(hasVerifiedAIConfiguration('teacher')).toBe(false);
});
it('false와 임의의 문자열 값을 연결 성공으로 취급하지 않는다', () => {
  setVerifiedAIConfiguration('teacher', 'true'); expect(hasVerifiedAIConfiguration('teacher')).toBe(false);
  setVerifiedAIConfiguration('teacher', false); expect(hasVerifiedAIConfiguration('teacher')).toBe(false);
});
