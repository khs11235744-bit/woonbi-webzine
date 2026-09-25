# 웅비 웹진 v0.6

학생은 자기 기사를 쓰고 사진을 올려 제출합니다. 교사는 수합·검토·승인하고 웹진 또는 책 검토본으로 발행합니다. 자유 배치 출판 프로그램을 다시 만들지 않고 원고 수합을 중심에 둡니다.

**이 GitHub 소스에는 가상 원고 3편만 있습니다. 실제 2026 기사 34편·명단·학교 사진·지난 호 PDF는 넣지 않았습니다.**

## 실행
Node.js 22와 Python 3 환경에서 다음을 실행합니다. 패키지 설치 없이 데모를 열 수 있습니다.

```sh
npm test
npm run check
npm start
# 실제 Hosting을 갱신할 때만
npm run deploy:hosting
```

브라우저에서 `http://127.0.0.1:8137`을 엽니다. `npm run build`는 로컬 단일 HTML 검토본을 만듭니다. 역할 선택은 가상 체험이며 실제 Google 로그인이 아닙니다.

## 수정 위치
- `web/js/newsroom.js`: 기사 목록·읽기·검색·보관함·지난 호.
- `web/js/app.js`: 학생 작성·사진 교체·교사 검토·책 묶기.
- `web/js/core.js`: 역할·상태·버전·발행·책 확정 규칙.
- `web/js/editorial.js`: 형식 검사·예시 사진·파일 헤더·읽기 시간.
- `web/newsroom-v04.css`, `web/newsroom-v05.css`, `web/newsroom-v06.css`, `web/editorial-polish.css`: 편집형 화면과 반응형·지면 밀도 보정.
- `web/js/demo-store.js`: 로컬 임시·IndexedDB 저장.
- `web/js/firebase-store.js`, `firebase/`: 웅비 전용 Firebase Auth·Firestore·Storage 연결과 보안 규칙. 공개 셸과 실제 학생 계정 운영 검증은 구분합니다.
- `web/js/sample-data.js`: 개인정보 없는 가상 원고. 실원고를 여기에 커밋하지 마세요.
- `docs/REVIEW_200.md`: 100개 가상 역할의 200개 검토 항목. 실제 인터뷰 아님.

## 이번에 고친 핵심
사진 없는 원고의 교체용 배치, 사진마다 교체 버튼, 위치·캡션 처리, 임시 사진 제출/발행/인쇄 차단, 제목·목록·본문 사진 일치, 자동저장 후 캡션 변경이 사라지는 문제, 한글 검색, 정렬, 보관함, 읽기 크기, 진행 표시, 관련 기사, 사진 부족 필터, 키보드·모바일 보정.

## 검증 범위
단위 검사는 저장·역할·본문 보호·사진·편집 규칙을 다루고 Firebase 규칙 에뮬레이터와 학교정보 스키마 검사도 함께 유지합니다. 공개 셸은 웅비 전용 Firebase Hosting에서 운영하며, 실제 학생 Google 계정과 여러 학교 기기에서의 동시 작성은 별도 운영 검증 대상으로 남깁니다. 전체 WCAG 인증이나 인쇄소용 완전 자동조판을 주장하지 않습니다.

## 안전한 작업
웅비 전용 브랜치와 독립 공개 저장소만 사용하고 INDI+P 등 다른 프로젝트의 배포 설정을 건드리지 않습니다. 공개 주소는 `https://woonbi-webzine-2026.web.app`이며, 배포본에는 개인정보 없는 예시·공개용 자산만 포함합니다. 실제 원고·명단·원본 학교 사진은 로컬/보호 저장소에 남기고 공개 셸과 분리합니다.

## 참고
Ghost Source(https://github.com/TryGhost/Source), Superdesk(https://github.com/superdesk/superdesk), Duke Chronicle(https://github.com/dukechronicle), W3C WCAG 2.2(https://www.w3.org/TR/WCAG22/)의 구조와 원칙을 참고했습니다. 해당 프로젝트의 프로그램을 통째로 복제하거나 설치하지 않았습니다. 외부 라이선스 코드를 추가할 때 별도로 고지해야 합니다.

학교 사진·기사에는 별도 권리가 있습니다. 이 저장소의 도식형 예시 이미지는 실제 사진이나 학교 현장이 아닙니다. 실제 원고가 포함된 별도 로컬 검토본에는 지난 호 자료사진을 교체용으로 표시했습니다.
