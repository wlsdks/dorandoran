# DoranDoran PRD (Product Requirements Document)

> 실시간 강의 참여 플랫폼. 강사와 학생의 상호작용이 핵심.
> 이 문서는 매 개선 사이클마다 업데이트됨. (2026-03-21 기준 최신 업데이트)

---

## 1. 제품 개요

### 1.1 핵심 가치
- **실시간 강의 참여**: 강사가 질문을 출제하고, 학생이 모바일/노트북으로 즉시 참여
- **다양한 질문 유형**: 객관식, 퀴즈, O/X, 워드클라우드, Q&A, 감정 온도계, 찬반 토론, 순위 맞추기, 빈칸 채우기 (9종)
- **게이미피케이션**: 퀴즈 점수, 리더보드, 업적, 팀 대항전, 스피드 퀴즈로 학습 동기 부여
- **수업 관리**: 세션 생성/복제/삭제, 질문 보관함, 강의 템플릿, CSV 내보내기, 수업 기록 통계

### 1.2 기술 스택
- **프론트엔드**: React 19 + Vite 7 + Tailwind CSS v4 + Framer Motion
- **백엔드**: Firebase Realtime Database (서버리스)
- **아이콘**: lucide-react
- **폰트**: Pretendard (한국어) + Inter (영문/숫자)
- **드래그**: @dnd-kit (순위 맞추기 드래그&드롭)
- **QR**: qrcode.react

---

## 2. 사용자 유형

| 유형 | 접속 방식 | 주요 행동 |
|------|-----------|-----------|
| 강사 (Admin) | 로그인 (ID/PW) | 세션 생성, 질문 진행, 결과 확인, 수업 관리 |
| 스태프 (Staff) | 로그인 (ID/PW) | 질문 답변, 손들기 도움, 채팅 참여. 모바일 최적화 4탭 UI |
| 학생 (Student) | QR/링크 (게스트) | 닉네임 입력 후 참여, 투표, 질문, 채팅 |
| 마스터 관리자 | 로그인 | 강사 계정 승인/관리 |

---

## 3. 기능 목록

### 3.1 인증 & 계정

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 강사 로그인 | 강사 | 완료 | ID/PW 로그인 (SHA-256 해시) |
| 강사 회원가입 | 강사 | 완료 | 마스터 승인 필요 |
| 데모 로그인 | 강사 | 완료 | 체험용 임시 접속 |
| 학생 게스트 접속 | 학생 | 완료 | QR/링크로 닉네임 입력만으로 참여 |
| 마스터 승인 | 마스터 | 완료 | 신규 강사 계정 승인/거절 |

### 3.2 클래스 & 세션 관리

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 클래스(강의) 그룹 | 강사 | 완료 | courseName으로 세션 그룹화 |
| 세션 생성 | 강사 | 완료 | 클래스 내 차수별 세션 생성 |
| 세션 복제 | 강사 | 완료 | 세션 목록에서 원클릭 복제(Copy 아이콘) + 생성 모달 내 이전 차수 복제. 질문 전체 복사(투표/런타임 데이터 제거), 같은 강의 다음 차수 자동 배정, 즉시 세션 입장 |
| 세션 삭제 | 강사 | 완료 | 진행 중 세션 삭제 불가. 확인 모달 후 Firebase 전체 삭제 + 즉시 UI 반영 |
| 세션 검색/필터 | 강사 | 완료 | 강의명 검색 + 상태 필터(전체/진행 중/질문 받기/완료/세팅중). 3개 이상 세션일 때 표시 |
| 세션 상태 흐름 | 강사 | 완료 | 세팅중(setting) → 진행중(active) → 질문 받기(reviewing) → 완료(ended) |
| 세션 종료 2단계 | 양쪽 | 완료 | active→reviewing(14일 자동 종료)→ended. 강사: "질문 받기 중" 배지+남은 일수. 학생: 하단 바 활성 유지 |
| 세션 목록 대시보드 | 강사 | 완료 | 클래스별 그룹, 참여율 통계, 상태 배지 |
| 수업 기록 탭 | 강사 | 완료 | 통계 개요(총 클래스/참여자/평균 참여율), 강의별 참여율 추이(트렌드 화살표+미니 SVG 차트), 어려웠던 질문(정답률 하위 5개), 최근 질문 목록 |
| 완료된 세션 열람 | 강사 | 완료 | 읽기전용 결과 확인 |

### 3.3 질문 유형 (17종)

> 단일 출처: `src/lib/question-types.js`. 폼·목록·보관함·리포트가 모두 이 목록에서 읽는다.

