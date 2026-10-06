// 공용 모션 어휘 — 화면마다 숫자를 새로 정하지 않고 여기서 고른다.
// 원칙: transform/opacity만, 400ms 이하, 스프링 기본. 감속 모션 설정은 App의 MotionConfig가 처리한다.
import { motion as tokens } from '@/lib/design-tokens';

export const spring = tokens.spring;           // default(300/25) · gentle(200/20) · bouncy(400/22) · stiff(500/30)
/** 탭 표시선·선택 배경처럼 자리를 옮기는 요소 — 튀지 않고 빠르게 멈춘다. */
export const snap = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };
/** 목록 항목이 자리를 바꿀 때(layout). */
export const settle = { type: 'spring', stiffness: 380, damping: 32 };

export const ease = { out: [0.22, 1, 0.36, 1], in: [0.4, 0, 1, 1] };
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

/** 목록 stagger — 부모에 variants={list.container} initial="initial" animate="animate", 자식에 variants={list.item} */
export const list = {
  container: { initial: {}, animate: { transition: { staggerChildren: tokens.stagger.fast } } },
  item: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: spring.default }, exit: { opacity: 0, scale: 0.98, transition: exitTween } },
};

/** 눌림 피드백 (whileTap) */
export const tap = { button: { scale: 0.97 }, card: { scale: 0.985 }, icon: { scale: 0.9 } };
