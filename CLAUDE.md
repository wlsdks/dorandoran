# DoranDoran - Project Guidelines

## What is DoranDoran?
Real-time classroom engagement platform. Instructors create sessions, students join via QR/code and participate in polls, quizzes, word clouds, Q&A. Post-class assignment submission with AI judging (7 Gemini-powered judges). Korean market (한국어 UI).

## Tech Stack
- React 19 + Vite 7 + Tailwind CSS v4 + Firebase Realtime DB + Framer Motion
- Icons: lucide-react (NO emoji icons)
- Animations: lottie-react + Framer Motion (sparingly, high-impact only)
  - Lottie JSON: create inline (simple shapes/motions) or fetch from LottieFiles CDN
  - If download fails: use Framer Motion CSS animation as fallback, never block on missing Lottie
- Fonts: Pretendard (Korean) + Inter (Latin/numbers)

## Architecture: Bulletproof React (MIT, open-source pattern)
```
src/
  app/routes/       → Thin page components (compose features, no business logic)
  components/ui/    → Shared UI primitives (Button, Card, Modal). NO business logic.
  features/         → Business features (17개), each with api/ + components/ subdirs
    session/        → useSession, ConnectionBanner
    participants/   → useParticipants, ParticipantList, JoinToast
    voting/         → useVotes (9 voter 유형 — Choice/OX/Quiz/Wordcloud/Scale/Debate/Ranking/FillBlank/Check)
    questions/      → useUrgentQuestions, AIQuestionGenerator
    class-questions/→ ClassQAPanel, ClassQABoard, QARanking (학생 Q&A)
    hand-raise/     → useHandRaises, HandRaiseList
    visualization/  → BarChart, OXBattle, WordCloud, QACards, ImageSlidePresenter,
                      WebEmbedPresenter(웹페이지 슬라이드), VizRenderer
    games/          → Lottery, ScratchCard(즉석복권), RandomPicker, BreakTimer, JoinShow
                      + useGameMirror(전자칠판 동기화), DrawDisplayToggle(이름/사번 보기)
    timer/          → useTimer, TimerRing, TimerCountdown (서버 시간 동기화)
    reactions/      → useReactions, ReactionBar, ReactionOverlay, ChatBubbleOverlay
    quiz/           → useScores, QuizResult, Leaderboard, useSpeedQuiz
    chat/           → 공개 채팅 (강사↔학생) — D2 cut 검토 중
    dm/             → DMBubble, StaffDMAlert (스태프-학생 1:1)
    course/         → useCourses, CourseStaffModal (강의 그룹)
    ai-judge/       → useLiveJudging, AiJudgePanel, AiJudgeViz, LiveResultHero (7판사)
    assignments/    → SubmissionForm, SubmissionsView, SubmissionContentPreview, JudgingPanel, AwardsCeremony
    report/         → ClassInsightCard, LearningReportCard, useEngagementData
  hooks/            → Cross-feature shared hooks only
  lib/              → firebase.js, design-tokens.js, utils
                      modes.js(특수 모드 단일 출처), question-types.js(질문 유형 단일 출처)
                      embed.js(웹 임베드 정책), roster.js·scratch.js(추첨 전용 모드)
  assets/lottie/    → Lottie JSON files
  styles/           → index.css (Tailwind + globals)
```

### Import Rules
- `lib/ → components/ → features/ → app/routes/` (unidirectional only)
- Features NEVER import from other features
- No barrel files (no index.js re-exports) — direct imports only
- Use `@/` path alias (`vite.config.js` resolve alias)

---

## Design System

> 전체 디자인 시스템: `DESIGN_SYSTEM.md` 참조
> 토큰 코드: `src/lib/design-tokens.js` (colors, typography, motion, press, icons, mobile, tw)

### 빠른 참조
- **CTA**: `bg-slate-900` (dark CTA) / `dark:bg-slate-100 dark:text-slate-900`
- **악센트**: indigo — 차트 바, 포커스 링, 진행바 전용
- **색상 규칙**: 화면당 최대 2-3색 (slate + indigo + 기능색)
- **폰트**: Pretendard + Inter, 크기 12~36px, weight 400~700
- **간격**: 4px 기본 단위, 카드 p-5, 모달 p-6
- **모션**: spring(300/25), entry y:12→0, stagger 0.05s, 모두 400ms 이하
- **터치**: 모바일 최소 48px

### Component Patterns (Tailwind — 이것을 그대로 사용)
```
Button Primary:   bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-5 rounded-lg transition-colors
                  dark: dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900
Button Secondary: bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-5 rounded-lg border border-slate-200
Button Ghost:     hover:bg-slate-100 text-slate-600 font-medium py-2.5 px-5 rounded-lg
Button Danger:    bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-5 rounded-lg

Input:            w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500

Card:             bg-white rounded-xl shadow-sm border border-slate-100 p-5
Badge:            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700
Modal:            fixed inset-0 bg-black/30 backdrop-blur-sm z-50 → bg-white rounded-2xl shadow-xl p-6
Toast:            fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg
```

### Key UX Flows

**Student Journey:**
```
QR/Link → JoinPage (닉네임 입력, 아바타 미리보기) → VotePage/WaitingPage 전환
  VotePage: 질문 카드 상단 + 투표 버튼 하단(thumb zone) + 하단바(손들기/질문)
  투표 후: VoteConfirm (체크 애니메이션) → "결과 기다리는 중" 상태
  WaitingPage: 부드러운 대기 애니메이션 + 참여자 수 + 세션코드
```