| 유형 | 코드명 | 설명 |
|------|--------|------|
| 객관식 | choice | 2~5개 선택지, 정답 설정 |
| 퀴즈 | quiz | 객관식 + 점수 + 속도 보너스 + 이벤트/베팅 |
| O/X | ox | 참/거짓 이진 선택 |
| 워드클라우드 | wordcloud | 자유 텍스트 → 빈도 시각화 |
| Q&A | qna | 자유 텍스트 → 카드 그리드 |
| 주관식 | subjective | 서술형 + 모범답안 기준 AI 채점 |
| 감정 온도계 | scale | 0~100 슬라이더 → 평균/히스토그램 |
| 찬반 토론 | debate | 찬반 선택 + 한 줄 의견 |
| 순위 맞추기 | ranking | 3~6개 드래그 정렬 → 위치별 정답률 |
| 빈칸 채우기 | fillinblank | 제목의 `___`를 채우는 텍스트 입력 |
| 단답식 | shortAnswer | 짧은 정답 + 허용 답변 최대 5개 |
| 실습 체크 | check | 실습 완료 체크 → 진행률 |
| 이미지 | imageSlide | 최대 10장 슬라이드. 강사가 넘기면 학생·전자칠판 동기화 |
| 웹페이지 | webEmbed | 발표 화면 안에서 외부 페이지 열기 (§3.10 참조) |
| 미스터리 박스 | mysteryBox | 후보 목록에서 정답 맞히기 + 정답자 랭킹 |
| 힌트 퀴즈 | hintQuiz | 힌트를 하나씩 공개하며 정답 맞히기 |
| AI 심사 | aiJudge | 학생 제출물을 AI 심사위원이 평가 |

### 3.4 질문 관리

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 질문 추가/편집 | 강사 | 완료 | 9종 유형 모두 지원. 중앙 패널에서 폼 열기 |
| 질문 활성화/중지 | 강사 | 완료 | 빠른 진행 카드로 원클릭 |
| 질문 복제/삭제 | 강사 | 완료 | 기존 질문 관리 |
| 질문 순서 변경 | 강사 | 완료 | 위/아래 화살표, 강의 템플릿 편집에서도 동일 |
| 정답 설정 | 강사 | 완료 | 객관식/퀴즈/OX 모두 정답 필수 |
| 정답 표시 | 강사 | 완료 | 완료 세션 자동 공개, 진행 중은 수동 |
| 질문 보관함 | 강사 | 완료 | 자주 쓰는 질문 저장/재사용. 대시보드 "질문 보관함" 탭. 검색, 유형별 필터 |
| 질문 템플릿 팩 | 강사 | 완료 | 사전 제작 5종(아이스브레이킹/수업 평가/팀빌딩/CS 기초 퀴즈/비판적 사고). 원클릭 보관함 추가 |
| CSV 내보내기 | 강사 | 완료 | 질문 요약(응답률/정답률/분포) + 참여자별 응답(답변/점수/티켓). BOM 포함 Excel 호환 |

### 3.5 투표 & 학생 참여

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 실시간 투표 | 학생 | 완료 | 활성화된 질문에 즉시 참여 |
| 투표 확인 애니메이션 | 학생 | 완료 | 체크 SVG 애니메이션 + 선택한 답변 표시 |
| 학생 실시간 결과 | 학생 | 완료 | 투표 후 객관식/OX 실시간 분포 미니 차트 (퀴즈 제외) |
| 질문 진행 표시 | 학생 | 완료 | "질문 1/3" 텍스트 + 진행 바 |
| 포인트 베팅 | 양쪽 | 완료 | 퀴즈에 1x(안전)/2x(자신,-30점)/3x(올인,-60점) 베팅. 총점 최소 0 |

### 3.6 시각화 & 결과

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 바 차트 | 강사 | 완료 | 인디고 그라데이션, 정답 하이라이트, max-w-xl |
| O/X 배틀 | 강사 | 완료 | 분할 비율 표시, 정답 체크 |
| 워드클라우드 시각화 | 강사 | 완료 | 크기 분포, 페이드인 |
| Q&A 카드 | 강사 | 완료 | 카드 그리드, 스크롤 |
| 감정 온도계 차트 | 강사 | 완료 | 평균 히어로 숫자 + 위치 바 + 10구간 히스토그램 + 통계 |
| 찬반 토론 차트 | 강사 | 완료 | 퍼센트 VS 히어로 + 비율 바 + 의견 스트림(필터) |
| 순위 맞추기 차트 | 강사 | 완료 | 평균 정확도 % + 위치별 정답률 바 + 정답 순서 레퍼런스 |
| 빈칸 채우기 차트 | 강사 | 완료 | 정답률 % + 답변 빈도 바 차트 + 정답 하이라이트 |
| 발표 모드 | 강사 | 완료 | Fullscreen API 전체화면 + Wake Lock(화면 꺼짐 방지). 시각화만 표시, 접이식 QR 오버레이. 모드 메뉴에서 특수 모드 14종 전환 |
| 라이브 관전 뷰 | 전체 | 완료 | `/live?s=세션코드` 별도 URL. 로그인 불필요, 읽기전용, 강제 다크모드. 실시간 차트+게임+타이머+리액션+참여율 카운트업 애니메이션. 강사 RightSidebar에서 전자칠판 링크 복사 |

