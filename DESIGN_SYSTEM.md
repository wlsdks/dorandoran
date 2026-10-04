# DoranDoran Design System

> 이 문서만으로 동일한 UI/UX를 다른 프로젝트에서도 재현할 수 있어야 함.
> 모든 값은 `src/lib/design-tokens.js`에 코드로도 정의됨.
> 2026-03-24 기준 최신 업데이트.

## 다른 프로젝트에서 사용하기 (Quick Start)

```bash
# 1. 이 파일을 프로젝트 루트에 복사
cp DESIGN_SYSTEM.md /your-project/

# 2. 디자인 토큰 JS 파일 복사
cp src/lib/design-tokens.js /your-project/src/lib/

# 3. CSS 기본 설정 복사 (index.css에 추가)
# - 폰트: Pretendard + Inter
# - 다크모드: @custom-variant dark
# - 모바일: overscroll-behavior, touch-action, iOS zoom 방지
# - 스켈레톤 shimmer 키프레임

# 4. 코드에서 토큰 import
import { colors, typography, motion, mobile, press, icons, tw } from '@/lib/design-tokens'
```

### 토큰 구조 요약
```
colors      — 브랜드, 기능색, 표면, 텍스트, 차트
typography  — 크기 체계, 굵기
spacing     — 4px 기본 단위 (xs~3xl)
radius      — sm(6px) ~ full
shadows     — sm ~ xl
icons       — 크기 12~24px, 스트로크, 색상
press       — 웹/모바일 프레스 피드백 (scale 값)
motion      — spring 4프리셋, duration, easing, 진입 애니메이션
tw          — Tailwind 컴포넌트 레시피 (복사 가능)
timing      — 토스트, 쿨다운, 애니메이션 지속시간
limits      — 닉네임, 채팅, 질문 글자수 제한
touch       — 터치 타겟 최소 크기
mobile      — 모바일 전용 타이포, 간격, 컴포넌트, 섹션 구분, 모달
```

### 디자인 철학 (5줄 요약)
1. **빼는 디자인** — 요소를 추가하지 말고 불필요한 것을 제거
2. **여백이 디자인** — 공백은 비어있는 것이 아니라 의도적으로 설계된 것
3. **타이포가 위계** — 색상 대신 크기/두께/투명도로 구분
4. **모션은 의미만** — 피드백/전환/관계 표현. 장식 모션 0
5. **앱처럼 보여야 한다** — PWA이지만 네이티브 앱 수준의 UX

---

## 1. 핵심 원칙

### Anti-AI Aesthetic
AI가 생성한 것처럼 보이면 안 됨. 토스, Linear, Notion처럼 절제되고 의도적인 디자인.

| 항목 | AI 기본값 (금지) | Human 디자인 (우리) |
|------|-----------------|-------------------|
| CTA 버튼 | `bg-indigo-600` | `bg-slate-900` (dark CTA) |
| 배지 | `bg-indigo-50 text-indigo-700` | `bg-slate-100 text-slate-700` |
| 아이콘 | 컬러 원형 배경 안 | 아이콘만 bare |
| 카드 좌측 | `border-l-3 border-indigo-500` | `ring-1` or bg change |
| 바 차트 | 5색 레인보우 | 인디고 그라데이션 (브랜드) |
| 빈 상태 | Sparkles + "데이터 없음" | 마스코트 + 도움말 텍스트 |
| 레이아웃 | 3열 대칭 그리드 | 비대칭, 콘텐츠 중심 |

### 체크리스트 (매 작업 후 확인)
```
[ ] 한 화면에 3가지 이상 색상? → 2색으로 줄이기
[ ] 인디고/보라 CTA 버튼? → bg-slate-900
[ ] 좌측 컬러 악센트 바? → 제거
[ ] 아이콘이 색상 원형 배경 안? → 제거
[ ] 배지가 3종 이상 다른 색상? → slate 통일
[ ] 박스 배경에 색상 tint? → bg-white 또는 bg-slate-50만
[ ] 과도한 그라디언트/글래스모피즘? → 제거
[ ] 이 요소를 빼도 화면이 작동하는가? → 빼라
[ ] 색상 대신 크기/두께/여백으로 위계? → 그렇게 하라
[ ] 숫자/지표가 라벨보다 시각적으로 우선? → 숫자를 크고 굵게
[ ] 모바일에서 한 손으로 조작 가능? → 주요 액션은 thumb zone에
```

### 한국 앱 스타일 (토스/카카오/당근)
- 큰 제목 + 넉넉한 여백 + 최소 장식
- 색상은 기능에만 (상태, 에러), 장식에 사용 금지
- 숫자/금액은 크고 굵게, 라벨은 작고 연하게
- 애니메이션은 상태 전환에만, 장식적 모션 없음
- 모든 아이콘/버튼에 한국어 텍스트 라벨 필수

---

## 2. 색상 (Colors)

### CTA & 브랜드
| 용도 | Tailwind | Hex |
|------|----------|-----|
| CTA 버튼 | `bg-slate-900` | `#0F172A` |
| CTA hover | `hover:bg-slate-800` | `#1E293B` |
| CTA dark mode | `dark:bg-slate-100 dark:text-slate-900` | |
| 브랜드 아이콘 | `text-indigo-600` | `#4F46E5` |
| 악센트 (indigo) | `indigo-600/500/400/300` | 차트 바, 포커스 링, 진행바 전용 |
| Input focus ring | `focus:ring-indigo-500/20` | |
| 활성/선택 상태 | `bg-slate-900 text-white` | 탭, 토글, 선택지 |

