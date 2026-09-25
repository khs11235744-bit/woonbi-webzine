# 웅비 Google Drive 미디어 브리지

상태: 2026-09-25 구현 완료(코드) / 실제 학교·개인 Google 계정 OAuth 실서비스 검증 대기.

## 목적

웅비 관리자 화면의 **웅비 사진 정리**에서 다음 흐름을 한 번에 처리한다.

학교 Google Drive(읽기 전용)
→ 공유 폴더·공유 드라이브 사진 목록
→ 선택 또는 폴더 전체
→ 개인 Google Drive 원본 증분백업
→ JPG·PNG·WebP만 웅비 중복검사·기사 자동추천
→ 기존 사진 파이프라인에서 원본 비공개 + 1600px WebP 파생본
→ 교사 승인 뒤 Firebase 공개본

## 권한 분리

- 학교 계정: `drive.readonly`. 학교 원본을 수정·삭제하지 않는다.
- 개인 백업 계정: `drive.file`. 웅비가 생성하거나 Picker로 선택해 앱에 허용한 백업 영역만 관리한다.
- OAuth access token: 브라우저 메모리에만 둔다. localStorage, Git, Firestore, 로그에 저장하지 않는다.
- Client Secret: 웹 앱에 넣지 않는다.
- 실제 학생 사진과 학교 원본: Git 저장소에 넣지 않는다.

## 운영 설정

운영용 `WOONBI_CONFIG`에 다음 공개형 웹 설정만 추가한다.

```js
googleDrive: {
  clientId: 'Google OAuth Web Client ID',
  apiKey: '브라우저 출처와 API가 제한된 API Key',
  appId: 'Google Cloud project number',
  backupFolderName: '웅비 사진 원본 백업',
  sourceListLimit: 5000
},
media: {
  scanLimit: 2000
}
```

Google Cloud에서 Drive API와 Google Picker API를 활성화하고, OAuth 웹 클라이언트의 승인된 JavaScript 원본에 실제 웅비 도메인을 등록한다. API Key는 웅비 도메인과 필요한 Google API로 제한한다.

## 관리자 사용 순서

1. 웅비 → **사진 정리**.
2. **학교 계정 연결**에서 학교 Workspace 계정을 선택한다.
3. **Drive에서 폴더 선택**으로 공유 폴더를 선택하거나 Drive 폴더 링크를 붙여넣는다.
4. **학교 폴더 읽기**를 누른다.
5. 필요하면 **개인 계정 연결**에서 대용량 개인 Google 계정을 선택한다.
6. 백업 위치를 직접 고르거나, 선택하지 않으면 웅비가 `웅비 사진 원본 백업` 폴더를 만든다.
7. 사진을 골라:
   - **선택 사진 웅비 정리기로**: 중복검사와 기사 자동추천으로 전달.
   - **선택 원본 5TB 백업**: 선택 원본만 개인 Drive로 복제.
   - **폴더 전체 증분백업**: 동일 원본은 건너뛰고 변경된 파일만 갱신.
8. 웅비 정리기에서 자동추천 결과를 확인한 뒤 기사에 연결한다.

## 증분백업 판정

백업 파일에는 Drive `appProperties`로 다음 정보를 기록한다.

- 원본 Drive file ID
- 원본 modifiedTime
- 원본 md5Checksum(제공되는 파일)
- 원본 크기

같은 file ID에서 MD5가 같거나, MD5가 없을 때 modifiedTime과 크기가 같으면 재업로드하지 않는다. 변경된 파일만 갱신한다.

## 사진 대량 정리

- Drive 목록: 기본 최대 5,000장.
- 브라우저 중복·기사추천 분석: 기본 최대 2,000장.
- 완전중복: SHA-256.
- 유사중복: dHash + 평균색 거리.
- 기사 추천: 파일명·폴더명·기사 제목·코너·필자·담당학생명 토큰.
- Drive 폴더 경로를 `webkitRelativePath`에 전달해 폴더명도 기사 추천에 활용한다.
- JPG·PNG·WebP는 웅비 변환 가능.
- 그 밖의 `image/*`는 원본 백업은 가능하지만 현재 웹진 변환 단계에서는 제외한다.

## 실서비스 검증 체크

코드 단위 테스트 통과와 별개로 다음은 실제 Google 계정에서 확인해야 한다.

- 학교 Workspace 관리자가 해당 공유폴더의 다운로드를 허용하는지
- 공유 드라이브/공유 폴더가 Picker에 정상 표시되는지
- 개인 계정 `drive.file` 권한으로 선택 백업 폴더에 생성·갱신이 되는지
- 대용량 파일 resumable upload가 실제 브라우저/도메인 CORS 조건에서 완료되는지
- Firebase Storage 공개 전 교사 승인·사진 공개 동의 절차가 유지되는지

실제 계정 검증 전에는 ‘학교 Drive 자동연동 운영 완료’로 판정하지 않는다.
