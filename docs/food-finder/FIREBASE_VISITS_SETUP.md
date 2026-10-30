# 수도 테이블 · 공유 방문 기록 (Firebase Firestore)

**방문 기록은 localStorage 등에 저장하지 않습니다.** 공유 Firebase DB가 연결되지 않은 상태에서는 `공유 방문 DB 미연결`이라고 표시합니다. 공용 DB가 연결되기 전에는 날짜를 입력하거나 저장할 수 없습니다.

## 준비
1. **별도 Firebase 프로젝트 권장.** 기존 테니스 스코어보드 프로젝트를 그대로 쓰려면 Firestore rules를 무심코 덮어쓰지 마세요. 기존 collection 접근 정책과 결합해야 합니다.
2. Firebase Console에서 웹 앱을 등록하고 Google Authentication을 활성화합니다. **Authorized domains**에 `chanwoonghwa.github.io`를 추가합니다.
3. Cloud Firestore를 생성합니다. 제공된 `visits-firestore.rules`를 검토하고 기존 rules와 병합 또는 새 프로젝트에 적용합니다.
4. Firestore에 `groups/sudo-table/members/{YOUR_GOOGLE_UID}` 문서를 추가하고 `role`을 `owner`로 지정합니다. 팀 구성원에게 `viewer` 또는 `editor` 역할로 멤버 문서를 수동 등록합니다.
5. `shared-visits-config.json`을 아래처럼 변경하고 GitHub에 커밋합니다.
```json
{
  "enabled": true,
  "provider": "firebase-firestore",
  "groupId": "sudo-table",
  "firebaseConfig": {
    "apiKey": "YOUR_FIREBASE_WEB_API_KEY",
    "authDomain": "YOUR_PROJECT.firebaseapp.com",
    "projectId": "YOUR_PROJECT",
    "appId": "YOUR_APP_ID"
  }
}
```
웹용 Firebase 구성의 apiKey는 **클라이언트 SDK용 공개 설정**이며 비밀 인증 토큰이 아닙니다. **Firebase 서비스 계정 비밀키, 관리자 SDK 개인키, OAuth client secret은 절대 GitHub Pages에 올리지 마세요.** 유효한 Firestore Security Rules가 데이터 접근의 핵심입니다.

## 기록 스키마
`groups/sudo-table/visits/{auto_document_id}`
- `restaurant_id`: integer, 1–61
- `visited_at`: ISO local calendar date `YYYY-MM-DD` (KST)
- `created_at`: Firestore server timestamp
- `created_by`: Firebase Auth Google UID

클라이언트는 로그인한 팀 멤버에 한해 `onSnapshot`으로 기록을 동기화하고, 각 식당의 `MAX(visited_at)` 및 방문 횟수를 계산합니다. 날짜는 모임에서 실제 방문한 날을 수동 등록합니다. GPS 위치 추적으로 방문을 추론하지 않습니다.

권한: `viewer`는 조회만 가능하고, `owner`/`editor`만 추가 가능합니다. 이 기본 정책에서는 실수로 등록한 기록을 지우려면 관리자 Firebase Console에서 수정해야 합니다. 추후 관리자 UI를 확장할 때 수정/삭제를 별도로 설계하세요.

## 한계 / 확인사항
- 사이트가 GitHub Pages에 공개되어도 **방문 날짜는 별도 Firestore 프로젝트와 멤버 권한이 있어야 보입니다.**
- 페이지에 표시되는 식당 위치는 기존 건물좌표 42곳 기준으로, 19곳은 좌표 미확인입니다.
- 이 기능은 기존 `restaurant-photos.json`/메뉴 참고 이미지·즐겨찾기·후보 목록 동작을 바꾸지 않습니다. **즐겨찾기만 기존대로 브라우저에 남아 있습니다.**
- 지도는 Leaflet + OpenStreetMap 타일을 사용합니다. 타일 저작권 표시는 지도에 유지하며, 사용자 동작 없이 지도 타일을 일괄 다운로드하지 않습니다.
- `visits-firestore.rules`는 **별도 Firebase 프로젝트를 기준으로 한 예제**입니다. 다른 기존 컬렉션이 있다면 rules 병합 및 검증이 필요합니다.
