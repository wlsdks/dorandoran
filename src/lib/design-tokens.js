// DoranDoran Design Tokens
// Single source of truth for all design values.
// Usage: import { colors, spacing, motion } from '@/lib/design-tokens'

// ─── Colors ──────────────────────────────────────────
// 값의 원본은 src/styles/index.css의 `html` / `html.dark` 변수 블록이다(Tailwind 기본 팔레트를 덮어쓴다).
// 여기는 JS에서 색을 직접 써야 할 때(SVG, canvas, 차트)의 거울값 — 두 곳을 함께 바꾼다.
export const colors = {
  // Accent — 차분한 indigo (차트 바, 포커스 링, 진행바, 활성 ring 전용)
  brand: '#5E6AD2',          // indigo-500 — 흰 바탕 4.7:1
  brandHover: '#4E59BD',     // indigo-600
  brandLight: '#7F87D8',     // indigo-400 (dark mode)
  brandAccent: '#5E6AD2',    // indigo-500

  // Functional (status only, not decorative) — 500 = 채움·아이콘(흰 글자 4.5:1 이상), 600 = 글자, 400 = 다크 글자
  success: '#0A845D',        // emerald-500
  successText: '#0A7350',    // emerald-600
  successDark: '#3DCF98',    // emerald-400
  warning: '#C97A08',        // amber-500 (아이콘·점 전용, 3.35:1)
  warningText: '#AD5D0A',    // amber-600
  warningDark: '#F2B63A',    // amber-400
  error: '#D43A3A',          // red-500
  errorText: '#B53030',      // red-600
  errorDark: '#EE8080',      // red-400

  // Surfaces (light)
  bg: '#F1F1F3',             // slate-50
  surface: '#FFFFFF',
  surfaceAlt: '#E9E9EC',     // slate-100
  surfaceHover: '#F1F1F3',   // slate-50

  // Borders (light)
  border: '#DCDCE0',         // slate-200
  borderLight: '#E9E9EC',    // slate-100
  borderActive: '#72727B',   // slate-400

  // Text (light)
  text: {
    primary: '#18181B',      // slate-900 — 17.7:1
    secondary: '#4B4B53',    // slate-600 — 8.6:1
    muted: '#72727B',        // slate-400 — 4.76:1 (AA, 글자로 쓸 수 있는 가장 흐린 단계)
    subtle: '#BBBBC2',       // slate-300 — 아이콘·구분선 전용, 글자 금지
    inverse: '#FFFFFF',
  },

  // Dark surfaces/text (zinc — 남색 기 없음)
  dark: {
    stage: '#09090B',        // slate-950
    panel: '#151517',        // slate-900
    card: '#232327',         // slate-800
    raised: '#3C3C43',       // slate-700 (입력칸·hover)
    border: '#3C3C43',       // slate-700
    text: '#F4F4F5',         // slate-100
    secondary: '#D4D4D8',    // slate-300
    muted: '#A7A7AF',        // slate-400 — 입력칸(700) 위 4.58:1
  },

  // Bar chart (indigo gradient)
  chart: {
    bar1: '#5E6AD2',         // indigo-500
    bar2: '#7F87D8',         // indigo-400
    bar3: '#A3A9E4',         // indigo-300
    barWrong: '#BBBBC2',     // slate-300
  },

  // OX Battle
  ox: {
    o: '#5E6AD2',            // indigo-500
    x: '#72727B',            // slate-400
  },
};