### 배경 & 표면
| 용도 | Tailwind | Hex |
|------|----------|-----|
| 페이지 배경 | `bg-slate-50` | `#F8FAFC` |
| 카드/표면 | `bg-white` | `#FFFFFF` |
| 대체 표면 | `bg-slate-100` | `#F1F5F9` |

### 텍스트
| 용도 | Tailwind | Hex |
|------|----------|-----|
| 주요 텍스트 | `text-slate-900` | `#0F172A` |
| 보조 텍스트 | `text-slate-600` | `#475569` |
| 흐린 텍스트 | `text-slate-400` | `#94A3B8` |
| 반전 (흰색) | `text-white` | `#FFFFFF` |

### 기능 색상 (상태 표시에만 사용, 장식 금지)
| 용도 | Tailwind | Hex |
|------|----------|-----|
| 성공/연결 | `emerald-500` | `#10B981` |
| 경고/타이머 | `amber-500` | `#F59E0B` |
| 에러/위험 | `red-500` | `#EF4444` |

### 차트 색상 (브랜드)
| 용도 | Tailwind |
|------|----------|
| 바 차트 1~3 | indigo-600 → indigo-400 → indigo-300 |
| 오답/비활성 | slate-300 |
| OX - O/X | indigo-600 / slate-400 |

---

## 3. 다크 모드 (Dark Mode)

### 전략
- Tailwind CSS v4 `@custom-variant dark (&:where(.dark, .dark *))` 클래스 기반
- `useTheme` 훅: localStorage 기억 + prefers-color-scheme 연동 + html.dark 클래스 토글
- 3종 모드: 라이트 / 다크 / 시스템

### 다크 팔레트
| 용도 | 라이트 | 다크 |
|------|--------|------|
| 페이지 배경 | `bg-slate-50` | `dark:bg-slate-900` |
| 카드/패널 | `bg-white` | `dark:bg-slate-800` |
| 테두리 | `border-slate-200` | `dark:border-slate-700` |
| 주요 텍스트 | `text-slate-900` | `dark:text-slate-100` |
| 보조 텍스트 | `text-slate-600` | `dark:text-slate-300` |
| hover 배경 | `bg-slate-50` | `dark:hover:bg-slate-700` |
| CTA 버튼 | `bg-slate-900` | `dark:bg-slate-100 dark:text-slate-900` |
| Input 배경 | `bg-white` | `dark:bg-slate-700` |

### 다크 모드 CSS (index.css)
```css
@custom-variant dark (&:where(.dark, .dark *));

html.dark {
  color: #E2E8F0;
  background: #0F172A;
  color-scheme: dark;
}
.dark ::-webkit-scrollbar-thumb { background: #334155; }
.dark :focus-visible { outline-color: #818CF8; }
```

### 주의사항
- `text-slate-400`은 라이트/다크 양쪽에서 보이므로 dark: 생략 가능
- `text-slate-300` (장식용)은 반드시 `dark:text-slate-600` 추가
- inline style 색상은 다크모드 불가 → Tailwind 클래스 사용

---

## 4. 타이포그래피 (Typography)

### 폰트
```css
font-family: 'Pretendard', 'Inter', -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif;
```
- Pretendard: 한국어 (CDN)
- Inter: 영문/숫자 (Google Fonts)

### 크기 체계
| 이름 | 크기 | Tailwind | 용도 |
|------|------|----------|------|
| Display | 36px | `text-4xl` | 히어로 숫자 |
| Title | 24px | `text-2xl` | 페이지 제목 |
| Heading | 20px | `text-xl` | 섹션 제목 |
| Section | 18px | `text-lg` | 서브 제목 |
| Body | 16px | `text-base` | 본문 |
| Small | 14px | `text-sm` | 보조 텍스트, 라벨 |
| Caption | 12px | `text-xs` | 캡션, 메타 정보 |
| Micro | 10px | `text-[10px]` | 힌트, 키보드 단축키 |

### 굵기 & 규칙
| Weight | 값 | 용도 |
|--------|---|------|
| Normal | 400 | 본문 |
| Medium | 500 | 라벨, 보조 |
| Semibold | 600 | 서브 제목, 강조 |
| Bold | 700 | 제목, 숫자 |

- 본문 line-height: 1.6~1.8
- 제목 letter-spacing: -0.01em
- 숫자는 `tabular-nums text-right` (열 정렬)
- 큰 텍스트는 가볍게(400-500), 작은 텍스트는 무겁게(500-600)

---

## 5. 간격 (Spacing)

### 기본 단위: 4px
| 토큰 | 값 | Tailwind |
|------|---|----------|
| xs | 4px | `p-1` / `gap-1` |
| sm | 8px | `p-2` / `gap-2` |
| md | 12px | `p-3` / `gap-3` |
| lg | 16px | `p-4` / `gap-4` |
| xl | 24px | `p-6` / `gap-6` |
| 2xl | 32px | `p-8` / `gap-8` |
| 3xl | 48px | `p-12` / `gap-12` |

