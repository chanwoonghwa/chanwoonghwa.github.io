# 실제 매장 메뉴 사진 등록 기준

이 폴더의 `restaurant-photos.json`은 **실제 매장 사진 출처/허가 여부 관리 파일**입니다.

- `candidate_sources`: 실제 사진이 존재하는 페이지의 링크. **링크만 제공**하고 이미지 자체를 복제하지 않습니다.
- `actual_photos`: 검토·허가 완료된 이미지 메타데이터. 초기에는 비어 있습니다.
- 기존 `menu-photos.json`: Wikimedia Commons에서 저작권 조건을 확인한 동일 메뉴 **참고 사진**입니다.

## 등록 절차
1. 직접 촬영·매장 제공·재사용 허가 자료만 받습니다. 제3자 사진은 저작권자의 권한 확인이 필요합니다.
2. GitHub 이슈 폼 `restaurant-photo.yml`에서 매장 ID, 사진 첨부, 저작권자, 편집 허가 및 재사용 범위를 기록합니다.
3. 검토자가 사진 파일의 크기/EXIF(위치·기기정보)·개인정보를 확인하고 불필요한 EXIF를 제거합니다.
4. 검토 후 JPG 또는 WebP로 적절히 축소해 `docs/food-finder/assets/restaurant/{id}/{filename}`에 추가합니다.
5. 해당 ID를 `restaurant-photos.json`의 `actual_photos`에 등록합니다. 필수 필드: `src`, `restaurant_name`, `author`, `license`, `license_url`, `source_page`, `permission_evidence`, `approved_at`, `approved_by`, `kind=restaurant_actual`.
6. `src`는 **동일 사이트의 상대경로**만 허용됩니다. 이슈에 올린 원본 임시 이미지를 그대로 외부 링크로 사용하지 않습니다.

```json
{
  "actual_photos": {
    "2": {
      "kind": "restaurant_actual",
      "src": "./assets/restaurant/2/dakhanmari.webp",
      "restaurant_name": "원조닭한마리",
      "author": "사진 제공자",
      "license": "permission_granted_for_this_website",
      "license_url": "",
      "source_page": "https://...",
      "permission_evidence": "Github issue #번호",
      "approved_at": "YYYY-MM-DD",
      "approved_by": "repo maintainer"
    }
  }
}
```
위 JSON은 **예시이며 현재 실제 승인된 사진이 있다는 의미가 아닙니다.**

웹앱은 승인된 실제 매장 사진이 있으면 먼저 사용하고, 없으면 기존 Wikimedia Commons 메뉴 참고 사진을 사용합니다. 사진을 올린 사람이 이를 회수하거나 재사용 허가를 철회하면 정적 파일 및 메타데이터도 관리자 검토 후 제거해야 합니다.
