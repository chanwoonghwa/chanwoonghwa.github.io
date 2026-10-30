# 수도 테이블 · 식당 데이터 운영 가이드

- 웹앱: https://chanwoonghwa.github.io/food-finder/
- 배포: GitHub Pages \`docs/food-finder/\` (지도 · 랜덤 룰렛 · 식당 카드 · 필터 · 후보 공유)
- 데이터: **71개 식당** (2026-10-30 기준), 61개 초기 식당 + 10개 추가 식당. 앞으로 숫자를 고정해서 가정하지 마세요.
- 방문 이력: Firebase Authentication + Cloud Firestore의 \`groups/sudo-table/visits\`. 방문 날짜는 공개 HTML·JSON에 포함하지 않습니다.

## 데이터의 단일 원본

**수정 대상은 \`restaurants.json\`입니다.** 정적 페이지에서 초기 데이터를 바로 표시하려고 \`index.html\`에도 식당 데이터가 인라인으로 포함되어 있지만, 이는 **생성된 복사본**입니다. 직접 손으로 수정하지 마세요.

데이터 수정 후 루트에서 아래 명령을 실행합니다.

\`\`\`bash
python3 docs/food-finder/scripts/sync_catalog.py --write
python3 docs/food-finder/scripts/sync_catalog.py --check
\`\`\`

\`--check\`는 식당 ID 중복·필수 필드 누락과 인라인 JSON 불일치를 검출하며, GitHub Actions에서도 실행됩니다. 새 식당에 ID를 부여할 때 이미 존재하는 번호를 재사용하지 마세요. ID는 1부터 연속될 필요는 없습니다.

이 단계에서는 웹앱 런타임 구조를 변경하지 않았습니다. 식당 JSON의 인라인 복사본을 자동 생성하는 **빌드 타임 동기화 방식**이라 페이지 로딩과 기존 사용자의 즐겨찾기/후보 링크가 유지됩니다.

## 좌표·거리

- \`distances.json\`: 수도공고 기준 좌표와 **직선거리**. 현재 61개 항목 중 42개에 좌표가 있습니다. 신규 10개는 추가 검증이 필요합니다.
- 거리 필터에 쓰는 값은 자동차 주행거리/시간이 아닙니다. 미측정 데이터에 임의 값을 넣지 않습니다.
- 지도는 Leaflet + OpenStreetMap. 장소·주차 정보와 일요일 운영 여부는 예약 전에 확인해야 합니다.

## Firebase 권한 및 규칙

- 로그인: Google Authentication
- \`groups/{groupId}/members/{uid}\`: \`owner\`, \`editor\`, \`viewer\` 역할
- \`groups/{groupId}/visits/{visitId}\`: 멤버 읽기; owner/editor만 생성
- 데이터베이스 문서에 기록되는 식당 ID는 프런트엔드에서 실제 catalog membership으로 검증합니다.
- \`visits-firestore.rules\`는 향후 식당 추가 시 수동으로 ID 상한을 61→71→81로 올리지 않도록 양의 정수 ID(최대 999999)를 허용합니다. **이 범위 안의 유효한 식당 ID인지는 신뢰된 편집자의 클라이언트에서 확인**합니다. 권한 제어는 계속 서버 보안 규칙이 담당합니다.
- **GitHub에 규칙 파일을 커밋해도 Firebase에 자동 배포되지 않습니다.** 현재 라이브 규칙을 백업하고 [Firebase Console](https://console.firebase.google.com/)의 Firestore Rules에서 변경 내용을 Publish하거나, 전용 Firebase 프로젝트에서 규칙 배포 명령을 실행해야 합니다.
- Firebase project의 실제 배포 규칙 상태는 GitHub만으로 검증할 수 없습니다. 자세한 초기 설정은 [FIREBASE_STEP_BY_STEP.md](./FIREBASE_STEP_BY_STEP.md)를 참고하세요.

## 검증과 배포

- [food-finder-catalog-check.yml](../../.github/workflows/food-finder-catalog-check.yml): 식당 데이터 동기화·ID·JS 구문·좌표 참조 검증
- 기존 지도·방문 기록·사진 미사용 UI 등 스모크 테스트 유지
- 소스 변경 시 GitHub Pages가 배포되더라도 CI 실패가 배포를 자동 차단하는 것은 아닙니다. 새 식당을 게시하기 전 검사 결과를 확인하세요.
- **큐레이션 제보·승인 기능은 아직 미구현**입니다. 이후 Firestore 승인 워크플로를 추가하더라도 기존 방문 기록의 restaurant ID를 보존해야 합니다.