### 여백 원칙
| 상황 | 간격 |
|------|------|
| 같은 그룹 내 요소 | `gap-2~3` (8-12px) |
| 다른 섹션 사이 | `gap-4~6` (16-24px) |
| 카드 내부 패딩 | `p-5` (20px) |
| 모달 내부 패딩 | `p-6` (24px) |
| 탭 ↔ 콘텐츠 | 최소 `mb-5` (20px) |
| 페이지 가장자리 (데스크탑) | `p-8` (32px) |
| 페이지 가장자리 (모바일) | `px-5` (20px) |

> 그룹 간격 > 그룹 내 간격 (Gestalt 근접성). 빈 공간을 두려워하지 말 것.

---

## 6. 컴포넌트 규격

> Tailwind 레시피는 `design-tokens.js`의 `tw` 객체에 코드로 정의됨.

### 카드
```
패딩: p-5 (20px)
테두리: border border-slate-100 (기본) / border-slate-200 (interactive)
모서리: rounded-xl (12px)
그림자: shadow-sm (기본) / shadow-md (hover)
다크: dark:bg-slate-800 dark:border-slate-700

깊이 표현 (택 1, 혼합 금지):
  A: shadow-sm (그림자만) ← 권장
  B: border border-slate-200 (테두리만) ← 아코디언, 입력 필드
  ✗ shadow + border 동시 사용 금지
```

### 버튼
| 사이즈 | 패딩 | 높이 (약) |
|--------|------|-----------|
| sm | `py-1.5 px-3` | 32px |
| md | `py-2.5 px-5` | 40px |
| lg | `py-3 px-6` | 48px |

```
모서리: rounded-lg (8px)
전환: transition-colors duration-150
프레스: active:scale-[0.97] (CTA) / active:scale-90 (아이콘)
포커스: focus-visible:ring-2 focus-visible:ring-offset-2
다크 Primary: dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900
다크 Secondary: dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600
다크 Ghost: dark:hover:bg-slate-700 dark:text-slate-300

규칙:
- 한 화면에 Primary 버튼 하나만 강조
- hover + focus-visible 쌍 필수
- hover 전환 150-200ms
```

### hover 상태
| 요소 | hover 패턴 |
|------|-----------|
| 카드 (클릭 가능) | `hover:shadow-md transition-shadow` |
| 목록 행 | `hover:bg-slate-50 dark:hover:bg-slate-700/50` |
| 아이콘 버튼 | `text-slate-400 hover:text-slate-600` |
| 삭제 버튼 | `text-slate-300 hover:text-red-500` |
| 고스트 버튼 | `hover:bg-slate-100 dark:hover:bg-slate-700` |

### 입력 (Input)
```
패딩: px-4 py-3
모서리: rounded-lg (8px)
포커스: focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
다크: dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100

규칙:
- 라벨은 입력 위 (좌측/placeholder 아닌 상단)
- placeholder는 예시("예: 김철수"), 라벨 역할 불가
- 에러는 필드 바로 아래 text-red-500 text-sm mt-1
```

### 배지 (Badge) — 3종만 사용
```
Primary: bg-slate-100 text-slate-700 / dark:bg-slate-700 dark:text-slate-200
Neutral: bg-slate-50 text-slate-500 / dark:bg-slate-800 dark:text-slate-400
Error:   bg-red-50 text-red-700 / dark:bg-red-900/30 dark:text-red-400
```

### 모달
```
배경: fixed inset-0 bg-black/30 backdrop-blur-sm z-50
콘텐츠: bg-white rounded-2xl shadow-xl p-6 max-w-md
다크: dark:bg-slate-800
모바일: fixed inset-0 (전체 화면)
```

### 기타 컴포넌트
| 컴포넌트 | 스타일 |
|----------|--------|
| 아바타 | `rounded-full bg-slate-100 text-slate-700 font-semibold` (sm:w-7, md:w-9, lg:w-12) |
| 토스트 | `fixed bottom-6 left-1/2 bg-slate-900 text-white rounded-lg shadow-lg` (3초) |
| 스켈레톤 | `animate-pulse bg-slate-200 rounded-lg` / `dark:bg-slate-700` |
| 아코디언 | `px-3.5 py-2.5 hover:bg-slate-50 active:bg-slate-100` |
| IconButton | `p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600` |
| 알림 점 | `w-2.5 h-2.5 bg-red-500 animate-pulse absolute` |

### 채팅 메시지
```
내 메시지:   bg-slate-900 text-white rounded-2xl rounded-br-sm
             dark: dark:bg-slate-200 dark:text-slate-900
상대 메시지: bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm
             dark: dark:bg-slate-700 dark:text-slate-200
타임스탬프:  text-[10px] text-slate-300
```

---

## 7. 모션 & 인터랙션

> 토큰: `import { motion, press } from '@/lib/design-tokens'`

### Spring 프리셋
| 이름 | stiffness | damping | 용도 |
|------|-----------|---------|------|
| default | 300 | 25 | 일반 전환 |
| gentle | 200 | 20 | 부드러운 등장 |
| bouncy | 400 | 22 | 탭 피드백, 카운터 |
| stiff | 500 | 30 | 빠른 스냅 |