### 3.7 퀴즈 & 점수 시스템

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 퀴즈 점수 시스템 | 양쪽 | 완료 | 기본점수(50/100/200/500) + 속도 보너스(최대 50점, 30초 윈도우) |
| 정답 공개 | 강사 | 완료 | 수동 공개 + 완료 세션 자동 |
| 정답 축하 이펙트 | 학생 | 완료 | 24개 슬레이트 파티클 SVG 버스트 (원/사각/다이아몬드), 1.2초 |
| 리더보드 (강사) | 강사 | 완료 | 상위 랭킹 표시 |
| 리더보드 (학생) | 학생 | 완료 | 내 순위 히어로 카드, 연속 정답 배지, 순위 변동 화살표, 8위 밖 스티키 카드 |
| 이벤트 부스터 | 강사 | 완료 | 2배 점수 / 티켓 러시 / 잭팟 라운드 |
| 연승 시각화 | 학생 | 완료 | 3연속+ StreakBadge(Flame+텍스트), 5연속+ 다크 배지+빠른 화염 |
| 스피드 퀴즈 모드 | 양쪽 | 완료 | 퀴즈 2개+ 시 활성화. 자동 10초 타이머 → 정답 공개 → 3.5초 대기 → 다음 문제 → 리더보드. 학생: 진행 배너+콤보 카운터(3연속 1.2배, 5연속 1.5배) |
| 팀 대항전 | 양쪽 | 완료 | 2~4팀 자동 배정(최소 4명). 팀별 총점/평균 바 차트, Crown 선두 팀. 학생에 TeamBadge. 발표 모드 지원 |
| 숨겨진 업적 시스템 | 양쪽 | 완료 | 5종: 첫 정답(Sparkle), 5연속(Flame), 전문항 참여(CheckCheck), 번개 응답/3초(Zap), 만점왕(Crown). 실시간 토스트+요약 카드 표시. 강사 ClassSummary에 달성 통계 |

### 3.8 실시간 상호작용

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 실시간 채팅 | 양쪽 | 완료 | 세션 내 강사-학생 채팅 (팝업 모달). 학생 하단 바에서 접근 |
| 운영 채팅 | 스태프+강사 | 완료 | 스태프+강사 전용 내부 채널. ChatPanel에 [전체 채팅 \| 운영 채팅] 탭. 학생 안 보임 |
| 1:1 DM 도움 요청 | 학생→스태프 | 완료 | 학생 "도움" 버튼 → 메시지 입력 → 모든 스태프에 알림. 먼저 응답한 스태프가 배정. DMBubble로 1:1 대화. 해결 완료 시 종료. 학생끼리 DM 불가 |
| DM 관리 목록 | 스태프 | 완료 | 스태프 우측 패널 "1:1 도움" 아코디언. DM 목록(대기중/진행중) + 인라인 응답 버튼. 수업 질문에서 "1:1 답변" 버튼으로 DM 자동 생성 |
| 손들기 | 학생→강사 | 완료 | 학생이 손들면 강사 우측 패널에 표시 |
| 긴급 질문 | 학생→강사 | 완료 | 익명 긴급 질문 전송 |
| 수업 질문 보드 | 양쪽 | 완료 | 학생 실명 Q&A + 추천(upvote) + 강사 답변 완료/삭제. participantId 기반 추천 토글, 3초 쿨다운. 추천순 정렬 |
| 리액션 | 학생 | 완료 | 5종 아이콘별 고유 색상, 파티클 버스트, 3초 쿨다운 |
| 참여자 목록 | 강사 | 완료 | 접속자 + 답변 횟수(N개 참여) |

### 3.9 게임 & 이벤트

특수 모드 목록의 단일 출처는 `src/lib/modes.js`다(14종). 대시보드·모바일·발표 모드가 모두
여기서 읽으므로 화면마다 켤 수 있는 모드가 갈리지 않는다.

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 추첨 (슬롯) | 강사 | 완료 | 티켓 가중 랜덤. 한 명씩 슬롯 릴로 발표. 전자칠판 동기화 |
| 즉석복권 | 강사 | 완료 | 3x3 판. 칸을 누르면 동전이 긁는다. 한 줄 3칸이 같은 사람이면 당첨 |
| 발표자 뽑기 | 강사 | 완료 | 이름 순환 → 감속 → 발표자 선정. 최근 3명 연속 제외 |
| 접속 현황 | 강사 | 완료 | 입장하는 참여자를 실시간으로 띄우는 화면 |
| 이해도 체크 | 강사 | 완료 | 3단계 선택 → 실시간 분포 |
| 빠른 설문 | 강사 | 완료 | 5점 평점 → 실시간 평균 |
| 그룹 토론 | 강사 | 완료 | 주제 + 타이머 + 메모 공유 |
| 쉬는 시간 | 강사 | 완료 | 프리셋 타이머 + 마스코트 |
| 집중 모드 | 강사 | 완료 | 학생 화면 잠금(손들기만 유지) |
| 타이머 | 강사 | 완료 | 15/30/60/커스텀. 서버 시간 기준 동기화 |
| 학생 타이머 | 학생 | 완료 | 카운트다운 링(녹→황→적), 종료 시 투표 잠금 |

#### 추첨 전용 모드 (drawOnly)

참여자 입장이 없는 행사용. 클래스를 만들 때 켠다.

- 학생이 링크를 열어도 입장이 막힌다(들어온 사람이 그대로 추첨 대상이 되므로)
- 명단은 강사가 직접 넣는다. 이름/사번 칸에 타이핑하거나 엑셀에서 긁어 붙여넣는다
- 붙여넣기는 탭·쉼표·공백 구분을 모두 인식하고, 사번만 있는 목록도 받는다
- 중복 사번은 저장 시 하나만 남긴다
- 명단은 `participants`에 `source: 'manual'`로 저장되어 추첨기·명단 표시·내보내기가 그대로 동작한다

#### 전자칠판 동기화