**Quiz Flow (Phase 8):**
```
강사: 퀴즈 질문 활성화 (타이머 시작)
학생: 답변 선택 → 타이머 종료 → 정답 공개 화면 (맞음/틀림 + 획득 점수)
강사: "정답 공개" 버튼 → 정답 하이라이트 + 분포 표시 → "리더보드" 버튼
전체: 리더보드 (상위 5명 포디움, 순위 변동 애니메이션)
점수: 정답 기본 100점 + 속도 보너스 최대 50점 (빠를수록 높음)
```

**Timer Flow (Phase 6):**
```
강사: 질문별 타이머 설정 (15/30/60/커스텀) → 질문 활성화 시 자동 시작
학생: 원형 링 카운트다운 (초록→노랑→빨강) → 5초 이하 펄스 → 0초 투표 잠금
Firebase: timerEnd timestamp로 동기화 (서버 시간 기준, 클라이언트 차이 방지)
```

**Reactions Flow (Phase 7):**
```
학생: 하단 리액션 바 (👍🔥❤️😂👏 → lucide 아이콘) → 탭 시 쿨다운 3초
강사/프레젠터: 화면 위로 떠오르는 버블 애니메이션 (2초 fade-out) + 실시간 카운트
Rate limit: 학생당 3초에 1회, Firebase에 최근 50개만 유지
```

**Assignment Flow (사후 과제):**
```
강사: 과제 등록 (클래스/차수 선택, AI 심사 토글) → 제출 링크 공유
학생: 랜딩 (제출하기/조회) → 폼 (이름+PIN+URL/파일/PRD/설명) → 제출 완료
학생 재방문: 이름+PIN으로 조회 → 수정/취소
강사: 마감 → AI 심사 시작 (7명 × N건 순차) → 시상
학생: 이름+PIN으로 결과 확인 (점수/합격/심사평) + 시상 결과 보기
Firebase: assignments/{id}/submissions, results, awards
```

### User Personas (작업 시 반드시 해당 관점에서 생각하기)

**학생 (Student)** — 모바일 또는 노트북 웹브라우저로 수업 중 참여
- 20대 대학생, 폰(한 손) 또는 노트북 브라우저로 접속 → 둘 다 쾌적해야 함
- 수업 중이라 집중 시간 짧음 → 화면 보자마자 뭘 해야 하는지 1초 안에 파악
- 투표 눌렀는데 반응 없으면 불안 → 즉각적 피드백 필수
- 퀴즈에서 순위 올라가면 은근 경쟁심 → 리더보드 보는 재미
- Wi-Fi 불안정할 수 있음 → 연결 상태 표시 중요
- "이거 좀 쿨하다" 느낌 → 친구한테 보여주고 싶은 UI

**강사 (Instructor)** — 노트북/태블릿으로 수업 진행
- 30~50대, 기술에 익숙하지 않을 수 있음 → 직관적이어야 함
- 수업 중 학생들 앞에서 사용 → 헤매면 안 됨, 자신감 있게 조작 가능해야
- 프로젝터에 띄울 때 → 글자 크고, 깔끔하고, 전문적으로 보여야
- 질문 전환이 빨라야 함 → 원클릭으로 다음 질문, 결과 보기
- 학생 참여 현황 한눈에 → 몇 명 참여했는지, 손든 학생 누구인지
- 수업 후 결과 확인 → 어떤 질문에서 학생들이 어려워했는지

**프레젠터 화면 (관객이 보는 화면)** — 프로젝터/대형 화면
- 뒷자리에서도 잘 보여야 함 → 큰 글자, 높은 대비
- 시각적으로 인상적이어야 → 실시간으로 막대 올라가는 거, 워드클라우드 형성되는 거
- 깔끔하고 프로페셔널 → 학교/기업 어디서든 어색하지 않은 UI

---

## Anti-AI Aesthetic (CRITICAL)

> 상세: `DESIGN_SYSTEM.md` §1 참조

| AI 기본값 (금지) | Human 디자인 (우리) |
|-----------------|-------------------|
| `bg-indigo-600` CTA | `bg-slate-900` dark CTA |
| 컬러 원형 아이콘 배경 | bare lucide 아이콘 |
| `border-l-3` 악센트 바 | `ring-1` or bg change |
| 5색 배지/선택지 | slate 모노크로매틱 |
| `bg-indigo-50` tint 배경 | `bg-white` or `bg-slate-50` |
| Sparkles/Stars 아이콘 | 말풍선 친구 마스코트 (DoranDoranMascot) |

**체크**: 화면당 2-3색 이하 / 장식 색상 0 / 장식 모션 0 / 한국어 라벨 필수

---

## Code Quality
- JSX only (no TypeScript)
- Components under 200 lines → extract sub-components
- Hooks return `{ data, loading, error, actions }` pattern
- Cleanup Firebase listeners in useEffect
- React.memo for heavy components, useCallback for handlers-as-props
- All user-facing text in Korean
- Debounce rapid Firebase writes

## Do NOT
- Change Firebase DB structure without updating database.rules.json
- Change routing without careful consideration
- Add features without clear justification (proven effective or genuinely needed)
- Commit broken builds
- Use random colors/hex outside design tokens