### Duration & Easing
| 이름 | 값 | 용도 |
|------|---|------|
| instant | 100ms | 즉각 피드백 |
| fast | 150ms | 토글, 호버 |
| normal | 200ms | 아코디언, 전환 |
| slow / enter | 300ms | 페이지 전환, 등장 |
| exit | 200ms | 퇴장 |

### 진입 애니메이션
```jsx
// Fade + slide up (기본)
initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}

// Scale in (모달, 팝업)
initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}

// Stagger (리스트) — fast: 0.03s / normal: 0.05s / slow: 0.08s
transition={{ delay: index * 0.05 }}
```

### 프레스 피드백 (whileTap)
| 토큰 | scale | 용도 |
|------|-------|------|
| `press.button` | 0.97 | CTA, secondary 버튼 |
| `press.buttonSm` | 0.9 | 아이콘 전용 버튼 |
| `press.card` | 0.98 | 클릭 가능한 카드 |
| `press.mobileButton` | 0.95 | 모바일 선택지 |
| `press.mobileTab` | 0.92 | 모바일 하단 탭 |
| `press.selectionBounce` | [0.95, 1.04, 1] | 선택 확인 bounce |

### 특수 애니메이션
| 애니메이션 | 설명 |
|-----------|------|
| 정답 파티클 버스트 | 24개 SVG 파티클, 1.2초 |
| StreakBadge 3단계 | 3+: 느린 flame / 5+: 빠른 flame / 10+: pulse+큰 flame |
| IdleMascot | 5종 랜덤 동작, 3-6초 간격 |
| 리액션 버블 | 스케일/로테이션, 2초 fade-out |
| 아코디언 흔들림 | x [0,-4,4,-3,3,-1,1,0], 0.5초 |
| 경품 추첨 슬롯 | 이름 cycling 2.5s → spring bounce |
| 타이머 긴박감 | 5초↓: pulse / 3초↓: shake+강한 pulse |

### 규칙
- 모든 모션 400ms 이하
- `prefers-reduced-motion` 존중 (CSS 0.01ms 강제)
- 장식 모션 금지 — 모든 모션에 목적이 있어야 함
- Lottie 인라인 JSON 금지 → Framer Motion SVG로 대체

---

## 8. 아이콘 (Icons)

> 토큰: `import { icons } from '@/lib/design-tokens'`

- **라이브러리**: lucide-react only
- **금지**: Sparkles, Wand, Stars (AI 느낌), emoji

### 크기 체계
| 토큰 | 크기 | 용도 |
|------|------|------|
| `inline` | 12px | 인라인 텍스트 |
| `accordion` | 14px | 아코디언 헤더 |
| `button` | 16px | 버튼 내부 |
| `header` | 18px | 헤더 액션 |
| `headerLg` | 20px | 큰 헤더 아이콘 |
| `action` | 22px | 모바일 하단 바 |
| `tab` | 24px | 모바일 탭 바 |

- **스트로크**: default(2), active(2), inactive(1.5)
- **색상**: `text-slate-400` (기본), `text-slate-700` (활성) / `dark:text-slate-200`
- **아이콘 옆 텍스트**: 아이콘은 `text-slate-400`, 텍스트는 `text-slate-600` (아이콘은 면적이 커서 무겁게 보임)

### 주요 아이콘 매핑
| 기능 | 아이콘 | 기능 | 아이콘 |
|------|--------|------|--------|
| 객관식 | BarChart3 | 퀴즈 | Trophy |
| O/X | Circle | 워드클라우드 | Cloud |
| Q&A | MessageSquare | 감정 온도계 | Thermometer |
| 찬반 토론 | Swords | 순위 맞추기 | ArrowUpDown |
| 빈칸 채우기 | TextCursorInput | 손들기 | Hand |
| 타이머 | Clock | 발표 모드 | Presentation |
| 리더보드 | Award | CSV 내보내기 | Download |
| 테마 | Sun / Moon / Monitor | 트렌드 | TrendingUp / Down |

### 마스코트 (DoranDoranMascot)
- 말풍선 친구 도란·두런 — 둥근 실루엣, 서로 마주 보는 눈, 두 말풍선의 대화
- 높이: xs(36px) / sm(48px) / md(80px) / lg(120px), 가로:세로 4:3. 쉬는 시간 등은 숫자 크기도 지원.
- 도란(인디고 말풍선)과 두런(slate 말풍선)이 서로 이야기를 듣는 모습. 기존 slate + indigo 팔레트만 사용.
- 표정: happy / waiting / thinking / focus / sad / calm. 정적 SVG로 표현해 타이머와 랜덤 동작을 만들지 않는다.
- 대기·생각 상태의 큰 캐릭터는 발을 고정한 작은 호흡·눈 깜빡임으로 표현한다. 헤더·목록·집중·휴식 상태는 정적이며, 완료 시에는 300ms 진입 전환만 사용.
- `prefers-reduced-motion`에서는 반복 움직임과 크기 전환을 끈다. 도란도란의 핵심 원칙인 의미 있는 피드백과 단순한 화면 구성을 유지한다.
- 앱 아이콘: `public/icon.svg` + 192/512px PNG. 공유 미리보기: `public/og-image.jpg`.