추첨 3종(슬롯·즉석복권·발표자 뽑기)은 강사 화면에서만 조작하고, 진행 상태를 세션의
`gameState`로 흘려보내 전자칠판(`/live`)이 그대로 따라 그린다. 전자칠판에는 조작 수단이 없다.
두 화면이 각자 추첨을 돌리면 관객이 보는 결과와 강사가 부르는 결과가 갈리기 때문이다.

### 3.10 UI/UX

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 3패널 레이아웃 | 강사 | 완료 | 좌(질문관리)/중(시각화)/우(참여자). 접기/펼치기 애니메이션 |
| 태블릿 반응형 | 강사 | 완료 | 768~1023px 오버레이 드로어. Framer Motion slide-in |
| 아코디언 시스템 | 강사 | 완료 | 문항/모드/팀전/손들기/긴급질문/수업질문/참여자/랭킹 |
| QR코드 공유 | 강사 | 완료 | 우측 패널 + 발표 모드 접이식 오버레이 (추첨 전용 모드에서는 숨김) |
| 웹페이지 슬라이드 | 강사 | 완료 | 발표 화면 안에서 외부 페이지 열기. 임베드를 거부하는 사이트는 새 창으로 안내 |
| 모드 미리보기 | 강사 | 완료 | 클래스 만들 때 `설명 보기`로 모드를 실제로 체험. 세션에 붙지 않아 아무것도 저장되지 않는다 |
| 학생 대기 화면 | 학생 | 완료 | IdleMascot 애니메이션(5종 랜덤 동작), 참여자 수, 순환 팁 메시지 |
| 학생 입장 페이지 | 학생 | 완료 | 강의명 표시, 닉네임 2자+ 유효성, 글자수 카운터, 아바타 미리보기 |
| 수업 요약 카드 | 학생 | 완료 | 세션 종료 시 참여/정답률/총점/순위/연속정답/업적 요약. 성과별 동적 타이틀 |
| 키보드 단축키 | 강사 | 완료 | 좌우(질문 이동), Space(다음), R(정답공개), L(리더보드), Esc(대기) |
| 연결 상태 배너 | 학생 | 완료 | 오프라인 시 경고, 재연결 시 자동 소멸. Firebase .info/connected |
| 세션 경과 시간 | 강사 | 완료 | 헤더에 "N분 경과" 실시간 표시 |
| 학생 알림음 | 학생 | 완료 | 새 질문 시 Web Audio API 2음 차임(C5→E5). 헤더 음소거 토글 |
| 에러 바운더리 | 전체 | 완료 | 라우트+시각화+투표 레벨 세분화, 한국어 복구 UI |
| PWA 매니페스트 | 학생 | 완료 | 홈 화면 추가, 서비스워커, Apple 메타태그 |
| Admin 빈 상태 | 강사 | 완료 | 마스코트 + 단계별 안내 |
| 긴급 질문 모달 | 강사 | 완료 | 클릭→중앙 팝업→확인(삭제)/닫기(읽음). MessageCircle 아이콘 |
| 수업 질문 모달 | 강사 | 완료 | 클릭→팝업→답변완료/닫기. HelpCircle 아이콘, 좋아요 수 |
| 질문 reviewing 알림 | 학생 | 완료 | 강사가 질문 확인 중→학생 "강사가 확인하고 있어요" 배너 |
| 아코디언 흔들림 | 강사 | 완료 | 새 질문/손들기 수신 시 헤더 x축 shake 0.5s |
| 채팅 아바타 UI | 양쪽 | 완료 | KakaoTalk 스타일 아바타+이름+버블+시간 |
| 채팅 스마트 스크롤 | 양쪽 | 완료 | 하단 100px 내→자동 스크롤, 위 스크롤 시 유지 |
| 복사 세션코드 | 학생 | 완료 | 대기 화면 세션코드 터치→클립보드 복사+체크 피드백 |
| 대기 팁 아이콘 | 학생 | 완료 | 순환 팁에 contextual 아이콘 (Zap/Hand/MessageSquare 등) |
| 말풍선 친구 마스코트 | 전체 | 완료 | DoranDoranMascot — 두 말풍선 친구, 상태별 표정, 움직임 줄이기 지원. xs/sm/md/lg 사이즈 |
| 강의명 대기 표시 | 학생 | 완료 | 대기 화면에 현재 강의명 표시 (맞는 수업인지 확인) |
| 자신감 측정기 | 학생 | 완료 | 퀴즈 답변 후 확신 없음/보통/확신 3단계. Firebase에 confidence 저장 |
| 스태프 전용 페이지 | 스태프 | 완료 | 모바일 최적화 4탭(질문/손들기/채팅/참여자). 긴급+수업 질문 통합 |
| 스태프 데모 로그인 | 스태프 | 완료 | 로그인 페이지 "스태프 데모로 둘러보기" 버튼 |
| 본인 질문 하이라이트 | 학생 | 완료 | 수업 질문 패널에서 내 질문 ring+배경+라벨 구분 |
| 채팅 미읽 알림 점 | 강사 | 완료 | 헤더 채팅 버튼에 빨간 알림 점 (패널 닫힌 상태) |
| 감정 온도계 실시간 평균 | 학생 | 완료 | ScaleVoter 제출 후 실시간 평균값+바 표시 |
| 자신감 CSV 내보내기 | 강사 | 완료 | 질문 요약+참여자 응답 CSV에 confidence 데이터 포함 |
| 자신감 복습 힌트 | 학생 | 완료 | 종료 카드에 "확신했지만 틀린 N개 — 복습해보세요!" |
| 손들기 흔들림 아이콘 | 학생 | 완료 | 손 든 상태에서 Hand 아이콘 좌우 흔들림 반복 |
| 투표 확인 overshoot | 학생 | 완료 | VoteConfirm 체크 원 scale 1.15→1 bounce |
| 대기 중 dots 로딩 | 학생 | 완료 | 투표 후 "결과를 기다리는 중" 상태에 3dots 펄스 |
| 리액션 float-up | 학생 | 완료 | 리액션 버튼 탭 시 y:-4 상승 모션 |
| 참여자 수 bounce | 학생 | 완료 | 대기 화면 참여자 수 변경 시 숫자+아이콘 scale bounce |
| 자신감 분포 시각화 | 강사 | 완료 | ConfidenceStats — 퀴즈 결과 아래 확신/보통/낮음 바 |

