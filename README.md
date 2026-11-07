# 아코 노트

브라우저의 IndexedDB에 기록을 저장하는 개인 가계부 PWA입니다. 계정이나 기기 간 동기화 없이 이 브라우저에서 사용합니다.

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

온라인으로 한 번 열어 ‘오프라인 재실행 준비 완료’를 확인한 뒤 오프라인으로 이용할 수 있습니다. 설치 가능한 브라우저에는 설치 버튼이 나타납니다. iOS는 Safari의 공유 → 홈 화면에 추가를 사용합니다. 배포 시 HTTPS와 루트 경로(`/`)가 필요합니다. 서비스 워커 자산을 바꿀 때 `public/sw.js`의 캐시 버전도 갱신합니다.

앱이 닫힌 동안 백그라운드 작업·알림·서버 동기화는 수행하지 않습니다. 반복 거래의 도래 처리는 앱을 다시 열 때 및 열린 상태에서 수행합니다. 브라우저가 사이트 저장소를 제거하면 캐시·기록도 제거될 수 있습니다.

## 검증

- `npm.cmd run check`: 구문 검사.
- `npm.cmd run test:unit`: 도메인·백업 단위 테스트 33개.
- `npm.cmd run test:integration`: 저장소 통합 테스트 8개(fake-indexeddb).
- `npm.cmd run test:core`: 위 두 묶음 실행.
- `npm.cmd run test:browser`: 실제 브라우저 통합·E2E·사용성 테스트 18개.
- `npm.cmd run test:preview`: 기존 무저장 퍼블리싱 회귀 15개.
- `npm.cmd run test:ui`: 브라우저 전체 33개.
- `npm.cmd run test:coverage`: 핵심 모듈 3개의 Node 테스트 커버리지.
- `npm.cmd test`: 구문 검사와 전체 테스트 74개.

[테스트 계획](TESTING.txt), [실행 결과](artifacts/tests/results.txt), [전체 실행 로그](artifacts/tests/full-run.txt), [커버리지](artifacts/tests/coverage.txt).

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
