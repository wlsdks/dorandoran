import { describe, expect, it } from 'vitest';
import { publicQuestions } from './public-questions';
import { getQuizReward } from './quiz';
import { participationLeader } from './participation';
import fields from '../../functions/public-question-fields.json';
import rules from '../../database.rules.json';

describe('공개 데이터와 계산의 신뢰 경계', () => {
  it('공개 문항 스키마와 RTDB 허용 필드가 어긋나 동기화를 막지 않는다', () => {
    const validators = rules.rules.sessions.$sid.publicQuestions.$qId;
    expect(fields.filter(field => !Object.hasOwn(validators, field))).toEqual([]);
    expect(validators.$other['.validate']).toBe(false);
    expect(fields).not.toContain('votes');
    expect(fields).not.toContain('submissions');
  });
  it('미공개 정답, 원본 투표와 제출물을 공개 뷰에 전달하지 않는다', () => {
    const input = { q: { type: 'quiz', title: '제목', correctAnswer: 'B', acceptableAnswers: ['b'], votes: { student: { value: 'A' } }, submissions: { student: { code: 'private' } } } };
    expect(publicQuestions(input)).toEqual({ q: { type: 'quiz', title: '제목' } });
    expect(input.q.submissions.student.code).toBe('private');
    input.q.revealedAt = 1; expect(publicQuestions(input).q.correctAnswer).toBe('B');
  });
  it('정답 해설(글·이미지)은 정답 공개 전에는 공개 뷰에 싣지 않고, 공개를 취소하면 다시 지운다', async () => {
    const { publicQuestionUpdates } = await import('./public-questions');
    const q = { type: 'ox', title: '지구는 둥글다', correctAnswer: 'O', answerImageUrl: 'https://img.example/earth.jpg', answerExplanation: '위성 사진으로 확인할 수 있어요' };
    const hidden = publicQuestions({ q });
    expect(hidden.q).not.toHaveProperty('answerImageUrl');
    expect(hidden.q).not.toHaveProperty('answerExplanation');
    const shown = publicQuestions({ q: { ...q, revealedAt: 1 } });
    expect(shown.q.answerImageUrl).toBe('https://img.example/earth.jpg');
    expect(shown.q.answerExplanation).toBe('위성 사진으로 확인할 수 있어요');
    expect(publicQuestionUpdates(shown, hidden)).toMatchObject({ 'q/answerImageUrl': null, 'q/answerExplanation': null, 'q/correctAnswer': null });
  });
  it('300명 응답과 큰 제출물이 있어도 공개 문항 데이터는 커지지 않는다', () => {
    const q = { title: '질문', type: 'quiz', options: ['A', 'B'], correctAnswer: 'B', votes: {}, submissions: {} };
    for (let index = 0; index < 300; index++) { q.votes[index] = { value: 'A', nickname: `참여${index}` }; q.submissions[index] = { code: 'x'.repeat(1000) }; }
    expect(JSON.stringify(publicQuestions({ q })).length).toBeLessThan(100);
  });
  it('허용되지 않은 배율과 없는 정답/타임스탬프로 높은 점수를 얻지 못한다', () => {
    const q = { type: 'quiz', correctAnswer: 'A', betting: true, activatedAt: 1000 };
    expect(getQuizReward(q, { value: 'A', bet: 999999, timestamp: 1000 }).bet).toBe(1);
    expect(getQuizReward(q, { value: 'A' }).points).toBe(100);
    expect(getQuizReward(q, { value: 'A', timestamp: -1000 }).points).toBe(100);
    expect(getQuizReward({}, {}).isCorrect).toBe(false);
  });
  it('참여 리더는 실제 접속·3문항 응답을 근거로 하고 슬라이드를 세지 않는다', () => {
    const participants = { a: { nickname: '도란', connections: { one: true } }, old: { nickname: '과거', online: true } };
    const questions = Object.fromEntries([1,2,3].map(index => [index, { type: 'choice', votes: { a: { value: 'A', timestamp: index }, old: { value: 'B', timestamp: index } } }]));
    expect(participationLeader(questions, participants)).toMatchObject({ id: 'a', count: 3, milestone: 3 });
    questions[3].type = 'imageSlide'; expect(participationLeader(questions, participants)).toBeNull();
  });
});

it('슬라이드 번호 변경은 이미지 목록 전체 대신 한 필드만 전달한다', async () => {
  const { publicQuestionUpdates } = await import('./public-questions');
  const before = { slide: { title: '강의', currentSlide: 0, slideImages: ['a', 'b'] } };
  const after = { slide: { ...before.slide, currentSlide: 1 } };
  expect(publicQuestionUpdates(before, after)).toEqual({ 'slide/currentSlide': 1 });
});
