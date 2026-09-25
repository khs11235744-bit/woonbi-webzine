# 웅비 웹진 → 잡지 제작 파이프라인

## 설계 원칙
웹 기사와 인쇄 잡지를 따로 작성하지 않는다. 기사·사진·캡션·출처·동의·섹션 정보를 하나의 구조화 데이터로 저장하고, 출력 단계만 웹/잡지로 나눈다.

## 기사 데이터
- title / deck / body / byline / category
- photos[]: 원본 비공개, WebP 공개본, caption, alt, width, height, after
- webConsent / printConsent
- sourceRevision
- magazine: section, priority, spread, opener, pullQuote, photoTreatment

## 사진 파이프라인
학교 Google Drive 공유 폴더
→ 선택/백업
→ 중복·유사중복 탐지
→ 기사 자동 추천
→ 원본 비공개 보관
→ 웹용 WebP
→ 인쇄용 원본 참조
→ 기사별 사진 슬롯

Drive API/Picker가 연결되면 다운로드를 거치지 않고 공유 폴더를 탐색하고 여러 장을 선택하는 방식으로 확장한다.

## 잡지 조판 엔진 단계
1. 기사 확정본을 issue snapshot으로 동결
2. 섹션 자동 분류
3. 기사 길이와 사진 수로 1p / 2p / 4p 템플릿 추천
4. 표지 후보 사진과 표지 문구 생성
5. 섹션 오프너, 목차, 기사면, 사진면 자동 구성
6. 긴 문단·고아줄·사진 해상도·캡션 누락 preflight
7. A4 검토 PDF와 인쇄소 전달 ZIP 생성
8. 최종 승인본은 웹 원고 변경과 분리

## 우선 구현 순서
P1 Google 로그인 개방 + Drive 사진 유입
P2 Google Picker/Drive API 직접 선택
P3 기사별 사진 자동매칭·대량 승인
P4 magazine 메타데이터와 템플릿 추천
P5 자동 조판 미리보기
P6 인쇄 PDF/패키지 preflight