---

## 9. 레이아웃 (Layout)

### Admin 3패널 (Desktop 1024px+)
```
좌측: 28% (min 280px, max 460px) — 질문 관리 + 모드 전환
중앙: flex-1 — 시각화/결과/질문 추가 폼
우측: 28% (min 280px, max 460px) — 참여자/손들기/질문/QR
패널 접기: motion.div width 0 전환
```

### Admin 태블릿 (768~1023px)
```
중앙: flex-1 p-4 (전폭, 패딩 축소)
좌측/우측: 오버레이 드로어 (fixed, w-[340px], max-w-[85vw])
드로어: Framer Motion x: -100%→0 (좌) / x: 100%→0 (우), 0.25s ease
백드롭: bg-black/30 z-40
```

### 학생 모바일 (390x844 기준)
```
전체: min-h-dvh, flex flex-col
상단: 헤더 고정 (shrink-0)
중앙: flex-1 (콘텐츠)
하단: 고정 바 (shrink-0) — 손들기/긴급/질문/채팅 (4열)
```

### 반응형 규칙
- 텍스트 truncate: 좁은 패널에서 잘림 처리
- 패딩 축소: 모바일에서 `p-8` → `p-4`
- 아코디언 기본 접힘: 태블릿 이하에서 공간 절약
- 화면 전체를 채우지 않기: `max-w-4xl mx-auto`

---

## 10. 모바일 (Mobile-First)

> 래퍼런스: 토스, 당근마켓, 카카오톡, Apple HIG
> 토큰: `import { mobile, press } from '@/lib/design-tokens'`

### 모바일 타이포 (vs 데스크탑)
| 용도 | 데스크탑 | 모바일 |
|------|---------|--------|
| 히어로 숫자 | text-3xl~5xl | text-5xl |
| 페이지 제목 | text-xl | text-base~text-lg |
| 본문 | text-sm (14px) | text-[15px]~text-base |
| 채팅 버블 | text-sm | text-[15px] |
| 캡션/시간 | text-[10px] | text-[11px]~text-[13px] |
| 탭바 라벨 | — | text-[11px] |

### 섹션 구분 (border/shadow 대신)
```
방법 1 (토스): bg-slate-50 배경 + bg-white 카드 (border 없음)
방법 2 (당근): 8px 회색 구분선 (h-2 bg-slate-100)
방법 3 (Apple): rounded-2xl 카드 + bg-slate-50 배경

금지: shadow로 섹션 구분, border+shadow 동시 사용
```

### 모바일 컴포넌트 규격
| 컴포넌트 | 높이 | 패딩 | 아이콘 |
|----------|------|------|--------|
| 헤더 | auto (py-3.5) | px-5 | 22px |
| 하단 탭 바 | 56px + safe area | — | 24px |
| 리스트 행 | 48-56px | px-5 py-3.5 | 20px |
| 버튼 (CTA) | 48px+ | px-5 py-3.5 | 18px |
| 학생 하단 버튼 | 56px | — | 22px |

### 모바일 모달
```
모바일 (< 640px): fixed inset-0 (전체 화면), y: 20→0
태블릿+: fixed inset-auto, rounded-2xl shadow-2xl, scale: 0.95→1
```

### CSS 최적화 (index.css)
```css
body { overscroll-behavior-y: contain; }
input, select, textarea { font-size: max(16px, 1em); }
a, button, [role="button"] { touch-action: manipulation; }
button, a { -webkit-tap-highlight-color: transparent; }
```

### 금지 패턴
```
✗ border + shadow 동시 사용
✗ shadow로 섹션 구분
✗ 데스크탑 사이드바를 그대로 모바일에 표시
✗ 햄버거 메뉴 (하단 탭 사용)
✗ hover 전용 UI
✗ text-sm 미만 본문 (iOS 줌 유발)
✗ 44px 미만 터치 타겟
```

---

## 11. 라이브 관전 뷰 (Live Spectator View)

- 경로: `/live?s={sessionId}`, 로그인 불필요, 강제 다크모드
- 레이아웃: `h-dvh bg-slate-900`, LiveHeader + VizRenderer + ReactionOverlay
- 공유: 강사 RightSidebar "전자칠판 링크 복사" 버튼

---

## 12. DM & 채팅 패턴

### 채널 구조
| 채널 | Firebase 경로 |
|------|--------------|
| 공개 채팅 | `sessions/{id}/chat` |
| 운영 채팅 | `sessions/{id}/staffChat` |
| 1:1 DM | `sessions/{id}/dm/{dmId}` |

### 역할 배지 (채팅 내)
```
강사: bg-slate-100 text-slate-900 text-[10px] font-semibold rounded-full px-1.5
스태프: bg-slate-50 text-slate-600 text-[10px] font-semibold rounded-full px-1.5
```

### DM 알림 (StaffDMAlert)
- 위치: `fixed top-3 right-3 z-50`
- 카드: `bg-white rounded-xl border shadow-md p-3.5`

### DM 버블 (DMBubble, 학생용)
- 접힌: `w-12 h-12 rounded-full bg-slate-900 shadow-lg`
- 펼친: `rounded-2xl shadow-xl border max-h-[50vh]`

---

## 13. 접근성 (Accessibility)