// ─── Typography ──────────────────────────────────────
export const typography = {
  fontFamily: "'Pretendard', 'Inter', -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif",
  sizes: {
    display: 'text-4xl',     // 36px
    title: 'text-2xl',       // 24px
    heading: 'text-xl',      // 20px
    section: 'text-lg',      // 18px
    body: 'text-base',       // 16px
    small: 'text-sm',        // 14px
    caption: 'text-xs',      // 12px
    micro: 'text-[10px]',    // 10px
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

// ─── Spacing ─────────────────────────────────────────
export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  '2xl': '2rem',   // 32px
  '3xl': '3rem',   // 48px
};

// ─── Icons ──────────────────────────────────────────
export const icons = {
  // Size scale — lucide-react `size` prop
  inline: 12,       // inline with text
  accordion: 14,    // accordion headers
  button: 16,       // inside buttons
  header: 18,       // header actions
  headerLg: 20,     // large header icons
  action: 22,       // bottom bar (mobile)
  tab: 24,          // tab bar (mobile)
  // Stroke
  default: 2,
  active: 2,
  inactive: 1.5,
  // Color
  color: 'text-slate-400',
  colorActive: 'text-slate-700 dark:text-slate-200',
};

// ─── Press Feedback (Web + Mobile) ──────────────────
export const press = {
  // Web (desktop hover + click)
  button: { scale: 0.97 },          // CTA, secondary buttons
  buttonSm: { scale: 0.9 },         // icon-only buttons (send, close)
  card: { scale: 0.98 },            // clickable cards
  accordion: 'active:bg-slate-100', // accordion headers (CSS only)
  iconBtn: { scale: 0.9 },          // small icon buttons
  // Mobile (touch — stronger feedback as haptic substitute)
  mobileButton: { scale: 0.95 },    // choice/quiz options
  mobileTab: { scale: 0.92 },       // bottom tab bar
  mobileSend: { scale: 0.9 },       // send buttons
  mobileCard: { scale: 0.98 },      // tappable cards
  // Selection bounce (after selecting an option)
  selectionBounce: { scale: [0.95, 1.04, 1] },
};

// ─── Radius ──────────────────────────────────────────
export const radius = {
  sm: 'rounded-md',          // 6px — small buttons
  md: 'rounded-lg',          // 8px — buttons, inputs
  lg: 'rounded-xl',          // 12px — cards
  xl: 'rounded-2xl',         // 16px — modals, large cards
  full: 'rounded-full',      // avatars, badges
};

// ─── Shadows ─────────────────────────────────────────
export const shadows = {
  sm: 'shadow-sm',           // resting cards
  md: 'shadow-md',           // hover state
  lg: 'shadow-lg',           // modals, dropdowns
  xl: 'shadow-xl',           // floating panels
};

// ─── Motion ──────────────────────────────────────────
export const motion = {
  // Spring presets — use ONLY these values across all files
  spring: {
    default: { type: 'spring', stiffness: 300, damping: 25 },
    gentle: { type: 'spring', stiffness: 200, damping: 20 },
    bouncy: { type: 'spring', stiffness: 400, damping: 22 },
    stiff: { type: 'spring', stiffness: 500, damping: 30 },
    // Note: smooth(80/20) was replaced by gentle(200/20) across all files
  },
  // Duration presets
  duration: {
    instant: 0.1,
    fast: 0.15,
    normal: 0.2,
    slow: 0.3,
    enter: 0.3,
    exit: 0.2,
  },
  // Easing
  ease: {
    default: [0.4, 0, 0.2, 1],
    in: [0.4, 0, 1, 1],
    out: [0, 0, 0.2, 1],
  },
  // Entry y-offset presets
  offset: { sm: 8, md: 12, lg: 20 },
  // Entry animations
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  slideUp: { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } },
  slideUpSm: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } },
  slideUpLg: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
  slideDown: { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 } },
  scaleIn: { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 } },
  // Stagger
  stagger: {
    fast: 0.03,
    normal: 0.05,
    slow: 0.08,
  },
};

// ─── Component Recipes (Tailwind) ────────────────────
export const tw = {
  // Cards
  card: 'bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5',
  cardHover: 'bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow',
  cardInteractive: 'bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]',

  // Buttons
  btnBase: 'font-medium rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97]',
  btnPrimary: 'bg-slate-900 hover:bg-slate-800 text-white focus-visible:ring-slate-400',
  btnSecondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 focus-visible:ring-slate-300',
  btnGhost: 'hover:bg-slate-100 text-slate-600 focus-visible:ring-slate-300',
  btnDanger: 'bg-red-500 hover:bg-red-600 text-white focus-visible:ring-red-400',
  btnSm: 'py-1.5 px-3 text-sm',
  btnMd: 'py-2.5 px-5 text-base',
  btnLg: 'py-3 px-6 text-lg',

  // Inputs
  input: 'w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors duration-150',
  inputError: 'border-red-400 focus:ring-red-500/20 focus:border-red-500',

  // Badges
  badge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  badgePrimary: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  badgeNeutral: 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  badgeError: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // Avatar
  avatar: 'rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold',

  // Modal
  modalBackdrop: 'fixed inset-0 bg-black/30 backdrop-blur-sm z-50',
  modalContent: 'bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-md mx-auto',

  // Accordion
  accordionHeader: 'w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors',
  accordionTitle: 'text-sm font-semibold text-slate-600',

  // Skeleton
  skeleton: 'animate-shimmer rounded-lg dark:bg-slate-700',
};

// ─── Timing ──────────────────────────────────────────
export const timing = {
  toastDuration: 3000,
  toastGracePeriod: 2000,
  successToastDuration: 2000,
  voteConfirmDelay: 2500,
  lotteryRevealInterval: 800,
  reactionBubbleLifetime: 2000,
  reactionCooldown: 3000,
  timerTickInterval: 200,
  autoScrollDelay: 250,
};

