# Contributing to DoranDoran

DoranDoran에 관심 가져주셔서 감사합니다. 이 가이드는 DoranDoran에 코드/문서/아이디어를 기여하는 방법을 정리합니다.

## 시작하기

[README](./README.md)의 5단계 setup 가이드를 먼저 따라가서 로컬에서 동작을 확인해주세요. Firebase 프로젝트와 `.env`가 채워져 있어야 합니다.

## 이슈 등록 전 체크

- 비슷한 이슈가 이미 등록되어 있는지 저장소의 Issues 탭에서 검색
- 버그면 **재현 가능한 최소 단계**를 적어주세요 (브라우저, OS, 단계, 기대 vs 실제)
- 기능 제안은 **사용자 시나리오** 우선 — 어떤 강사/학생이, 어떤 상황에서, 무엇을 못 해서 답답한지

## PR 절차

1. **이슈 먼저** — 큰 변경은 이슈를 먼저 열어 방향을 합의해주세요. 작은 fix는 바로 PR도 OK
2. **Fork & 브랜치** — `feat/...`, `fix/...`, `docs/...`, `refactor/...` 같은 명확한 prefix
3. **테스트** — `npm run check` (lint + build) 통과 필수. e2e가 영향받는 영역이면 `tests/e2e/`도 실행
4. **커밋 메시지** — Conventional Commits 따라주세요 (예: `fix(votes): 동시 투표 race condition`)
5. **PR 본문** — 변경 이유 / 변경 내용 / 검증 방법 / 스크린샷(UI 변경 시)

## 코드 스타일

[CLAUDE.md](./CLAUDE.md)의 "DoranDoran - Project Guidelines" 섹션을 따릅니다 — Bulletproof React 구조, 단방향 import, JSX(no TS), 한국어 UI, lucide 아이콘만, 컴포넌트 200줄 가이드라인.

[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)의 디자인 토큰을 사용해주세요. 임의 hex/색상은 PR에서 지적됩니다.

## 우선 환영하는 영역

- **Bug fix** — 버그 재현 단계 명확하면 적극 환영
- **A11y** — keyboard nav, screen reader, color contrast 개선
- **i18n** — 영어/일어 등 다른 언어 지원 (현재 한국어만)
- **테스트** — e2e/단위 테스트 추가 (신뢰도 향상)
- **문서** — README/PRD/setup 가이드 개선
- **새 question type** — 기존 9개 voter 외에 추가 (단, 이슈로 의도 합의 후)

## 기대하지 않는 영역 (현재 단계)

- **대규모 아키텍처 변경** — 메인테이너와 사전 합의 필요
- **상업적 요구사항** — DoranDoran은 학습/강의 도구이지 SaaS가 아님
- **새 의존성 추가** — 기존 stack(React 19/Vite/Tailwind/Firebase/Framer Motion)으로 안 되는지 먼저

## Code of Conduct

[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)를 준수해주세요.

## 보안 이슈

보안 취약점은 공개 이슈로 올리지 말고 [SECURITY.md](./SECURITY.md)의 절차를 따라주세요.

## License

이 프로젝트에 기여하면 [MIT License](./LICENSE) 하에 배포됨에 동의하는 것으로 간주됩니다.
