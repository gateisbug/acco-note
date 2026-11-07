# 아코 노트

브라우저의 IndexedDB에 기록을 저장하는 개인 가계부 PWA입니다. 계정이나 기기 간 동기화 없이 이 브라우저에서 사용합니다.

앱 버전 **0.1.0** · PWA **v1** · IndexedDB 스키마 **1**

## GitHub Pages 배포

이 프로젝트는 별도 백엔드 없이 정적 호스팅으로 동작합니다. GitHub Actions가 테스트 후 `public/`을 `dist/`로 준비하고, `dist/`만 Pages에 배포합니다. 저장소 루트의 문서·테스트 로그·개인 백업 파일을 배포 대상으로 지정하지 않습니다.

1. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
2. `.github/workflows/pages.yml`을 포함한 변경을 `main` 브랜치에 커밋하고 푸시합니다.
3. **Actions → Deploy GitHub Pages**에서 `build`, `deploy` 완료 여부를 확인합니다. 이미 파일이 올라가 있다면 **Run workflow**로 시작할 수 있습니다.
4. 배포 성공 후 **Settings → Pages → Visit site**로 접속합니다.

현재 저장소의 기본 배포 주소는 **https://gateisbug.github.io/acco-note/** 입니다. 이는 예상 주소이며 실제 배포 완료 여부는 GitHub Actions에서 확인해야 합니다. `Deploy from a branch`는 사용하지 않습니다.

워크플로는 `main`에 푸시할 때마다 자동 실행합니다. `npm ci` → 구문 검사 → 단위·저장소 통합 테스트 → Pages 빌드 → 업로드 → 배포 순서입니다. 테스트 실패 시 배포 단계로 넘어가지 않습니다. 실제 Edge 브라우저 테스트는 로컬의 `npm run test:ui`로 별도 실행합니다.

수동으로 배포 파일만 만들려면:

```sh
npm ci
npm run build:pages
```

결과는 `dist/`에 생성됩니다. CSS·JS·manifest·서비스 워커는 `/acco-note/`와 같은 하위 경로를 지원합니다. PWA 버전은 `v1`이며, 빌드 스크립트가 파일 내용의 해시를 캐시 식별자에 추가해 새 배포를 감지합니다. 앱/DB 스키마 버전은 빌드할 때 자동 증가하지 않습니다.

첫 배포 후 온라인으로 접속해 **관리 → 백업·복원 → 오프라인 재실행 준비 완료**를 확인하세요. 업데이트가 표시되면 입력을 저장한 뒤 업데이트합니다. 로컬 주소와 GitHub Pages는 서로 다른 저장소를 사용하므로 기존 기록은 로컬에서 JSON 내보내기 후 배포 사이트에서 가져와야 합니다.

문제 해결:

- 404: Pages의 Source가 GitHub Actions인지, 워크플로가 `main`에 있는지, 배포가 성공했는지 확인합니다.
- 권한 오류: 워크플로의 `pages: write`, `id-token: write`와 `github-pages` 환경 보호 규칙을 확인합니다.
- 이전 화면: 앱의 업데이트 안내를 확인합니다. 기록 보존이 필요하면 사이트 데이터 삭제 전에 JSON 백업을 내려받습니다.