#### 웹페이지 슬라이드 정책

외부 페이지를 발표 화면에 끼워 넣을 때 지키는 규칙. 구현은 `src/lib/embed.js`.

- 사이트가 `X-Frame-Options`나 CSP `frame-ancestors`로 임베드를 거부하면 **우회하지 않는다.**
  헤더를 벗기는 프록시를 두면 기술적 보호조치를 무력화하는 것이고 해당 사이트 약관 위반이다.
  거부하는 곳은 "새 창에서 열기"로 안내한다(로드 신호가 6초 안에 오지 않으면 거부로 본다).
- `http`/`https`만 허용한다. `javascript:`·`data:`·`file:` 등은 저장 시점과 렌더 시점 양쪽에서 막는다.
- 앱 자신의 주소는 넣을 수 없다. 같은 출처를 `allow-same-origin` sandbox에 넣으면 임베드된
  문서가 앱 내부 저장소·DOM에 접근할 수 있다.
- iframe sandbox에 `allow-top-navigation`을 주지 않는다(임베드된 페이지가 발표 화면을 날릴 수 없게).
- `allow=""`로 카메라·마이크·위치 권한을 넘기지 않는다.
- 학생 폰에는 iframe을 띄우지 않고 "내 폰에서 열기" 링크만 준다.

### 3.11 다크 모드

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 라이트/다크/시스템 테마 | 양쪽 | 완료 | Tailwind CSS v4 @custom-variant dark 클래스 전략 |
| useTheme 훅 | 전체 | 완료 | localStorage 기억, prefers-color-scheme 연동, html.dark 토글 |
| 강사 테마 설정 | 강사 | 완료 | 더보기 탭 "화면 테마" 섹션(Sun/Moon/Monitor 3버튼) |
| 학생 자동 테마 | 학생 | 완료 | 시스템 설정 자동 추종 |
| 다크 팔레트 | 전체 | 완료 | bg-slate-900(배경), bg-slate-800(카드), border-slate-700(테두리), text-slate-100~400(텍스트). CTA 반전(dark:bg-slate-100) |

### 3.12 대시보드 탭

| 탭 | 설명 |
|----|------|
| 내 클래스 | 세션 목록, 클래스별 그룹, 검색/필터, 생성/복제/삭제 |
| 수업 기록 | 통계 개요, 참여율 추이, 어려웠던 질문, 최근 질문 |
| 질문 보관함 | 질문 저장/재사용, 유형 필터, 템플릿 팩 5종 |
| 더보기 | 프로필 편집, 나의 활동 통계, 키보드 단축키, 앱 정보, 테마 설정 |

### 3.13 성능 & 최적화

| 기능 | 상태 | 설명 |
|------|------|------|
| 번들 최적화 | 완료 | React.lazy 코드 스플리팅. 단일 921kB→최대 196kB(79% 감소). Vite manualChunks 5개(react/firebase/framer-motion/lucide+qrcode/dnd-kit) |
| React.memo | 완료 | 14개 컴포넌트 적용 |
| useMemo/useCallback | 완료 | hooks 파생값 메모이제이션, AdminPage 콜백 안정화 |
| 접근성 감사 | 완료 | aria-label, role, aria-expanded, aria-pressed, focus-visible, aria-hidden |
| 컴포넌트 크기 감사 | 완료 | 200줄 초과 분리: AdminPage 594→112줄, QuestionManager 541→155줄 등 12개 파일 추출 |

---

## 4. 사용자 흐름

### 4.1 강사 흐름
```
로그인 → 대시보드 (4탭: 내 클래스/수업 기록/질문 보관함/더보기)
  → 세션 생성 (강의명+차수) → 세션 입장 (3패널: 질문/시각화/참여자)
  → 질문 추가 (9종 유형) → 세션 시작 → 질문 활성화
  → 실시간 결과 확인 + 정답 공개 + 리더보드
  → 게임(룰렛/제비뽑기) + 이벤트(부스터/스피드퀴즈/팀전)
  → 종료(→reviewing, 14일) 또는 완전 종료(→ended)
  → 결과 열람 + CSV 내보내기
```

