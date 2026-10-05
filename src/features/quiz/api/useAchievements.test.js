import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/participant', () => ({ getParticipantId: () => 'learner' }));
import { computeAchievements, computeAchievementStats } from './useAchievements';

describe('participation achievements', () => {
  const materials = {
    slides: { type: 'imageSlide' },
    web: { type: 'webEmbed' },
    game: { type: 'modeCard' },
    work: { type: 'aiJudge' },
  };
  const hasFullParticipation = (questions) => computeAchievements(questions, 'learner', {}).some(a => a.id === 'full-participation');

  it('recognizes every answerable activity completed despite non-voting lesson content', () => {
    expect(hasFullParticipation({ ...materials, poll: { type: 'choice', votes: { learner: { value: 'A' } } }, quiz: { type: 'quiz', votes: { learner: { value: 'B' } } } })).toBe(true);
  });

  it('does not award full participation for materials-only lessons or an unanswered legacy question', () => {
    expect(hasFullParticipation(materials)).toBe(false);
    expect(hasFullParticipation({ ...materials, answered: { type: 'check', votes: { learner: { value: 'done' } } }, unanswered: { type: 'quiz' } })).toBe(false);
  });

  it('uses the same denominator for individual and class achievement counts', () => {
    const questions = { ...materials, poll: { type: 'choice', votes: { learner: { value: 'A' } } } };
    const achievement = computeAchievementStats(questions, {}, ['learner', 'absent']).find(a => a.id === 'full-participation');
    expect(achievement.count).toBe(1);
  });

  it('retains recorded streak achievements and leaves existing scores and participant ids unchanged', () => {
    const scores = { existingUid: { total: 425, bestStreak: 5, nickname: '기존학생' } };
    const original = structuredClone(scores);
    expect(computeAchievements(materials, 'existingUid', scores).some(a => a.id === 'streak-5')).toBe(true);
    expect(scores).toEqual(original);
  });
});