[GitHub 공식 배포 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 실행

`npm.cmd install` 후 `npm.cmd run dev`로 실행합니다. [아코 노트 열기](http://127.0.0.1:4173). 파일을 직접 여는 대신 HTTP 서버로 실행해야 합니다.

## 구현 기능

- 거래 추가·수정·삭제, 선택 삭제, 부분 환불, 검색·필터, 무한 스크롤, 달력·통계.
- 전체·카테고리 월 예산, 이전 달 복사, 환불을 반영한 남은 예산.
- 저축 목표와 입금·인출, 날짜별 잔액 검증, 완료 목표 접기.
- 고정지출 반복 생성, 수정 버전, 중지·재개, 회차 건너뛰기·취소, 중복 생성 방지.
- 카테고리·결제수단 관리 및 보관, 카드 결제일 표시와 카드별 조회.
- JSON 백업·검증·전체 복원, 복원 직전 사본 다운로드, 저장 실패 및 다중 탭 충돌 처리.
- PWA 설치, 앱 셸 캐시, 오프라인 재실행·입력·조회, 새 버전 업데이트 안내.

처음에는 기본 카테고리만 생성합니다. 실제 거래는 샘플 없이 시작합니다. 기존 무저장 퍼블리싱은 `/preview.html`에 보존했습니다.

## 저장과 PWA

관리 → 백업에서 JSON 파일을 내려받습니다. 브라우저 데이터를 지우거나 다른 브라우저·기기로 이동하면 기존 기록에 접근할 수 없으므로 백업을 보관하세요. 복원은 전체 대체이며 검증 실패 시 기존 데이터를 유지합니다.

온라인으로 한 번 열어 ‘오프라인 재실행 준비 완료’를 확인한 뒤 오프라인으로 이용할 수 있습니다. 설치 가능한 브라우저에는 설치 버튼이 나타납니다. iOS는 Safari의 공유 → 홈 화면에 추가를 사용합니다. 배포 시 HTTPS가 필요하며 루트 및 프로젝트 하위 경로를 지원합니다. 배포 파일은 `npm run build:pages`로 생성하면 캐시 식별자가 자동 갱신됩니다.

IndexedDB는 경로가 아닌 출처(origin)별로 저장됩니다. 같은 `gateisbug.github.io` 도메인의 다른 경로에 아코 노트를 복제하면 DB를 공유하므로 별도 사용자 공간으로 취급하지 마세요. 서비스 워커 캐시는 프로젝트 경로별로 구분합니다.

앱이 닫힌 동안 백그라운드 작업·알림·서버 동기화는 수행하지 않습니다. 반복 거래의 도래 처리는 앱을 다시 열 때 및 열린 상태에서 수행합니다. 브라우저가 사이트 저장소를 제거하면 캐시·기록도 제거될 수 있습니다.

## 검증

- `npm.cmd run check`: 구문 검사.
- `npm.cmd run test:unit`: 도메인·백업 단위 테스트 33개.
- `npm.cmd run test:integration`: 저장소 통합 테스트 8개(fake-indexeddb).
- `npm.cmd run test:core`: 위 두 묶음 실행.
- `npm.cmd run test:browser`: 실제 브라우저 통합·E2E·사용성 테스트 18개.
- `npm.cmd run test:preview`: 기존 무저장 퍼블리싱 회귀 15개.
- `npm.cmd run test:pages`: Pages 하위 경로·오프라인·캐시 격리 2개.
- `npm.cmd run test:ui`: 브라우저 전체 35개.
- `npm.cmd run test:coverage`: 핵심 모듈 3개의 Node 테스트 커버리지.
- `npm.cmd test`: 구문 검사와 전체 테스트 76개.

[테스트 계획](TESTING.txt), [실행 결과](artifacts/tests/results.txt), [전체 실행 로그](artifacts/tests/full-run.txt), [커버리지](artifacts/tests/coverage.txt).

위 결과 파일은 Pages 지원 추가 전 74개 테스트의 기록입니다. Pages 테스트 2개는 `tests/pages.spec.cjs`에서 배포 산출물을 생성해 `/acco-note/` 접속, 오프라인 저장·재실행, 다른 프로젝트 캐시 보존을 검증합니다.

2026-11-07 위 검사 통과. 실제 앱 320·768·1440px 화면 넘침과 axe 접근성 검사, 오프라인 재실행·저장, 저장 실패, 복원 및 탭 충돌을 포함합니다. 스크린샷은 `test-results/`에 생성됩니다. 설치된 Microsoft Edge로 검증했으며 Safari·Firefox·실제 모바일 설치는 별도 실기 확인 대상입니다.

`npm.cmd run audit:ui`는 기존 `/preview.html`의 108개 화면 상태를 검사합니다. `artifacts/ui-audit/report.html`은 퍼블리싱 점검 결과이며 실제 저장 기능 검증 결과와 구분합니다.

사용성 개선: 조회 조건을 목록·달력·통계에 공통 적용하고 월 전체 예산의 범위를 별도로 표시합니다. 연속 입력은 직전 날짜·유형·카테고리·결제수단을 유지합니다. 검색 입력칸은 한글 조합 중 재생성하지 않습니다. 모바일 검색과 터치 영역을 확대하고 상세는 선택한 항목 옆에 표시하며 닫을 때 포커스를 돌려줍니다. 카테고리 예산은 접어서 선택 입력하고, 선택 삭제는 현재 표시 항목과 조회 결과 전체를 구분합니다. 미달성 보관 목표는 완료 목표와 별도 접이식 목록에 표시합니다.

## 구성과 설계

- `public/live.js`, `live.css`: 실제 화면과 입력 흐름.
- `public/core/domain.js`, `store.js`, `backup.js`: 도메인 규칙·IndexedDB 트랜잭션·백업 검증.
- `public/ui-components.*`, `ui-inputs.js`, `ako-theme.css`: 공통 UI·금액·날짜 입력·테마.
- `public/manifest.webmanifest`, `sw.js`, `pwa.js`: 설치·캐시·업데이트.
- Flatpickr와 Lucide는 로컬 vendor 파일로 제공하며 라이선스를 포함합니다.
- [정책 결정](DECISION.md), [요구사항](_context/user/prd.md), [정책](_context/user/policies.md), [기능](_context/user/functions.md), [화면](_context/user/screens.md), [데이터](_context/user/data-model.md).
