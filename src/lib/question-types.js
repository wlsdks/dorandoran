import { ArrowUpDown, BarChart3, CheckCircle, Circle, Cloud, Globe, HelpCircle, Image, Lightbulb, MessageSquare, PenLine, Gavel, Swords, TextCursorInput, Thermometer, Trophy, Type } from 'lucide-react';

/**
 * Canonical question type definitions.
 * Single source of truth — imported by QuestionForm, QuestionList,
 * QuestionLibraryView, ImportFromLibraryModal, CourseEditor, StatsView.
 */
export const QUESTION_TYPES = [
  { value: 'choice', label: '객관식', icon: BarChart3 },
  { value: 'quiz', label: '퀴즈', icon: Trophy },
  { value: 'ox', label: 'O/X', icon: Circle },
  { value: 'wordcloud', label: '워드클라우드', icon: Cloud },
  { value: 'qna', label: 'Q&A', icon: MessageSquare },
  { value: 'subjective', label: '주관식', icon: PenLine },
  { value: 'scale', label: '감정 온도계', icon: Thermometer },
  { value: 'debate', label: '찬반 토론', icon: Swords },
  { value: 'ranking', label: '순위 맞추기', icon: ArrowUpDown },
  { value: 'fillinblank', label: '빈칸 채우기', icon: TextCursorInput },
  { value: 'shortAnswer', label: '단답식', icon: Type },
  { value: 'check', label: '실습 체크', icon: CheckCircle },
  { value: 'imageSlide', label: '이미지', icon: Image },
  { value: 'webEmbed', label: '웹페이지', icon: Globe },
  { value: 'mysteryBox', label: '미스터리 박스', icon: HelpCircle },
  { value: 'hintQuiz', label: '힌트 퀴즈', icon: Lightbulb },
  { value: 'aiJudge', label: 'AI 심사', icon: Gavel },
];

/**
 * Map for quick lookup by type value.
 * Returns { label, icon } for a given question type string.
 */
export const QUESTION_TYPE_MAP = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, { label: t.label, icon: t.icon }])
);

/** Simple label-only map for display without icons. */
export const TYPE_LABELS = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label])
);
