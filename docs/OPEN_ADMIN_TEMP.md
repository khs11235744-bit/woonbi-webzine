# 웅비 임시 OPEN ADMIN

현재 운영 목적: 아직 사이트 이용자가 제한적인 개발·자료이관 단계에서 학교 Google 계정으로 사진 정리와 편집 기능을 빠르게 테스트한다.

현재 동작:
- Google의 확인된 이메일로 로그인하면 UI에서 teacher/admin으로 취급한다.
- Firestore와 Storage 규칙도 로그인된 Google 계정을 관리자 권한으로 취급한다.
- 익명 사용자는 편집·원본 사진·관리 데이터에 접근할 수 없다.
- 운영 상단 배너에 OPEN ADMIN 상태를 표시한다.

잠글 때:
1. `deploy/firebase-live-config.json`의 `openAdmin`을 false로 변경한다.
2. Firestore/Storage의 TEMP OPEN ADMIN 함수들을 다시 member role 기반으로 되돌린다.
3. security-rules 테스트를 원래 학생/편집자/교사 분리 기대값으로 되돌린다.
4. 규칙과 Hosting을 함께 배포한다.

사이트 주소를 모르는 것 자체는 보안 경계로 사용하지 않는다. 이 모드는 개발·사진 이관 기간 동안만 유지한다.
