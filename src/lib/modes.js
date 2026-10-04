import {
  Gift, Grid3x3, Trophy, Coffee, MessageSquare, Award, Eye, UserCircle,
  Activity, BarChart3, Timer, Medal, UserPlus, HelpCircle,
} from 'lucide-react';

/**
 * 특수 모드(질문이 아닌 화면) 단일 출처.
 *
 * 이 목록이 흩어져 있으면 화면마다 켤 수 있는 모드가 달라진다. 실제로 그런 상태였다 —
 * 대시보드 메뉴에는 있는데 발표 모드 메뉴에는 없어서, 강사가 프로젝터 앞에서 모드를 바꾸려면
 * 발표를 빠져나갔다 다시 들어와야 했다. 목록을 한 곳에 두고 모든 화면이 여기서 읽는다.
 *
 * requiresLeaderboard: 점수가 하나도 없으면 의미가 없어 메뉴에서 감추는 모드.
 */
export const SPECIAL_MODES = [
  { mode: 'lottery', label: '추첨', icon: Gift, group: '게임' },
  { mode: 'scratchCard', label: '즉석복권', shortLabel: '복권', icon: Grid3x3, group: '게임' },
  { mode: 'randomPicker', label: '발표자 뽑기', shortLabel: '발표자', icon: UserCircle, group: '게임' },

  { mode: 'joinShow', label: '접속 현황', icon: UserPlus, group: '참여' },
  { mode: 'comprehension', label: '이해도 체크', shortLabel: '이해도', icon: Activity, group: '참여' },
  { mode: 'quickSurvey', label: '빠른 설문', shortLabel: '설문', icon: BarChart3, group: '참여' },
  { mode: 'discussion', label: '그룹 토론', shortLabel: '토론', icon: Timer, group: '참여' },
  { mode: 'qaBoard', label: 'Q&A 보드', shortLabel: 'Q&A', icon: MessageSquare, group: '참여' },

  { mode: 'leaderboard', label: '리더보드', icon: Trophy, group: '결과', requiresLeaderboard: true },
  { mode: 'combinedRanking', label: '합산 랭킹', shortLabel: '합산', icon: Medal, group: '결과' },
  { mode: 'qaRanking', label: 'Q&A 랭킹', icon: HelpCircle, group: '결과' },
  { mode: 'awards', label: '시상식', icon: Award, group: '결과' },

  { mode: 'focus', label: '집중!', icon: Eye, group: '기타' },
  { mode: 'breakTime', label: '쉬는 시간', shortLabel: '쉬는시간', icon: Coffee, group: '기타' },
];

/** 모드 키만 필요한 곳(현재 모드가 특수 화면인지 판정)용. */
export const SPECIAL_MODE_KEYS = SPECIAL_MODES.map((m) => m.mode);

/**
 * 질문 목록에 꽂아두는 '모드 카드'의 질문 유형 값.
 *
 * 강사가 수업 중에 모드 메뉴를 뒤지지 않도록, 추첨·쉬는시간 같은 화면을 질문과 같은 목록에
 * 순서대로 배치해두고 눌러서 진행한다. 활성화하면 질문 대신 currentMode가 바뀐다.
 */
export const MODE_CARD_TYPE = 'modeCard';

export const MODE_GROUP_ORDER = ['게임', '참여', '결과', '기타'];

/**
 * 메뉴에 뿌릴 그룹 구조를 만든다.
 * @param {{ hasLeaderboard?: boolean }} [opts] 점수가 있는지 — 없으면 리더보드를 감춘다
 */
export function modeGroups({ hasLeaderboard = false } = {}) {
  const visible = SPECIAL_MODES.filter((m) => !m.requiresLeaderboard || hasLeaderboard);
  return MODE_GROUP_ORDER
    .map((group) => ({ label: group, items: visible.filter((m) => m.group === group) }))
    .filter((g) => g.items.length > 0);
}

/** 현재 모드의 표시 이름. 좁은 자리에서는 shortLabel을 쓴다. */
export function modeLabel(mode, { short = false } = {}) {
  const found = SPECIAL_MODES.find((m) => m.mode === mode);
  if (!found) return null;
  return short ? (found.shortLabel || found.label) : found.label;
}

export function isSpecialMode(mode) {
  return SPECIAL_MODE_KEYS.includes(mode);
}
