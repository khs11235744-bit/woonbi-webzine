# 웅비 원고 작성·인터뷰

Guard: khs11235744-bit/woonbi-webzine / feat/woonbi-contribute-interviews.
범위: 별도 작성 입구와 비공개 수합. 기존 main 병합 금지·배포 설정 보존. 실제 답변·학생 정보 커밋 금지.

## 사용
- contribute.html: 작성 입구
- contribute.html?kind=principal: 교장 인터뷰
- contribute.html?kind=viceprincipal: 교감 인터뷰
- contribute.html?kind=event: 사실 입력형 기사 초안
- contribute.html?kind=free: 자유 원고
- contribute.html?kind=principal&view=sheet: 인쇄용 A4 2쪽 질문지 (교감은 viceprincipal)
- contribute.html?view=guide: 학생 기자 후속 질문·현장 진행 안내
- contribute.html?view=inbox: 교사 수합함 → 기존 편집실 초안으로 가져오기

로그인 없이 작성·sessionStorage 임시 보관·TXT/JSON 내려받기·인쇄. JSON 불러오기로 작업 복구.
제출은 기존 Google 인증 사용. contributions 컬렉션에 변경 불가 원고를 접수한다.
읽기: 작성자 본인 또는 baseTeacher. 기존 OPEN ADMIN 역할로 다른 사람의 답변을 읽지 못한다.
가져오기는 교사 전용 트랜잭션. 같은 접수번호는 같은 기사 ID로 연결해 중복을 막는다.
초안은 webConsent/printConsent=false, 별도 승인·공개 동의가 필요하다.
사진은 기존 편집실에서 추가한다. 외부 생성 모델 호출과 비용은 없다.

## REUSE
- WRAP: 기존 FirebaseStore Google 인증·Firestore SDK, core.newArticle, 교사 검토·발행.
- BUILD: 질문 템플릿, 사실 기반 초안 조립, 비공개 접수 입구만 추가.

## Critic BEFORE
학생/응답자: 기존 입구는 편집실과 배정 원고 중심. 질문에 바로 답하는 링크 부재(P1).
교사: 일반 접수 원고를 독립적으로 수합하는 경로 부재(P1).
편집: 기사 발행·사진 관리·기존 뉴스룸 UI는 보존.
개인정보: 기존 임시 OPEN ADMIN을 접수 답변 권한에 재사용하지 않는다(P0).

## 검증 시나리오
질문 답변 → Q&A 초안 / 행사 사실 → 입력 내용만 반영 / 긴 원고 한도 / HTML 탈출.
익명·타인 사칭·공개동의 주입·타인 읽기 차단 / 교사 수합 / 중복 접수 및 가져오기 복구.
실제 학교 계정 로그인·운영 서버 수합은 별도 확인이 필요하다.

## Critic AFTER / Reality Test
RESOLVED: 인터뷰 직접 링크·비로그인 작성·2쪽 질문지·후속 질문·검토용 수합 입구 구현.
동일 관점 검토에서 발견한 최초 가져오기 권한 오류, 접수 확인 유실 후 수정 재전송 누락, 100건 이후 조회 문제를 수정.
주의: 교사가 기존 편집실로 가져온 사본은 기존 편집실 권한을 따르며, 임시 OPEN ADMIN 설정은 이번 작업에서 변경하지 않음.

검증 증거:
- npm run check 통과. 기존+신규 npm test 191/191 통과.
- Firebase CLI 15는 이 환경 Java17과 호환되지 않음. CLI14.24.2 에뮬레이터로 실제 규칙 검사 22/22 통과(신규 접수 3개 포함).
- jsdom 실제 화면 실행: 네 작성 입구, 한국어 답변 입력/미리보기/sessionStorage, 인쇄 질문지 2면/11문항, 기자 안내 10항목 통과.
- jsdom 재전송 시나리오: 서버 쓰기 후 응답 유실 → 수정 → 재제출 때 별도 원고가 저장되며 새 본문 보존 확인.
- live shell 빌드와 git diff --check 통과.

GitHub 앱의 git tree/branch/file 쓰기는 403으로 거절되었으나, 사용자 승인 후 로그인된 브라우저로 전용 브랜치 생성 및 파일 저장을 진행.
2026-10-19 사용자 승인: 브라우저를 통한 GitHub 저장과 웅비 배포 허용. main 병합 없이 전용 브랜치의 기존 workflow_dispatch 사용.
운영 Google 계정 제출/실제 브라우저 반응형·인쇄 레이아웃 검증은 미실행. 배포 완료 주장 금지.
