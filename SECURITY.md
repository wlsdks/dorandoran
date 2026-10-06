# Security Policy

취약점은 [GitHub Security Advisory](https://github.com/wlsdks/dorandoran/security/advisories/new)로 비공개 신고해주세요. 계정, 토큰, PIN, 학생 제출물은 공개 이슈에 포함하지 마세요.

## 인증과 권한

- 강사는 서버가 자격 증명을 검증한 뒤 Firebase custom token으로 로그인합니다. 브라우저는 `admins`나 비밀번호 해시를 읽지 않습니다.
- 기존 강사 UID, 아이디, 비밀번호, 역할, 승인 상태는 그대로 사용합니다. 로그인 시 기존 RTDB 계정을 수정하거나 재발급하지 않습니다. 새 계정은 scrypt 자격 증명을 사용하며, 강사와 스태프 모두 관리자 승인을 기다립니다. 공개 가입으로 `master`가 되지 않습니다.
- 학생은 Firebase 익명 인증 UID로 참여합니다. 다른 사람의 투표·DM·점수·권한은 수정할 수 없습니다. 과거 참여 기록은 삭제하지 않습니다.
- 강사는 본인 강의를 제어하고, 스태프는 배정된 강의의 지원 업무만 수행합니다. 권한은 브라우저 저장 값이 아닌 DB의 승인 기록과 검증된 Firebase 사용자로 확인합니다.
- 질문 원본은 제어자에게만 제공합니다. `publicQuestions`는 공개 가능한 필드만 담는 별도 뷰입니다. 미공개 정답과 제출물·원본 투표는 여기에 포함하지 않습니다. 원본 질문 노드는 변경하지 않습니다.
- 새 제출 PIN은 8자리이며 scrypt로 저장합니다. 기존 4자리 PIN과 제출물은 변경하지 않고 서버에서 확인합니다. 확인 후 사용자별 임시 조회 권한만 별도로 부여합니다. 전체 제출물과 PIN을 학생 브라우저로 내려보내지 않습니다.
- 공개 클래스 링크를 가진 사용자는 해당 수업에 참여하거나 관객 화면을 볼 수 있습니다. 공개 투표 결과·참여 순위와 개인 DM·과제 자격 증명은 권한이 다릅니다.

## 파일·프록시·내보내기

Storage는 인증된 소유자 경로에만 JPG/PNG/WebP/GIF를 허용합니다. SVG/HTML 업로드와 비인증 업로드는 거부하고 파일 크기를 제한합니다. 과제 HTML 미리보기는 `allow-scripts`만 가진 sandbox에서 실행하며 `allow-same-origin`을 부여하지 않습니다.

Gemini 키는 Functions Secret Manager에만 둡니다. 클라이언트는 같은 출처 프록시만 호출하고, 프록시는 Firebase 로그인·승인·모델·경로·본문 크기·호출 빈도를 검사합니다. 업스트림 오류와 키를 그대로 반환하지 않습니다. AI의 운영 활성화 여부는 별도로 확인해야 합니다.

CSV는 Excel 열람 시 사용자 문자열이 수식으로 실행되지 않게 인용된 필드에 탭을 붙입니다. 이 탭은 프로그램으로 CSV를 다시 읽을 때 보존되므로, 자동 처리 파이프라인에서는 명시적으로 처리해야 합니다.

## 검증

```sh
npm ci
npm ci --prefix functions
npm ci --prefix functions-ai
VITE_GEMINI_API_KEY= npm run check
npm run test:integration
npm audit
npm audit --prefix functions
npm audit --prefix functions-ai
```

통합 검증은 `demo-dorandoran`의 Auth/Database/Storage 에뮬레이터에서만 수행합니다. 운영 프로젝트의 데이터는 쓰거나 정리하지 않습니다. SDK 구독 계측은 Vite `qa` 모드에서만 사용합니다.

## 운영 반영

코드 머지는 운영 배포나 현재 서버의 보안 상태를 증명하지 않습니다. 운영 데이터 삭제·초기화·일괄 계정 이관을 하지 않습니다. 반영 전 활성 수업을 확인하고, 운영 규칙을 별도로 보관한 뒤 아래를 준비하세요.

1. Firebase Authentication 익명 로그인을 활성화하고 기존 계정과 같은 UID의 custom-token 로그인이 가능한 서버 서비스 계정을 준비합니다. 토큰 서명에 필요한 `iam.serviceAccounts.signBlob` 권한은 해당 서명 계정에만 부여합니다.
2. Functions Node.js 22, `APP_DATABASE_URL`, 실제 운영 출처의 `APP_ALLOWED_ORIGINS`를 설정합니다. 운영 도메인은 DNS나 저장소명 변경과 별개입니다.
3. 아래 **이 프로젝트의 함수만 지정**해 배포합니다. 같은 Firebase 프로젝트의 다른 함수는 변경하지 않습니다. 수업 함수(`functions/`, codebase `default`)는 AI 키 없이 배포됩니다.

```sh
firebase deploy --only functions:default:staffApi,functions:default:assignmentApi,functions:default:classroomApi,functions:default:quizTallyFallback
firebase deploy --only database,storage,hosting
```

`quizTallyFallback`은 퀴즈 응답 집계의 예비 경로입니다. 평소에는 강사 화면이 집계를 올리고, 강사 화면 신호가 15초 넘게 끊긴 동안에만 이 함수가 투표 원본으로 다시 세어 같은 모양(`source: 'server'`)으로 올립니다. Realtime Database가 `asia-southeast1`에 있어 트리거도 같은 지역에 배포됩니다. 투표마다 한 번 불리지만 대부분 작은 값 3개만 읽고 끝나며, 재시도는 끕니다(다음 투표가 다시 셉니다).

4. AI 기능은 선택입니다. 쓰기로 했을 때만 키를 등록하고 AI 코드베이스(`functions-ai/`, codebase `ai`)를 따로 배포합니다. 처음 배포하면 기존 `geminiProxy`를 이 코드베이스가 이어받습니다.

```sh
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions:ai:geminiProxy
```

2026-10-04 읽기 전용 점검 당시 기존 계정 19개의 UID/역할을 삭제하거나 수정하는 작업은 포함하지 않습니다. `publicQuestions`, 과제 조회 권한, 강의 연결 권한은 원자료를 덮어쓰지 않는 별도 데이터입니다. 학생의 과거 로컬 UUID는 인증 증명이 아니므로 보안 전환 후 다시 참여해야 할 수 있습니다. 과거 운영 데이터가 공개됐는지 여부나 운영 Auth/App Check·quota 설정은 저장소 테스트로 확정할 수 없습니다. 공개됐던 자격 증명의 교체는 원자료 보존 정책과 별도로 운영자가 결정해야 합니다.

참고: [Firebase 읽기·쓰기와 구독 해제](https://firebase.google.com/docs/database/web/read-and-write), [Firebase custom-token 인증](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [Firebase Rules 권한 조건](https://firebase.google.com/docs/database/security/rules-conditions), [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).

AI 표시 정책: 공개 프록시 URL만으로 연결을 판단하지 않습니다. 인증된 상태 확인은 서버 Secret Manager 설정과 명시된 수업/클래스 `aiEnabled=true`를 함께 확인합니다. 과제는 기존 `hasJudging` 설정을 존중합니다. 수업별 명시 설정이 없으면 AI를 사용 가능한 것으로 표시하지 않습니다. 이 작업은 기존 데이터에 설정 값을 일괄 추가하지 않았습니다. 연결 상태 응답에는 키·토큰을 포함하지 않으며, 학생의 직접 AI 생성 권한은 추가하지 않습니다. 설정 상태 확인은 실제 모델 응답·품질·과금을 검증하는 호출이 아닙니다.
