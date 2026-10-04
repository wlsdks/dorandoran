import { describe, it, expect } from 'vitest';
import { buildQuestionData, QUESTION_TYPE_FIELDS } from './question';

// 특성화 테스트 — handleSubmit/updateQuestion에서 추출한 buildQuestionData가
// 기존 인라인 로직과 동일한 questionData를 생성하는지 고정.
describe('buildQuestionData', () => {
  it('choice: options + correctAnswer(목록 내) 설정', () => {
    expect(buildQuestionData('choice', {
      options: ['A', 'B'],
      correctAnswer: 'B'
    })).toEqual({
      options: ['A', 'B'],
      correctAnswer: 'B'
    });
  });
  it('choice: correctAnswer가 목록에 없으면 첫 옵션으로 보정', () => {
    expect(buildQuestionData('choice', {
      options: ['A', 'B'],
      correctAnswer: 'Z'
    }).correctAnswer).toBe('A');
  });
  it('ranking: correctAnswer는 인덱스 문자열', () => {
    expect(buildQuestionData('ranking', {
      options: ['x', 'y', 'z']
    }).correctAnswer).toBe('0,1,2');
  });
  it('fillinblank: correctAnswer trim', () => {
    expect(buildQuestionData('fillinblank', {
      correctAnswer: '  답  '
    }).correctAnswer).toBe('답');
  });
  it('ox: 기본 O', () => {
    expect(buildQuestionData('ox', {}).correctAnswer).toBe('O');
    expect(buildQuestionData('ox', {
      correctAnswer: 'X'
    }).correctAnswer).toBe('X');
  });
  it('quiz: QUIZ_DEFAULTS + points + event/betting 조건부', () => {
    const d = buildQuestionData('quiz', {
      options: ['A', 'B'],
      correctAnswer: 'A',
      points: 200,
      betting: true,
      event: 'double-points'
    });
    expect(d).toMatchObject({
      options: ['A', 'B'],
      correctAnswer: 'A',
      points: 200,
      speedWindowMs: 30000,
      maxSpeedBonus: 50,
      betting: true,
      event: 'double-points'
    });
  });
  it('quiz: points 미지정 시 기본 100, betting 미지정 시 키 없음', () => {
    const d = buildQuestionData('quiz', {
      options: ['A', 'B'],
      correctAnswer: 'A'
    });
    expect(d.points).toBe(100);
    expect('betting' in d).toBe(false);
  });
  it('mysteryBox: 빈 배열은 키 미포함', () => {
    const d = buildQuestionData('mysteryBox', {
      correctAnswer: '정답',
      mysteryItems: ['a'],
      answerReasons: [],
      winners: []
    });
    expect(d.mysteryItems).toEqual(['a']);
    expect('answerReasons' in d).toBe(false);
    expect('winners' in d).toBe(false);
  });
  it('hintQuiz: hints 기본 [] + revealedHints 0', () => {
    const d = buildQuestionData('hintQuiz', {
      correctAnswer: '답',
      hints: ['h1']
    });
    expect(d.hints).toEqual(['h1']);
    expect(d.revealedHints).toBe(0);
  });
  it('subjective: modelAnswer trim, 비면 키 없음', () => {
    expect(buildQuestionData('subjective', {
      modelAnswer: '  모범  '
    }).modelAnswer).toBe('모범');
    expect('modelAnswer' in buildQuestionData('subjective', {
      modelAnswer: '   '
    })).toBe(false);
  });
  it('공통: imageUrl/hideTitle/slideImages 조건부', () => {
    const d = buildQuestionData('imageSlide', {
      imageUrl: 'u',
      hideTitle: true,
      slideImages: ['s1']
    });
    expect(d).toMatchObject({
      imageUrl: 'u',
      hideTitle: true,
      slideImages: ['s1']
    });
    expect('imageUrl' in buildQuestionData('choice', {
      options: ['A', 'B']
    })).toBe(false);
  });
  it('QUESTION_TYPE_FIELDS가 buildQuestionData가 만들 수 있는 모든 type별 키를 커버 (stale 제거용)', () => {
    // 모든 유형으로 생성한 키가 stale-제거 목록에 포함돼야 type 변경 시 잔재가 안 남음
    const allKeys = new Set();
    const cases = [['choice', {
      options: ['A', 'B'],
      correctAnswer: 'A'
    }], ['quiz', {
      options: ['A', 'B'],
      correctAnswer: 'A',
      betting: true,
      event: 'x'
    }], ['ranking', {
      options: ['a', 'b', 'c']
    }], ['ox', {}], ['fillinblank', {
      correctAnswer: 'a'
    }], ['mysteryBox', {
      correctAnswer: 'a',
      mysteryItems: ['m'],
      answerReasons: ['r'],
      winners: ['w']
    }], ['hintQuiz', {
      correctAnswer: 'a',
      hints: ['h'],
      acceptableAnswers: ['x'],
      winners: ['w'],
      answerReasons: ['r']
    }], ['subjective', {
      modelAnswer: 'm'
    }], ['imageSlide', {
      imageUrl: 'u',
      hideTitle: true,
      slideImages: ['s']
    }]];
    for (const [type, fields] of cases) {
      Object.keys(buildQuestionData(type, fields)).forEach(k => allKeys.add(k));
    }
    for (const k of allKeys) expect(QUESTION_TYPE_FIELDS).toContain(k);
  });
});