### aria 속성
| 속성 | 적용 대상 |
|------|-----------|
| aria-label | 아이콘 전용 버튼, input/textarea |
| role="progressbar" | 참여율 바, 진행 바 |
| role="alert" | 에러 메시지 |
| role="status" | 토스트 |
| role="dialog" + aria-label | 모달 |
| aria-expanded | 아코디언, 팝업 |
| aria-pressed | 토글 버튼 |
| aria-hidden | 장식용 SVG |

### 포커스 & 모션
- `focus-visible:ring-2 focus-visible:ring-offset-2` (키보드 전용)
- `@media (prefers-reduced-motion: reduce)`: 모든 애니메이션 0.01ms 강제

### 대비 기준
- 읽어야 하는 텍스트 최소 `text-slate-500`
- 알림 점 최소 `w-2.5 h-2.5` (10px)
- 헤더 backdrop: `bg-white/90+`

---

## 14. 번들 구조

### Vite manualChunks
| 청크 | 포함 라이브러리 | 크기 (gzip) |
|------|----------------|-------------|
| vendor-react | react, react-dom, react-router-dom | ~17kB |
| vendor-firebase | firebase/app, firebase/database | ~50kB |
| vendor-motion | framer-motion | ~44kB |
| vendor-ui | lucide-react, qrcode.react | ~13kB |
| vendor-dnd | @dnd-kit/core, sortable, utilities | ~15kB |

### 코드 스플리팅 (React.lazy)
라우트 레벨: AdminPage, VotePage
기능 레벨: LeaderboardPage, SessionEndedPage, StatsView, QuestionLibraryView, MoreView
게임: Roulette, Lottery, ClassSummary

---

## 15. 실전 디자인 팁

> 출처: Refactoring UI, Laws of UX, Toss Design

### 타이포
- **Weight+Color로 위계**: 크기만이 아닌 두께+색상 조합 (제목: bold+slate-900, 라벨: medium+slate-500)
- **큰 텍스트는 가볍게, 작은 텍스트는 무겁게**: Display(36px)는 400-500, 캡션(12px)은 500-600
- **Line-height는 크기에 반비례**: 14px→1.7, 24px+→1.2
- **45-75자 줄 길이**: `max-w-prose` 또는 `max-w-2xl`

### 레이아웃
- **많은 여백에서 시작**: p-8 gap-6으로 시작 → 축소. 부족한 여백보다 과한 여백이 나음
- **화면 전체를 채우지 않기**: `max-w-4xl mx-auto`. 여백 = 자신감
- **빈 화면은 온보딩**: 일러스트 + CTA ("첫 질문을 만들어보세요!")

### 색상 & 깊이
- **회색에 색조 섞기**: 순수 gray 대신 slate 사용
- **섹션 배경 교차**: `bg-white` ↔ `bg-slate-50` → 보더 없이 구분
- **그림자로 들어올림**: 클릭 가능 카드는 `shadow-sm hover:shadow-md`
- **보더를 줄여라**: 여백 or 배경색 대비로 구분. 모든 선은 주의력 세금

### 데이터 표시
- **라벨은 작게, 값은 크게**: "참여자" xs+slate-500 / "24" 2xl+bold+slate-900
- **바 차트 > 파이 차트**: 길이 비교가 각도 비교보다 정확
- **실시간 데이터는 애니메이트**: 숫자 변경 시 spring 카운터

### UX 법칙
| 법칙 | DoranDoran 적용 |
|------|-------------|
| Fitts's Law | 투표 버튼은 thumb zone에, 크게(48px+) |
| Hick's Law | 학생 화면: 질문 + 선택지만. 부가 기능 숨기기 |
| Miller's Law | 선택지 4-6개, 대시보드 지표 3-4개 그룹 |
| Jakob's Law | 하단바는 iOS 탭바 패턴, 모달은 ESC로 닫기 |

---

## 16. 디자인 레퍼런스

| 회사 | 핵심 교훈 |
|------|----------|
| Apple | 44pt 터치 타겟, Liquid Glass — 투명 레이어는 핵심 UI에만 |
| Linear | 색을 줄여라. 변화를 눈치채지 못하면 성공 |
| Notion | 콘텐츠가 인터페이스다. 장식 요소 0 |
| Toss | OKLCH 색공간, UX 라이팅이 CTR 좌우, 큰 제목+넉넉한 여백 |
| Vercel | 타이포+여백만으로 충분. 악센트 색상 거의 0 |
| Stripe | 프로그레시브 디스클로저 3단계, 카드 <100ms 렌더 |
| 당근마켓 | FAB(+), 스와이프 액션, 8px 구분선 |
| 카카오톡 | 배경색 버블, 바텀 시트 |
| Kahoot | 게이미피케이션, 카운트다운, 실시간 결과 |
| shadcn/ui | Radix 기반, 복사 가능한 코드 |

---

## 17. 디자인 철학 & 원칙 (공개 레퍼런스)

> 아래 원칙들은 모두 공개적으로 공유된 디자인 철학입니다.
> 각 원칙에 DoranDoran 프로젝트 적용 방법을 함께 기록합니다.

### Dieter Rams — 10 Principles of Good Design
> 출처: vitsoe.com/about/good-design (Braun 수석 디자이너, 1970s~)
> 핵심 철학: "Less, but better" (Weniger, aber besser)

