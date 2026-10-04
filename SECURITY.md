# Security Policy

## 지원되는 버전

DoranDoran은 현재 단일 active 브랜치(`main`)만 운영합니다. 보안 패치는 최신 release에만 적용됩니다.

## 보안 취약점 신고

**공개 GitHub 이슈에 보안 취약점을 게시하지 마세요.**

다음 중 하나로 비공개로 신고해주세요:

1. **GitHub Security Advisory** (권장) — repo의 Security 탭 → "Report a vulnerability"
2. **이메일** — [@wlsdks](https://github.com/wlsdks) 프로필의 연락처

신고에 다음을 포함해주세요:
- 취약점 유형 (예: XSS, 권한 우회, 데이터 노출)
- 영향 받는 컴포넌트/파일/엔드포인트
- 재현 단계 (가능하면 PoC)
- 잠재적 영향 범위

## 응답 시간

- **24~72시간 내**: 접수 확인
- **7일 내**: 초기 평가 + 수정 ETA
- **취약점 패치 후**: 신고자 동의 시 advisory 공개 + credit

## 알려진 보안 trade-off (의도된)

이 프로젝트는 **현재 Firebase Auth 미사용** 구조입니다:

- 강사 로그인은 클라이언트가 `admins` 노드를 직접 read해서 username/passwordHash 비교
- `sessions`/`assignments` root listing이 강사 대시보드에 필요해 read 차단 불가
- 학생은 익명 (sessionId + participantId localStorage)

→ 동일 인스턴스 내에서 sessionId/assignmentId만 알면 다른 강사의 세션 데이터 read 가능. 진정한 owner-scoping은 Firebase Auth 도입이 선행되어야 합니다 (별도 로드맵).

이 구조는 README의 §보안 참고에 명시되어 있고, 현재 단계에서는 강의용 도구로서 받아들인 trade-off입니다. 신고 시 이 항목들은 **이미 알려진 사항**이므로 반복 신고는 불필요합니다.

## 안전 사용 권장

운영자(self-host)는 다음을 확인해주세요:

- **Gemini API key**: `.env`로만 주입 + Google AI Studio에서 HTTP referrer 제한 + rate limit
- **Firebase rules**: `database.rules.json` 그대로 deploy (`firebase deploy --only database`)
- **secret rotation**: 운영 중 키 노출이 의심되면 즉시 rotate 후 재배포
- **PIN 정책**: 과제 제출 PIN은 평문으로 RTDB 저장 (RTDB rules로 read 제한). 민감 데이터에는 사용 자제
