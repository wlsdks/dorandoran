// 공용 모션 어휘 — 화면마다 숫자를 새로 정하지 않고 여기서 고른다.
// 원칙: transform/opacity만, 한 단계 400ms 이하(의도된 공개 연출만 예외), 스프링 기본.
// 감속 모션 설정은 App의 MotionConfig가 transform/layout을 끄고, 길거나 반복되는 연출은 각 컴포넌트가 useReducedMotion으로 줄인다.
import { motion as tokens } from '@/lib/design-tokens';

export const spring = tokens.spring;           // default(300/25) · gentle(200/20) · bouncy(400/22) · stiff(500/30)
/** 탭 표시선·선택 배경처럼 자리를 옮기는 요소 — 튀지 않고 빠르게 멈춘다. */
export const snap = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };
/** 목록 항목이 자리를 바꿀 때(layout). */
export const settle = { type: 'spring', stiffness: 380, damping: 32 };
/** 막대·기둥·진행바가 자라날 때 — 임계감쇠에 가까워 표가 흔들리지 않고, 값이 연달아 바뀌어도 현재 위치에서 이어간다. */
export const grow = { type: 'spring', stiffness: 210, damping: 28 };
/** 공개 순간의 카드·점수 — 살짝 넘쳤다가 멈추는 단 한 번의 강조. */
export const reveal = { type: 'spring', stiffness: 260, damping: 22 };
/** 시트·드로어가 닫힐 때 손을 뗀 속도를 이어받아 빠르게 멈춘다. */
export const sheet = { type: 'spring', stiffness: 420, damping: 38 };
/** 숫자 자리가 굴러 바뀔 때(초 카운트다운, 시계 자릿수). */
export const roll = { type: 'spring', stiffness: 320, damping: 30 };

export const ease = { out: [0.22, 1, 0.36, 1], in: [0.4, 0, 1, 1], inOut: [0.65, 0, 0.35, 1], emphasized: [0.2, 0.8, 0.2, 1] };
export const duration = { instant: 0.08, fast: 0.15, base: 0.2, slow: 0.3, reveal: 0.4 };
export const exitTween = { duration: 0.12, ease: ease.in };

/** 등장 프리셋 — motion 컴포넌트에 그대로 펼친다: <motion.div {...fadeUp}> */
export const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };
export const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8, transition: exitTween }, transition: spring.default };
export const fadeUpSm = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 4, transition: exitTween }, transition: spring.default };
/** 팝오버·메뉴 — 시작점에서 살짝 자라난다. style에 transformOrigin을 함께 준다. */
export const pop = { initial: { opacity: 0, scale: 0.96, y: -4 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98, y: -2, transition: exitTween }, transition: snap };
/** 가운데 대화상자 */
export const dialog = { initial: { opacity: 0, scale: 0.96, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98, y: 6, transition: exitTween }, transition: spring.default };
/** 아래에서 올라오는 시트·토스트 */
export const rise = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12, transition: exitTween }, transition: spring.default };
/** 배지·점 같은 작은 상태 표시가 생길 때 */
export const popIn = { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.6, transition: exitTween }, transition: spring.bouncy };
/** 옆에서 밀려 들어오는 알림 칩(전자칠판 입장 알림) — 들어온 쪽으로 나간다. */
export const slideInRight = { initial: { opacity: 0, x: 40, scale: 0.96 }, animate: { opacity: 1, x: 0, scale: 1 }, exit: { opacity: 0, x: 40, scale: 0.96, transition: exitTween }, transition: snap };
/** 단계형 폼의 다음 단계 — 오른쪽에서 들어와 왼쪽으로 나간다(진행 방향이 읽힌다). */
export const stepForward = { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -12, transition: exitTween }, transition: { duration: duration.base, ease: ease.out } };

/**
 * 활동(질문·모드) 교체 — 전자칠판과 발표 화면이 같은 궤적을 쓴다.
 * 질문은 아래에서 올라오고 위로 사라지며, 특수 모드는 살짝 커지며 들어온다. 랭킹은 위에서 내려온다.
 * @param {'question'|'stage'|'leaderboard'|'fade'} kind
 */
export function swap(kind = 'question') {
  const t = { duration: 0.22, ease: ease.out };
  if (kind === 'stage') return { initial: { opacity: 0, scale: 0.985 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.99, transition: exitTween }, transition: t };
  if (kind === 'leaderboard') return { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8, transition: exitTween }, transition: t };
  if (kind === 'fade') return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: exitTween }, transition: t };
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8, transition: exitTween }, transition: t };
}

/** 목록 stagger — 부모에 variants={list.container} initial="initial" animate="animate", 자식에 variants={list.item} */
export const list = {
  container: { initial: {}, animate: { transition: { staggerChildren: tokens.stagger.fast } } },
  item: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: spring.default }, exit: { opacity: 0, scale: 0.98, transition: exitTween } },
};

/**
 * 항목별 지연(초). 긴 목록에서 뒤쪽 항목이 영영 늦게 나오지 않도록 cap 이후는 같은 지연을 쓴다.
 * @param {number} index
 * @param {{ step?: number, cap?: number, base?: number }} [opts] step 기본 stagger.fast(0.03), cap 기본 8
 */
export function stagger(index, { step = tokens.stagger.fast, cap = 8, base = 0 } = {}) {
  const i = Math.max(0, Math.min(Number(index) || 0, cap));
  return Math.round((base + i * step) * 1000) / 1000;
}

/** 옵션 흐리기 단계 — 오답(option)과 집중 조명 밖(spotlight)을 화면마다 다르게 쓰지 않는다. */
export const dim = { option: 0.55, spotlight: 0.42 };

/** 숫자 변화 — AnimatedNumber/AnimatedScore가 같은 곡선을 쓴다. score는 점수 공개처럼 한 번 보여주는 긴 카운트. */
export const count = { number: { duration: 0.28, ease: ease.out }, score: { duration: 0.45, ease: ease.out } };

/**
 * 감속 모션일 때 transform 프리셋을 짧은 페이드로 바꾼다. 비감속일 때는 프리셋을 그대로 돌려준다.
 * @param {boolean} reduced useReducedMotion()
 * @param {{ initial: object, animate: object, exit?: object, transition?: object }} preset
 */
export function reduceTo(reduced, preset) {
  if (!reduced) return preset;
  const fade = { duration: 0.08 };
  return { initial: { opacity: 0 }, animate: { opacity: 1, transition: fade }, ...(preset.exit ? { exit: { opacity: 0, transition: fade } } : {}), transition: fade };
}

/** 눌림 피드백 (whileTap) */
export const tap = { button: { scale: 0.97 }, card: { scale: 0.985 }, icon: { scale: 0.9 } };