| # | 원칙 | DoranDoran 적용 |
|---|------|----------|
| 1 | **혁신적이다** (Innovative) | 실시간 교육 참여 — 기존 클릭커 대비 시각화+게이미피케이션 |
| 2 | **유용하다** (Useful) | 모든 기능은 수업 참여율 향상이라는 목적에 복무 |
| 3 | **아름답다** (Aesthetic) | 절제된 slate 팔레트, 타이포 위계, 의도적 여백 |
| 4 | **이해하기 쉽다** (Understandable) | 학생이 1초 안에 뭘 해야 하는지 파악 |
| 5 | **겸손하다** (Unobtrusive) | UI는 콘텐츠(질문/투표)를 위한 배경 — 자기주장 X |
| 6 | **정직하다** (Honest) | 로딩은 스켈레톤으로, 에러는 명확히, 가짜 진행바 X |
| 7 | **오래 간다** (Long-lasting) | 유행 디자인(글래스모피즘 등) 배제, 시간이 지나도 촌스럽지 않은 UI |
| 8 | **디테일까지 일관적이다** (Thorough) | 모든 값은 design-tokens.js에서 — 매직 넘버 0 |
| 9 | **환경을 생각한다** (Environmentally friendly) | 번들 최적화, 불필요한 리렌더 제거, 300명 동시 사용 효율 |
| 10 | **가능한 한 적게 디자인한다** (As little design as possible) | 이 요소를 빼도 화면이 작동하는가? → 빼라 |

### Jakob Nielsen — 10 Usability Heuristics
> 출처: nngroup.com/articles/ten-usability-heuristics/ (1994, 무료 공개)

| # | 원칙 | DoranDoran 적용 |
|---|------|----------|
| 1 | **시스템 상태 가시성** | 투표 후 체크 애니메이션, 연결 상태 표시, 타이머 카운트다운 |
| 2 | **현실 세계와 일치** | 한국어 라벨 필수, 학생에게 익숙한 용어 사용 |
| 3 | **사용자 통제와 자유** | ESC로 모달 닫기, 투표 변경 가능, 뒤로가기 지원 |
| 4 | **일관성과 표준** | iOS 탭바 패턴, 플랫폼 컨벤션 준수, 토큰 기반 일관성 |
| 5 | **에러 방지** | 닉네임 2-10자 제한, 타이머 종료 시 투표 잠금 |
| 6 | **기억보다 인식** | 선택지는 항상 보이게, 아이콘+텍스트 라벨 병행 |
| 7 | **유연성과 효율** | 강사: 원클릭 질문 전환, 키보드 단축키 |
| 8 | **미학과 미니멀 디자인** | 화면당 2-3색, 장식 0, 콘텐츠 중심 |
| 9 | **에러 인식/진단/복구** | 에러 메시지 text-red-500, 명확한 안내, 재시도 버튼 |
| 10 | **도움말과 문서** | 빈 상태에 마스코트+도움말, 온보딩 힌트 |

### Laws of UX — Jon Yablonski
> 출처: lawsofux.com (무료 공개, CC 라이선스)

**이미 적용 중 (§15 참조):** Fitts's Law, Hick's Law, Miller's Law, Jakob's Law

**추가 적용 원칙:**

| 법칙 | 설명 | DoranDoran 적용 |
|------|------|----------|
| **Doherty Threshold** | 응답 400ms 이내면 사용자가 몰입 상태 유지 | 모든 모션 400ms 이하, 투표 즉각 피드백 |
| **Goal-Gradient Effect** | 목표에 가까울수록 동기가 증가 | 퀴즈 진행바, 타이머 5초↓ 펄스, 리더보드 순위 변동 |
| **Peak-End Rule** | 경험의 절정과 끝 순간이 전체 인상을 결정 | 정답 파티클 버스트(절정), 시상식(끝) — 강렬하게 |
| **Von Restorff Effect** | 눈에 띄는 것이 기억됨 | CTA 하나만 강조 (bg-slate-900), 나머지는 ghost |
| **Zeigarnik Effect** | 미완료 작업이 더 기억됨 | "결과 기다리는 중" 대기 화면 — 완결 욕구 자극 |
| **Aesthetic-Usability** | 아름다운 디자인이 더 사용하기 쉽다고 느낌 | 절제된 미학 → 신뢰감 → "이거 좀 쿨하다" |
| **Postel's Law** | 입력에 관대, 출력에 엄격 | 닉네임 공백 허용, 하지만 표시는 trim |
| **Tesler's Law** | 복잡성은 줄일 수 없고 옮길 수만 있음 | 복잡성은 시스템이 흡수 — 학생에게 선택지만 제시 |
| **Parkinson's Law** | 주어진 시간만큼 작업이 늘어남 | 타이머 설정으로 답변 시간 제한 → 집중도 향상 |

### Edward Tufte — 데이터 시각화 원칙
> 출처: "The Visual Display of Quantitative Information" (1983)

