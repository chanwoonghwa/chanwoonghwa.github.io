# 수도 테이블 — Firebase 단계별 연결 가이드

이 가이드는 [수도 테이블](https://chanwoonghwa.github.io/food-finder/)의 **모임 공통 방문 기록**을 처음 연결하기 위한 것입니다.

## 완료되어 있는 부분

- [x] GitHub Pages: 지도 + 식당 42개 위치 좌표 + 스와이프 카드 + 비교표
- [x] Firestore 실시간 `visits` 조회 / 마지막 방문일 / 방문 횟수 계산
- [x] Google 로그인, 사용자 UID 복사, viewer/editor/owner 권한 구분
- [x] Firestore 접근 규칙 및 Firebase CLI 설정 파일 준비
- [ ] **Firebase 프로젝트 생성 (계정 소유자 작업)**
- [x] **웹 앱 등록 및 클라이언트 구성값 GitHub Pages 연동 완료**
- [ ] **Google 로그인 활성화 및 Authorized domains 추가 (계정 소유자 작업)**
- [ ] **Firestore (default) 생성 및 Security Rules 배포 (계정 소유자 작업)**
- [ ] **최초 owner 멤버 등록 (계정 소유자 작업)**
- [ ] **실제 방문일 등록 / 다른 기기 연동 확인**

## Step 1. 새 Firebase 프로젝트 만들기

1. [Firebase Console](https://console.firebase.google.com/)에 본인 Google 계정으로 로그인
2. **프로젝트 추가** → 표시 이름은 예시로 **Sudo Table** (원하는 이름 가능)
3. 프로젝트 ID는 자동 생성된 고유 ID 그대로 사용해도 됩니다
4. Google Analytics는 이 사이트의 방문 기록 기능에 필수가 아니므로 **사용 안 함** 선택 가능
5. 프로젝트를 만듭니다. 기존 테니스 스코어보드 프로젝트는 그대로 둡니다.

**이 단계에서 사용자에게 필요한 다음 정보**는 프로젝트 ID 또는 Firebase Console의 프로젝트 설정 화면에 표시되는 웹 앱 구성 정보입니다.

## Step 2. 웹 앱 등록

1. 프로젝트 개요에서 **웹 (</>)** 아이콘 선택
2. 앱 닉네임 **sudo-table-web**
3. Firebase Hosting 설정은 체크하지 않습니다. 사이트는 이미 GitHub Pages로 호스팅 중입니다
4. **앱 등록** → `firebaseConfig` 객체의 `apiKey`, `authDomain`, `projectId`, `appId`를 확인합니다.
5. **비밀키가 아닙니다:** 웹 앱의 `firebaseConfig`는 브라우저에서 사용하는 공개 클라이언트 설정입니다. 다만 서비스 계정 JSON, private key, OAuth client secret 등은 업로드하거나 채팅에 전송하지 마세요.

**상태(2026-10-30):** 사용자가 제공한 웹 앱 설정을 `shared-visits-config.json`에 반영했고 `enabled: true`로 전환했습니다. **아직 Authentication의 Google 공급자와 Firestore 규칙 설정은 콘솔 작업이 필요합니다.** 이때까지 사이트에서 로그인이나 기록이 완전히 작동하지 않는 것은 정상입니다.

## Step 3. Google 로그인

1. Firebase Console → **Build / Authentication** → 시작하기
2. **Sign-in method** → Google → 사용 설정 → 지원 이메일 지정 → 저장
3. Authentication → **Settings → Authorized domains**
4. `chanwoonghwa.github.io`를 추가. `https://` 접두사나 `/food-finder` 경로는 넣지 않습니다.

## Step 4. Cloud Firestore

1. Firebase Console → **Databases & Storage → Firestore → Create database**
2. **Standard edition** 과 `(default)` 데이터베이스 사용
3. 리전은 가능하면 **asia-northeast3 (Seoul)** 추천 (선택 가능 리전 및 계정 요금 확인). 위치는 나중에 변경이 어려울 수 있습니다.
4. **Production mode** 선택. Test mode는 일시적으로 전원 접근을 허용하므로 사용하지 않는 것을 권장합니다.
5. Firestore → **Rules** 탭에 [visits-firestore.rules](./visits-firestore.rules) 내용을 붙여넣고 **Publish**

> 이미 Firestore를 사용하는 기존 프로젝트에 연결한다면 **Rules 전체 덮어쓰기 금지**. 별도 프로젝트 권장.

CLI를 선호한다면 아래 폴더에서 프로젝트 ID를 명시해 실행할 수 있습니다.
```bash
cd docs/food-finder
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```
위 명령은 Firebase 규칙을 배포하며 프로젝트의 기존 규칙을 교체합니다. 새 전용 프로젝트에서만 사용하세요.

## Step 5. 사이트 연결 (웹 설정 저장)

`docs/food-finder/shared-visits-config.json`을 다음처럼 구성합니다.

```json
{
  "enabled": true,
  "provider": "firebase-firestore",
  "groupId": "sudo-table",
  "firebaseConfig": {
    "apiKey": "FIREBASE_WEB_API_KEY",
    "authDomain": "PROJECT_ID.firebaseapp.com",
    "projectId": "PROJECT_ID",
    "appId": "FIREBASE_WEB_APP_ID"
  }
}
```

GitHub에 저장하면 사이트는 이 정보를 자동으로 읽습니다. 별도 빌드 서버는 필요 없습니다.
작업 완료 후 [공개 사이트](https://chanwoonghwa.github.io/food-finder/)를 새로고침하면 **Google 로그인** 버튼이 나타납니다.

## Step 6. 최초 소유자 등록

1. 사이트에서 **Google 로그인** 진행
2. **내 UID 복사** 버튼을 클릭해서 UID를 복사합니다.
3. Firebase Console → Firestore → **Data** 탭에서 아래 구조를 만듭니다.

```
groups                            (collection)
  sudo-table                      (document)
    name: "수도 테이블"            (string; 선택)
    members                       (subcollection)
      THE_COPIED_FIREBASE_UID     (document)
        role: "owner"             (string)
```

주의: **Firestore 문서 ID는 로그인한 Google 계정의 Firebase Auth UID와 정확히 같아야 합니다.** 이메일을 넣는 게 아닙니다. 처음에는 일반 그룹 문서 `sudo-table`을 만든 후 그 아래에 `members` 하위 컬렉션을 만들면 편합니다.

4. 사이트를 새로고침합니다. 이제 **방문 기록 추가** 버튼이 나타납니다.

## Step 7. 사용

- **방문 기록 추가** → 식당 선택 → 실제 방문 날짜 입력 → 저장
- Firestore 경로 `groups/sudo-table/visits/{자동ID}`에 새 문서가 추가됩니다.
- 기록이 추가되면 지도 핀·식당 카드·상세표에서 **마지막 방문일**과 **누적 방문 횟수**가 자동 계산됩니다.
- 다른 Google 계정으로 로그인한 구성원은 **내 UID 복사** 후 관리자가 해당 UID로 멤버 문서를 등록해야 합니다.
- `role: "viewer"`는 읽기만, `role: "editor"`는 방문 기록 추가, `role: "owner"`는 추가 권한이 있습니다.
- 지금은 기록 수정·삭제 UI를 제공하지 않습니다. 오입력한 기록은 Firebase Console에서 관리자가 수정해야 합니다.
- **UID나 프로필이 자동으로 공개되지는 않습니다.** 그룹 멤버 권한과 규칙이 있어야 기록을 볼 수 있습니다.

## 문제 해결

- **`auth/unauthorized-domain`**: Authentication의 Authorized domains에 `chanwoonghwa.github.io` 등록 여부 확인
- **로그인 뒤 '모임 멤버 미등록'**: 로그인 후 '내 UID 복사' → `groups/sudo-table/members/UID`에 `role: "owner"` 또는 `viewer` 등록 후 새로고침
- **`permission-denied`**: Firestore Security Rules가 게시됐는지, 멤버 문서의 UID와 role이 정확한지 확인
- **`auth/operation-not-allowed`**: Google Sign-in provider가 활성화됐는지 확인
- **공유 DB 미연결**: `shared-visits-config.json`의 `enabled`와 클라이언트 설정 확인
- **브라우저에 저장되지 않나?** 방문 기록은 Firestore에만 저장됩니다. 인증 SDK가 로그인 세션을 로컬에 보관할 수 있으나 방문 기록은 앱의 로컬 스토리지에 따로 저장하지 않습니다.

Firebase 공식 문서: [프로젝트·웹 앱](https://firebase.google.com/docs/web/setup), [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [Firestore 만들기](https://firebase.google.com/docs/firestore/manage-databases), [Security Rules](https://firebase.google.com/docs/firestore/security/get-started).