### 4.2 학생 흐름
```
QR/링크 → 입장 (강의명 표시, 닉네임 입력, 아바타 미리보기)
  → 대기 화면 (IdleMascot, 참여자 수, 팁 메시지)
  → 질문 활성화 → 투표 (유형별 UI)
    - 퀴즈: 베팅 선택 → 답변 → 타이머 종료 → 정답 공개 → 업적 토스트
  → 투표 확인 → 실시간 결과 미니 차트
  → 리더보드 (내 순위, 연승 배지)
  → 세션 종료 → 수업 요약 카드 (참여/정답률/순위/업적)
  → 하단 바: 손들기 / 긴급 질문 / 수업 질문 / 채팅
```

### 4.3 학생 하단 바 구성 (4열)
| 버튼 | 아이콘 | 기능 |
|------|--------|------|
| 손들기 | Hand | 강사에게 손들기 신호 (토글) |
| 긴급 | MessageCircle | 익명 긴급 질문 전송 |
| 질문 | HelpCircle | 수업 질문 보드 (실명 Q&A + 추천) |
| 채팅 | MessageSquare | 실시간 채팅 |

---

## 5. 데이터 구조 (Firebase Realtime DB)

```
sessions/
  {sessionId}/
    status: "setting" | "active" | "reviewing" | "ended"
    courseName, roundNumber, createdAt, startedAt, reviewingUntil
    currentQuestion, currentMode
    adminUid

    questions/
      {questionId}/
        type: "choice" | "ox" | "quiz" | "wordcloud" | "qna" | "scale" | "debate" | "ranking" | "fillinblank"
        title, order, options[], correctAnswer
        points, betting, event, activatedAt, revealedAt, awardedAt
        participationTickets, correctBonusTickets, maxSpeedBonus, speedWindowMs
        votes/
          {participantId}/
            value     — 선택값(객관식: "A", OX: "O"/"X", 온도계: "72", 토론: "for:의견" | "against:의견", 순위: "2,0,3,1", 빈칸: 텍스트)
            nickname
            timestamp
            bet       — 베팅 배수 (1/2/3, 베팅 활성화 시)

    participants/
      {participantId}/
        nickname, joinedAt, online

    scores/
      {participantId}/
        nickname, total, tickets, streak, maxStreak

    chat/
      {messageId}/
        text, sender, senderType ("student" | "instructor"), timestamp

    reactions/
      {reactionId}/
        type, timestamp

    urgentQuestions/
      {questionId}/
        text, timestamp, read

    classQuestions/
      {questionId}/
        text, nickname, participantId, timestamp, answered
        upvotes/
          {participantId}: true

    handRaises/
      {participantId}/
        raised, nickname, timestamp

    timer/
      endTime, duration, running, startedAt

    speedQuiz/                    // transient — 종료 시 삭제
      active, startedAt, totalQuestions

    teamBattle/                   // transient — 종료 시 삭제
      active, teamCount, startedAt
      teams/
        team0: { name, members/{pid: true} }
        team1: { name, members/{pid: true} }
        ...

questionLibrary/
  {adminUid}/
    {qId}/
      type, title, options[], correctAnswer, points, savedAt, updatedAt

courseTemplates/
  {courseId}/
    name, createdAt
    questions/
      {qId}/
        type, title, options[], correctAnswer, ...

admins/
  {uid}/
    username, passwordHash, displayName, role ("admin" | "master"), approved, createdAt
```

---

## 6. 데모 데이터

`node scripts/seed-demo.mjs`로 6개 클래스, 14개 세션 생성.

| 데이터 유형 | 적용 세션 | 설명 |
|-------------|-----------|------|
| 질문 & 투표 | 모든 세션 | 9종 유형, 가중치 기반 투표 |
| 채팅 | active 세션 3개 | 학생-강사 혼합 메시지 (6~10개) |
| 손들기 | active 세션 3개 | 2~4명 학생 |
| 긴급 질문 | active 세션 3개 | 2~4개 익명 질문, 읽음/안읽음 |
| 수업 질문 | active + reviewing 세션 | 실명 질문 + 추천(upvote) |
| 퀴즈 점수 | quiz 있는 세션 | 정답 기반 점수 + 속도 보너스 + 티켓 |
| 팀 대항전 | active 세션 | 3팀 배정 데모 |

---

## 7. 파일 구조