| 원칙 | 설명 | DoranDoran 적용 |
|------|------|----------|
| **Data-Ink Ratio 최대화** | 잉크의 대부분이 데이터를 표현해야 함 | 바 차트: 그리드 라인 최소, 배경색 없음, 데이터 바만 강조 |
| **Chartjunk 제거** | 불필요한 장식 요소 제거 | 3D 효과, 그라데이션 배경, 장식 아이콘 없는 차트 |
| **Small Multiples** | 같은 형식의 작은 차트 반복으로 비교 | 질문별 결과 카드 — 동일 레이아웃 반복 |
| **Lie Factor = 0** | 데이터 왜곡 없는 정직한 시각화 | 바 차트 y축 0부터 시작, 비례 정확 |

### Toss 디자인 원칙
> 출처: toss.tech, Simplicity 컨퍼런스 (2021~2024, 공개 발표)

| 원칙 | 설명 | DoranDoran 적용 |
|------|------|----------|
| **1 Thing, 1 Page** | 한 화면에 하나의 목적만 | 학생 화면: 질문+선택지만. 부가 기능 하단바에 숨기기 |
| **Easy to Answer** | 3초 안에 답할 수 있는 질문 | 투표 선택지 4-6개, 원탭으로 완료 |
| **Value First, Cost Later** | 가치를 먼저 보여주고, 비용(입력)은 나중에 | 세션 참여 → 결과 먼저 보여주고, 닉네임 입력은 최소화 |
| **Minimum Features** | 핵심 기능만 — 있으면 좋겠다 ≠ 있어야 한다 | 기능 추가 전 "이거 빼도 수업이 되는가?" 테스트 |
| **Clear CTA** | 가장 중요한 행동이 즉시 보여야 함 | 한 화면에 Primary 버튼 하나만. bg-slate-900 |
| **UX Writing = CTR** | 버튼 문구가 전환율을 좌우 | "제출" → "답변 보내기", "확인" → "결과 보기" |

### Don Norman — 감성 디자인 3단계
> 출처: "Emotional Design" (2004), "The Design of Everyday Things" (1988)

| 단계 | 설명 | DoranDoran 적용 |
|------|------|----------|
| **Visceral (본능)** | 첫인상 — 보자마자 느끼는 감정 | 깔끔한 레이아웃, 마스코트, 부드러운 진입 애니메이션 |
| **Behavioral (행동)** | 사용 중 — 기능성, 이해도, 물리적 느낌 | press feedback(쫀득한 터치), 즉각 응답, 직관적 플로우 |
| **Reflective (성찰)** | 사용 후 — 자부심, 의미, 기억 | "이거 좀 쿨하다" → 친구에게 보여주고 싶은 UI, 시상식 경험 |

### Steve Krug — "Don't Make Me Think"
> 출처: "Don't Make Me Think" (2000, 3rd edition 2014)

| 원칙 | DoranDoran 적용 |
|------|----------|
| **화면을 보자마자 자명해야 한다** | 학생이 1초 안에 "아, 여기 누르면 되는구나" |
| **클릭 수가 아니라 클릭당 사고량을 줄여라** | 3클릭이라도 매 클릭이 자명하면 OK |
| **절반을 버려라, 그리고 나머지의 절반도** | 텍스트, 장식, 부가기능 — 빼도 되면 뺀다 |
| **사용성 테스트는 거창할 필요 없다** | Playwright 자동 순회 = 저비용 지속 점검 |

### Gestalt 원칙 (시지각 심리학)
> 출처: 베르트하이머, 코프카, 쾰러 (1920s, 학술 공개 지식)

| 원칙 | 설명 | DoranDoran 적용 |
|------|------|----------|
| **근접성 (Proximity)** | 가까운 것은 그룹으로 인식 | 그룹 간격 > 그룹 내 간격. 관련 요소는 gap-2, 섹션은 gap-6 |
| **유사성 (Similarity)** | 비슷한 것은 같은 그룹으로 인식 | 같은 역할 = 같은 스타일. 모든 CTA는 bg-slate-900 |
| **폐합 (Closure)** | 불완전한 형태도 완성체로 인식 | 원형 타이머 링 — 완전한 원이 아닌 진행률로 인식 |
| **연속성 (Continuity)** | 시선은 매끄러운 경로를 따름 | 리더보드 순위 — 위에서 아래로 자연스러운 시선 흐름 |
| **공동 운명 (Common Fate)** | 같이 움직이는 것은 그룹 | 리액션 버블 — 같은 방향으로 떠오르는 같은 유형 |
| **전경/배경 (Figure/Ground)** | 전경이 배경과 분리되어 인식 | 모달: bg-black/30 backdrop → 콘텐츠가 전경으로 떠오름 |

## 발표·관객 화면

슬라이드 본문은 전체 캔버스에서 비율을 유지한다. 중복 제목/페이지 버튼을 겹쳐 놓지 않는다. 발표자는 ←/→/Space/F와 하단 제어를 사용하며, 참여 활동 후 원래 슬라이드 위치로 돌아간다. 관객에게는 조작 버튼을 제공하지 않는다. 이미지 전환은 준비된 이미지끼리 180ms 교차 전환하고, 현재+인접 이미지 최대 4개만 캐시한다.

참여 칭찬은 실제 3문항 참여를 근거로 최대 1분에 한 번 4초만 표시한다. 학습 능력을 추정한 순위나 내용 위의 큰 폭죽을 추가하지 않는다.