// ─── Limits ──────────────────────────────────────────
export const limits = {
  maxReactionBubbles: 15,
  maxStoredReactions: 50,
  nicknameMinLength: 2,
  nicknameMaxLength: 10,
  chatMaxLength: 500,
  urgentQuestionMaxLength: 300,
  componentMaxLines: 200,
};

// ─── Touch ───────────────────────────────────────────
export const touch = {
  minTarget: '48px',         // minimum touch target on mobile
  dragActivation: 5,         // px distance before drag starts
};

// ─── Device Viewports (CSS pixels) ───────────────────
// Reference: 2026 기준 주요 기기 뷰포트 (테스트 대상)
export const viewports = {
  // iPhone 14~17 series
  iphone14:       { w: 390, h: 844 },    // iPhone 14
  iphone14Pro:    { w: 393, h: 852 },    // iPhone 14 Pro, 15, 15 Pro, 16
  iphone14ProMax: { w: 430, h: 932 },    // iPhone 14 Pro Max, 15 Plus/Pro Max
  iphone16Pro:    { w: 402, h: 874 },    // iPhone 16 Pro, 17
  iphone16ProMax: { w: 440, h: 956 },    // iPhone 16 Pro Max, 17 Pro Max
  // Galaxy S23~S26 series
  galaxyS:        { w: 360, h: 780 },    // Galaxy S23/S24/S25 (compact)
  galaxySPlus:    { w: 384, h: 824 },    // Galaxy S24+/S25+
  galaxySUltra:   { w: 412, h: 892 },    // Galaxy S24 Ultra/S25 Ultra/S26
  // Tablet
  ipadMini:       { w: 744, h: 1133 },   // iPad mini 7
  ipad:           { w: 810, h: 1080 },   // iPad 10th
  ipadAir:        { w: 820, h: 1180 },   // iPad Air
  ipadPro11:      { w: 834, h: 1194 },   // iPad Pro 11"
  // Desktop
  laptop:         { w: 1440, h: 900 },   // MacBook Pro 14"
  desktop:        { w: 1920, h: 1080 },  // Full HD

  // 테스트 대표 기기 (Playwright 순회용)
  // 최소: Galaxy S (360px) — 가장 좁은 화면
  // 표준: iPhone 14 (390px) — 가장 보편적
  // 중간: iPhone 16 Pro (402px) — 최신 중간 크기
  // 대형: iPhone 16 Pro Max (440px) — 가장 넓은 폰
  // 태블릿: iPad (810px)
  // 데스크탑: 1440px
};

// ─── Mobile Design Tokens (< 768px) ─────────────────
// Reference: 토스, 당근, 카카오, Apple HIG
// These values override web defaults on mobile breakpoints.
export const mobile = {
  // Typography — all sizes +1~2px from web
  typography: {
    body: '15px',            // text-[15px] — web: 14px
    bodyLarge: '16px',       // text-base
    sectionTitle: '16px',    // text-[16px] — web: 14px
    pageTitle: '16px',       // text-base — web: 20px (space-saving)
    hero: '36px',            // text-4xl — big numbers
    caption: '13px',         // text-[13px] — web: 12px
    tabLabel: '11px',        // text-[11px] — Apple HIG standard
    chatBubble: '15px',      // text-[15px] — KakaoTalk reference
    chatSender: '13px',      // text-[13px]
    chatTime: '11px',        // text-[11px]
  },
  // Spacing — generous padding, bg contrast sections
  spacing: {
    pagePadding: '20px',     // px-5
    cardPadding: '20px',     // p-5
    sectionGap: '8px',       // space-y-2 (당근/카카오 thick divider)
    itemGap: '4px',          // space-y-1
    headerPadding: 'px-5 py-3.5',
  },
  // Components
  components: {
    touchTarget: '44px',     // Apple HIG minimum
    tabBarHeight: '56px',    // + safe area inset
    iconSize: '22px',        // bottom bar icons
    tabIconSize: '24px',     // tab bar icons
    avatarChat: '36px',      // w-9 chat avatar
    buttonRadius: '12px',    // rounded-xl
    cardRadius: '16px',      // rounded-2xl
  },
  // Section separation — no borders, bg contrast only
  separation: {
    method: 'bg-contrast',   // bg-slate-50 page + bg-white cards
    sectionDivider: 'h-2 bg-slate-100', // 8px gray bar (당근 pattern)
    itemDivider: 'border-b border-slate-100', // thin hairline
    forbidden: ['shadow', 'border+shadow', 'colored-borders'],
  },
  // Modal behavior
  modal: {
    mobile: 'fixed inset-0',           // fullscreen
    tablet: 'fixed inset-auto 420x600', // centered
    animation: 'y: 20→0',              // slide up from bottom
  },
  // Press feedback → use top-level `press` export instead
};