```
src/
  app/routes/
    admin/                   — 강사 화면 (27개 컴포넌트)
      AdminPage.jsx          — 메인 진입점 (112줄)
      AdminLogin.jsx         — 로그인 분기
      LoginView.jsx          — 로그인 폼
      RegisterView.jsx       — 회원가입 폼
      AdminSessionHeader.jsx — 세션 헤더 (타이머/배지/액션)
      SessionDashboard.jsx   — 대시보드 (4탭)
      SessionList.jsx        — 세션 목록
      SessionSearchFilter.jsx — 검색/필터 UI
      DeleteSessionModal.jsx — 삭제 확인 모달
      CreateSessionModal.jsx — 세션 생성 모달
      QuestionManager.jsx    — 질문 관리 패널 (155줄)
      QuestionForm.jsx       — 질문 추가/편집 폼 (131줄)
      QuestionFormSections.jsx — 폼 섹션 분리
      QuestionList.jsx       — 질문 목록 + 빠른 진행 카드
      QuickProgressCard.jsx  — 빠른 진행 카드 추출
      CenterContent.jsx      — 중앙 패널 콘텐츠
      RightSidebar.jsx       — 우측 사이드바
      TabletDrawers.jsx      — 태블릿 오버레이 드로어
      ModeSwitcher.jsx       — 모드 전환 아코디언
      PresentationView.jsx   — 발표 모드 (전체화면 + Wake Lock)
      ModePreview.jsx        — 클래스 생성 시 모드 체험(저장되지 않음)
      ClassSummary.jsx       — 완료 세션 인사이트
    live/
      LivePage.jsx           — 전자칠판 라이브 관전 뷰 (/live?s=세션코드)
      LiveHeader.jsx         — 라이브 뷰 헤더 (강의명+접속자)
      LiveParticipation.jsx  — 라이브 뷰 참여율 바 (카운트업 애니메이션)
  features/dm/
    api/
      useDM.js               — useStudentDM + useStaffDMs 훅
      useStaffChat.js         — 운영 채팅 구독 훅
    components/
      HelpRequestModal.jsx    — 학생 도움 요청 모달
      DMBubble.jsx            — 학생 DM 플로팅 버블
      StaffDMAlert.jsx        — 스태프 DM 알림 배너
      StaffDMChat.jsx         — 스태프 DM 대화 모달
      CourseEditor.jsx       — 강의 템플릿 편집
      EventBooster.jsx       — 이벤트 부스터
      ExportMenu.jsx         — CSV 내보내기 메뉴
      ImportFromLibraryModal.jsx — 보관함에서 가져오기
      StatsView.jsx          — 수업 기록 탭
      StatsInsights.jsx      — 트렌드/난이도 분석
      QuestionLibraryView.jsx — 질문 보관함 탭
      TemplatePacks.jsx      — 템플릿 팩 5종
      MoreView.jsx           — 더보기 탭
      ProfileSection.jsx     — 프로필 편집
    student/                 — 학생 화면 (9개 컴포넌트)
      VotePage.jsx           — 투표 메인
      WaitingPage.jsx        — 대기 화면
      JoinPage.jsx           — 입장/닉네임
      StudentHeader.jsx      — 학생 헤더
      StudentBottomBar.jsx   — 하단 바 (4열)
      LeaderboardPage.jsx    — 리더보드
      SessionEndedPage.jsx   — 세션 종료 요약
      IdleMascot.jsx         — 마스코트 idle 애니메이션
      VoteHelpers.jsx        — 투표 유틸 컴포넌트

  components/ui/             — 공유 UI 프리미티브 (16개)
    Avatar, Badge, Button, Card, ConnectionBanner, ConnectionDot,
    EmptyState, ErrorBoundary, IconButton, InstallPrompt, Modal,
    DoranDoranMascot, QRCode, QuizEventBanner, Skeleton, Toast

  features/                  — 비즈니스 기능 (12개 도메인)
    chat/                    — ChatPanel, useChat
    class-questions/         — ClassQAPanel, ClassQuestionList, useClassQuestions
    games/                   — Roulette, Lottery, PrizeDraw
    hand-raise/              — HandRaiseList, useHandRaises
    participants/            — ParticipantList, JoinToast, useParticipants
    questions/               — UrgentQuestionList, useUrgentQuestions
    quiz/                    — QuizResult, Leaderboard, AchievementToast, SpeedQuizBanner,
                               SpeedQuizCombo, StreakBadge, TeamBadge, BetSelector,
                               useScores, useAchievements, useSpeedQuiz, useSpeedQuizStudent
    reactions/               — ReactionBar, ReactionOverlay, useReactions, reactionConfig
    session/                 — SessionStatus, useSession, useSessionList
    teams/                   — TeamBattleControl, TeamScoreboard, useTeamBattle, useTeamScores
    timer/                   — TimerCountdown, TimerPopup, useTimer
    visualization/           — BarChart, OXBattle, WordCloud, QACards, ScaleChart,
                               DebateChart, RankingChart, FillBlankChart, VizRenderer,
                               BetDistribution, AnswerDistribution
    voting/                  — ChoiceVoter, OXVoter, QuizVoter, TextInput, ScaleVoter,
                               DebateVoter, RankingVoter, FillBlankVoter, VoteConfirm

  hooks/                     — 공유 훅 (10개)
    useAdminKeyboardShortcuts, useAdminSession, useConnectionStatus,
    useMediaQuery, useQuestionActions, useQuestionChime,
    useRecentQuestions, useTheme, useToast, useVotes

  lib/                       — 유틸리티 (10개)
    auth.js, chime.js, csv.js, design-tokens.js, firebase.js,
    participant.js, question-types.js, quiz.js, template-packs.js, utils.js
```

---

## 7.5 사후 과제 시스템 (완료)

| 기능 | 대상 | 상태 | 설명 |
|------|------|------|------|
| 과제 등록 | 강사 | 완료 | 클래스/차수 선택 + 제목/설명 + AI 심사 토글 |
| 과제 제출 | 학생 | 완료 | 이름 + 4자리 PIN + URL/코드파일/PRD문서/설명 |
| 제출물 조회 | 학생 | 완료 | 비회원 주문조회 방식 (이름+PIN → 수정/취소) |
| AI 심사 | 강사 | 완료 | Gemini 2.0 Flash × 7명 심사위원 (순차 평가) |
| 심사 결과 | 양쪽 | 완료 | 합격/불합격 + 순위 + 심사위원별 코멘트/강점/개선점 |
| 시상 | 양쪽 | 완료 | 대상/최우수상/우수상 + 특별상 4종 + 풀스크린 시상식 |
| 시상 결과 보기 | 학생 | 완료 | 심사 완료 후 학생이 시상 결과 확인 가능 |

## 8. 계획 중인 기능

| 기능 | 대상 | 우선순위 | 설명 |
|------|------|----------|------|
| 학생별 참여도 분석 | 강사 | 중간 | 개별 학생의 세션별 참여율, 정답률, 성장 추이 |
| 세션 복제 (전체) | 강사 | 완료 | 원클릭 복제: 세션 목록 Copy 아이콘 + 생성 모달 내 복제. 질문 전체 복사 |
| 랜덤 보상 | 양쪽 | 낮음 | 참여만 해도 확률적 보너스 포인트 |
| 마스코트 다양한 포즈 | 학생 | 낮음 | 상태별(생각/축하/혼란) 마스코트 변형 |

---

## 9. 알려진 제약

| 항목 | 내용 |
|------|------|
| 웹페이지 슬라이드 | 임베드를 거부하는 사이트는 화면 안에서 열 수 없다. 우회하지 않고 새 창으로 안내한다(§3.10 정책) |
| 전체화면 | 브라우저가 사용자 제스처 밖의 전체화면 요청을 거절할 수 있다. 이때는 우상단 수동 버튼으로 전환한다 |
| Wake Lock | 배터리 절약 모드 등에서 거절될 수 있다. 실패해도 발표 진행에는 영향이 없다 |
| 새 질문 유형 추가 | `database.rules.json`의 type 화이트리스트에도 넣고 배포해야 한다. 빠뜨리면 쓰기가 조용히 거부된다 |
| 추첨 명단 | 표시 이름은 DB 규칙상 10자 제한이다. 사번은 20자까지 저장되고 원본이 보존된다 |

## 2026-10-04 실시간·발표·보안 검수

기존 운영 자료와 강사 UID를 보존하며 다음 경계를 강화한다.

| 영역 | 검수/개선 | 확인 방식 |
|---|---|---|
| 강사 인증·승인 | 서버 자격 증명 확인, 같은 UID 사용, 공개 master 가입 차단 | 실제 Auth/DB 에뮬레이터 |
| 학생·개인 데이터 | 본인 작성, 타인 DM/PIN/미공개 정답 접근 차단 | 허용/거부 요청 검사 |
| 질문·투표·점수 | 경로 변경 첫 렌더부터 이전 값 제거, 계속 들어오는 투표도 주기적으로 반영 | SDK 재구독 및 화면 전환 |
| 공개 데이터 | 원자료 보존, 공개 문항 뷰와 자기 투표만 구독, 한 필드 변경은 해당 경로만 전송 | 뷰/델타 단위 검사 |
| 채팅·Q&A | 완료 전에 중복 입력 잠금, 종료 후 응답이 타이머를 재생성하지 않음, 서버 통계 작성 | 동시 요청·정리 검사 |
| DM | 확정된 포인터로 승자 판단, 동일 ID의 누락 노드 복구, 타인 조회 차단 | 트랜잭션/권한 검수 |
| 접속·타이머 | 탭별 접속, 연결 해제 먼저 등록, 서버 오프셋 구독의 마지막 소비자 해제 | 다중 탭 및 구독 계측 |
| 과제·파일 | 기존 PIN 유지, 새 PIN scrypt, 소유자 경로·MIME 제한·HTML sandbox | 서버 API/Storage 검사 |
| AI·시상 | 새 GenAI SDK, 승인된 요청만 프록시 호출, 작업 간 판사 로그 혼합 방지 | 프록시 계약/코드 검수 |
| 발표·관객 | 전체화면, 입력 중 단축키 보호, 슬라이드 위치 보존, 중복 제목/제어 제거 | 실제 브라우저 왕복 조작 |
| 이미지·모션 | 고해상도 텍스트 보존, 디코딩 후 전환, 최대 4개 캐시, 작은 호흡·입력 피드백 | 이미지/화면 검사 |
| 참여 칭찬 | 현재 접속·실제 응답 근거, 최대 1분마다 4초 | 순수 계산·화면 |

검수 범위 밖: 실제 강의실 Wi-Fi 및 300명 동시 접속의 운영 처리량, 외부 Gemini 실제 모델 응답, 현재 운영 Auth/App Check/IAM 설정, 보안 규칙의 운영 배포. 저장소의 통과 결과로 이 항목을 검증 완료로 표시하지 않는다. 현장 교육의 실시간 상호작용에는 참가자의 네트워크 연결이 필요하다.

2026-10-04 화면 재점검: 맥북 내장 Retina에서 일반 Chrome의 발표자·관객 실제 전체화면을 확인했다. Chromium/WebKit 320·360·390·430px에서 학습자 참여·설정·더보기·투표·질문 전송을 검증한다. QR은 이미지 위의 대화상자로 표시하고, ESC로 닫아도 발표를 종료하지 않는다. 긴 보기 페이지는 발표자 조작과 전자칠판 표시가 함께 바뀐다. 키보드는 VisualViewport 높이 440px의 축소 상태를 모사해 전송 버튼 위치를 검증한다. 이 검증은 실제 Android/iPhone 기기, 실제 키보드, 교실 뒤쪽 가독성 측정을 대신하지 않는다.
