> 2026-11-07 최신 결정: 사용자 요청으로 PWA 보류를 해제했습니다. 설치·서비스 워커·앱 셸 캐시·오프라인 재실행을 구현합니다. 아래의 과거 PWA 보류 및 재실행 미지원 문구보다 이 결정이 우선합니다. 백그라운드 동기화·알림·계정·백엔드는 제외합니다. 실제 구현·검증 상태는 README.md를 참조하세요.

# acco-note 데이터 정의서

[확정 정책](policies.md)과 [화면 상세](screens.md)를 구현하기 위한 논리 데이터 모델입니다. 저장소는 IndexedDB이며 백엔드·계정·PWA는 도입하지 않습니다. 이 문서의 저장 필드와 검증은 설계이며 실제 DB 생성·마이그레이션을 수행한 것은 아닙니다.

## 1. 공통 타입과 원칙

| 타입 | 정의 |
| --- | --- |
| ID | 생성 시 UUID 문자열. 영구 개체의 ID는 변경하지 않음 |
| Date | 유효한 YYYY-MM-DD, 한국 날짜. 시간대 변환으로 하루를 이동하지 않음 |
| Month | YYYY-MM, 예산 키 |
| Instant | UTC ISO 8601 시각. 생성·수정·백업 시각 전용 |
| Money | 원화 정수. 거래·환불·저축·목표는 1~999,999,999, 예산·한도는 0~999,999,999 |
| Nullable ID | 미선택은 null, 빈 문자열·가짜 ID 사용 금지 |
| Revision | 1부터 증가하는 정수. 편집 충돌 감지용 |

정수 금액을 저장하고 소수점 비율은 조회 때 계산합니다. 여러 건 합계가 JavaScript 안전 정수 범위를 넘을 수 있으므로 합산은 정확한 정수 연산으로 수행하고 BigInt 또는 동등한 방식으로 표시합니다. 비율은 최종 표시 단계에서만 반올림합니다. 원 단위 숫자를 부동소수로 반올림하여 원장을 변경하지 않습니다.

별도 언급이 없으면 필드는 필수이며 `?`는 null 허용입니다. 모든 ID 기반 행에는 `id`, `revision`, `createdAt`, `updatedAt`이 있습니다. 예산·한도·설정처럼 복합/고정 키를 쓰는 행에는 해당 키와 동일 메타 필드를 사용하되 별도 ID는 두지 않습니다. 공통 메타는 아래 표에서 생략합니다.

삭제된 일반 거래·환불은 복구용 휴지통으로 남기지 않습니다. 반복 식별 정보와 제거 회차 표지는 재생성 방지를 위한 내부 데이터이며 개별 거래 복구 기능이 아닙니다. 사용자에게는 내부 ID·revision을 일반 화면에 표시하지 않습니다.

## 2. 개체와 관계

```text
Category ───────┬── Transaction ───< Refund
PaymentMethod ─┘        │
                        └── occurrenceId? ── RecurrenceOccurrence
                                                  │
RecurrenceRule ───< RecurrenceVersion ──────────────┤
       └─────────< RecurrencePause                 │
       └──────────────────────────────────────────┘

MonthlyBudget ───< CategoryBudget >── Category
SavingsGoal ───< SavingsEntry
Settings / AppMeta / RecoverySnapshot (로컬 운영 정보)
```

거래 하나에는 환불 여러 개가 연결될 수 있습니다. 반복 회차 하나에는 활성 거래가 최대 한 개입니다. 목표 기록은 거래와 연결하지 않습니다. 환불은 분류·결제수단 값을 복제하지 않고 원거래를 통해 조회합니다.

## 3. 저장소와 필드

### D-01. categories

| 필드 | 타입·의미 |
| --- | --- |
| kind | income / expense |
| name | 앞뒤 공백 제거 후 1~30자 |
| normalizedName | name의 영문 대소문자 정규화. 저장·복원 시 재계산 |
| archived | boolean |
| isDefault | 최초 기본 항목 여부. 삭제·보관 권한 차이를 만들지 않음 |

키 `id`, 고유 인덱스 `[kind, normalizedName]`. 같은 유형의 활성·보관 이름을 함께 검사합니다. 참조가 있으면 kind 변경·물리 삭제를 막고 보관만 허용합니다.

### D-02. paymentMethods

| 필드 | 타입·의미 |
| --- | --- |
| name / normalizedName | 1~30자 이름 / 중복 검사용 정규화 |
| type | credit_card / debit_card / cash / bank_transfer / digital_wallet / other |
| paymentDay? | 신용카드 정기 결제일, 1~31 정수 또는 null(미설정). 다른 유형은 null |
| archived | boolean |

키 `id`, 고유 인덱스 `normalizedName`. 이름과 유형은 수정할 수 있습니다. 표시된 과거 수단명도 현재 이름을 따릅니다.

### D-03. transactions

| 필드 | 타입·의미 |
| --- | --- |
| kind | income / expense |
| date | Date, 현재 집계·확정 기준일 |
| amount | Money |
| title / memo | 1~100자 / 0~1,000자 |
| categoryId? | categories 참조. kind 일치 필수 |
| paymentMethodId? | paymentMethods 참조. income이면 null |
| status | scheduled / confirmed |
| occurrenceId? | 반복 생성이면 회차 참조, 일반 거래면 null |

키 `id`, 인덱스 `date`, `[status, date]`, `categoryId`, `paymentMethodId`. `occurrenceId`는 존재할 때만 고유 인덱스에 포함합니다. nullable 필드를 그대로 인덱싱해 일반 거래의 null을 중복 키로 취급하지 않도록 구현합니다.

확정 미래 거래는 불가합니다. 오늘·과거의 scheduled는 앱 미실행·가져오기 직후 처리 전 상태로만 허용하고 도래 처리 대상입니다. occurrenceId가 있으면 kind는 expense입니다. 환불이 있으면 date·amount·kind 변경을 막습니다. 보관 연결의 유지와 신규 선택 제한은 저장 명령에서 이전 값과 비교하여 검증합니다.

### D-04. refunds

| 필드 | 타입·의미 |
| --- | --- |
| transactionId | 확정 expense 거래 참조, 수정 불가 |
| date / amount / memo | 원거래일 이상 오늘 이하 / Money / 최대 1,000자 |

키 `id`, 인덱스 `transactionId`, `date`. 거래별 누적 환불 ≤ 거래 금액. 수정 시 자신의 기존 금액을 합계에서 제외합니다. 환불에는 별도 status·categoryId·paymentMethodId·음수 amount가 없습니다.

### D-05. recurrenceRules

| 필드 | 타입·의미 |
| --- | --- |
| status | active / paused / deleted |
| currentVersionId | 현재 설정 버전 참조 |
| deletedAt? | 삭제한 경우 Instant |
| displayName | 삭제 후 연결 상세에서도 사용할 마지막 내역명 |

키 `id`. 삭제는 사용자 목록에서 제거하되 rule ID와 참조 중인 버전·회차는 보존합니다. 삭제 설정은 새 회차를 만들지 않습니다.

### D-06. recurrenceVersions

반복 설정 변경 전후를 구분하여 재실행·복원 시 과거 회차를 새 설정으로 생성하지 않도록 보존합니다. 버전 행은 생성 후 수정하지 않고 새 버전을 추가합니다.

| 필드 | 타입·의미 |
| --- | --- |
| ruleId | recurrenceRules 참조 |
| versionNumber | rule 안에서 1부터 증가 |
| effectiveFrom | 이 버전을 사용하는 원래 회차일의 하한, 포함 |
| frequency | daily / weekly / monthly / yearly |
| anchorDate | 반복 기준 시작일. 요일·월일을 여기서 파생 |
| endDate? | 원래 회차일 기준 종료일, 포함 |
| title / amount / memo | 생성 거래 기본값 |
| categoryId? / paymentMethodId? | 기본 연결, 지출 카테고리만 허용 |

키 `id`, 고유 `[ruleId, versionNumber]`, 인덱스 `[ruleId, effectiveFrom]`. 같은 effectiveFrom에 여러 버전이 있으면 versionNumber가 가장 큰 버전이 우선합니다. 다음 버전 시작 직전까지가 이전 버전 적용 범위입니다.

최초 버전의 effectiveFrom은 anchorDate와 같습니다. 후속 버전은 변경 적용일을 사용하며 원래 시작일보다 이전 회차를 생성하지 않습니다. 종료일은 해당 버전 anchorDate 이상이어야 합니다. 버전의 과거 분류·수단 참조도 항목 삭제 검사에 포함합니다. 기존 보관 연결은 새 버전에서도 그대로 유지할 수 있으나 다른 보관 항목으로 교체할 수는 없습니다.

설정 변경 직전 도래 처리를 먼저 완료합니다. 일반 변경은 한국 시간 내일부터의 원래 회차에 적용하여 확정된 오늘 회차를 바꾸지 않습니다. 새로운 과거 시작일로 이미 처리한 기간을 소급 생성하지 않습니다. 개별 수정·건너뜀 회차는 버전 범위가 바뀌어도 자체 값과 식별자를 우선합니다. 이 적용 경계는 설정 편집 미리보기에 표시합니다.

### D-07. recurrenceOccurrences

| 필드 | 타입·의미 |
| --- | --- |
| ruleId / sourceVersionId | 원래 반복·생성 버전 참조 |
| originalDate | 반복 규칙으로 산출한 원래 회차일, 변경 불가 |
| state | active / skipped / suppressed |
| individuallyModified | 날짜·금액·내역 등 개별 변경 여부 |
| retainedDraft? | skipped일 때 복원용 거래 값: date·amount·title·memo·categoryId·paymentMethodId |
| suppressionReason? | suppressed일 때 stopped / deleted |

키 `id`, 고유 `[ruleId, originalDate]`, 인덱스 `ruleId`, `sourceVersionId`. 같은 원래 날짜의 회차는 버전이 달라도 하나뿐입니다. 버전 변경으로 같은 날짜가 다시 나오면 기존 확정·개별 수정·건너뜀을 우선합니다.

- active: transactions에 같은 occurrenceId를 가진 행이 정확히 하나. 확정 여부와 거래 값은 해당 거래만이 원본이며 회차에 중복 저장하지 않습니다. retainedDraft와 suppressionReason은 null입니다.
- skipped: 활성 거래가 없어야 하고 retainedDraft가 필수입니다. 생성 거래 삭제 또는 예정 건너뛰기 시 마지막 값을 보존합니다. 환불은 별도로 복원하지 않습니다.
- suppressed: 중지·삭제로 제거된 예정 회차의 내부 표지입니다. 거래·retainedDraft가 없으며 사용자 건너뜀 취소 대상이 아닙니다. 이동된 과거 원래 회차가 다시 만들어지는 것을 막는 데도 사용합니다.
- 중지 후 재개: 원래 회차일이 재개일 이상이며 재개된 규칙에 해당하면 stopped 표지를 active로 재사용할 수 있습니다. 제거했던 개별 수정 값은 복원하지 않고 현 버전 기본값을 사용합니다. 원래 회차일이 재개일 전이면 다시 만들지 않습니다. deleted 표지는 재사용하지 않습니다.

아직 도래하지 않았고 개별 수정하지 않은 예정은 조회 범위의 규칙에서 계산한 **가상 회차**로 표시할 수 있습니다. 조회는 DB를 변경하지 않습니다. 개별 편집·건너뜀·도래 처리 시에만 회차를 저장합니다. 가상 키는 `(ruleId, originalDate)`이며 표시용 키를 영구 ID로 저장하지 않습니다.

### D-08. recurrencePauses

| 필드 | 타입·의미 |
| --- | --- |
| ruleId | 반복 참조 |
| stoppedOn | 중지한 한국 날짜, 이날까지 도래 처리 완료 |
| resumeOn? | 재개 날짜, 해당 날짜부터 생성 허용. null이면 중지 유지 |

키 `id`, 인덱스 `ruleId`. 생성 제외 구간은 `stoppedOn < originalDate < resumeOn`이며 resumeOn이 없으면 이후 전부 제외합니다. 중지 당일 미래로 이동되어 제거된 회차는 D-07 suppressed로 별도 차단합니다. 같은 날 중지·재개는 날짜 구간이 비어도 제거된 개별 변경을 되살리지 않습니다. 겹치는 유효 중지 구간은 저장·복원 시 거부합니다.

재개일이 미래이면 rule.status는 active로 바꾸되 resumeOn 전까지의 구간은 계속 제외하고 화면에는 '재개 예정'을 파생 표시합니다. 다시 중지하면 기존 미래 재개일을 취소하고 열린 중지 구간으로 유지합니다. 이 경우 중지 시작일을 새로 앞당겨 이전 확정 회차를 무효화하지 않습니다.

### D-09. monthlyBudgets / categoryBudgets

| 저장소 | 키 | 필드 |
| --- | --- | --- |
| monthlyBudgets | month | amount: 0~999,999,999 |
| categoryBudgets | [month, categoryId] | amount: 0~999,999,999 |

categoryBudgets의 month는 존재하는 전체 예산을, categoryId는 지출 카테고리를 참조합니다. 같은 월·분류 한도는 하나입니다. 전체 예산 삭제 시 같은 월 한도를 함께 삭제합니다. 설정 없음은 행 부재이고 amount=0과 구분합니다. 사용액·잔여액·초과액·사용률은 저장하지 않습니다.

### D-10. savingsGoals / savingsEntries

| 저장소 | 필드 | 제약 |
| --- | --- | --- |
| savingsGoals | name, targetAmount, startDate, targetDate, archived | 이름 1~100자, 양수 목표액, 목표일 ≥ 시작일 |
| savingsEntries | goalId, date, kind, amount, memo | kind=deposit/withdrawal, 목표 시작일 ≤ date ≤ 오늘, 양수 금액 |

각 키는 `id`. savingsEntries에 `[goalId, date]` 인덱스를 둡니다. 기록 goalId는 수정 불가입니다. 날짜별 저축−인출 누적액이 어느 날짜에서도 음수가 되면 거부합니다. 같은 날짜의 기록은 저축 우선 합산하므로 같은 날 입력 시각으로 잔액 오류를 만들지 않습니다. 기록 있는 목표 삭제 금지, 보관 중 기록 변경 금지. 목표 상태·진행률은 조회 시 계산합니다.

### D-11. settings / appMeta / recoverySnapshots

| 저장소 | 키·필드 | 백업 포함 |
| --- | --- | --- |
| settings | key='preferences', ledgerView=list/calendar | 포함 |
| appMeta | key='state', initialized, onboardingSeen, dbVersion, dataGeneration, changeSequence | 제외 |
| recoverySnapshots | key='beforeImport', capturedAt, snapshot(JSON v1) | 제외 |

dataGeneration은 최초 생성과 성공한 전체 복원마다 새로운 UUID입니다. changeSequence는 데이터 쓰기마다 증가합니다. 레코드 revision과 함께 오래된 편집·미리보기를 감지합니다. DB 구조 버전 dbVersion과 외부 JSON schemaVersion은 별개이며 최초 둘 다 1로 시작합니다.

검색어·조회 기간·스크롤·선택 행·입력 초안은 화면 메모리 상태이며 파일로 내보내지 않습니다. 여러 탭에 변경 통지를 보낼 수 있지만 통지 도착만으로 동시성 안전을 보장하지 않습니다. 실제 검증은 쓰기 트랜잭션 안에서 합니다.

## 4. 쓰기 명령과 원자성

| 명령 | 같은 쓰기 단위에서 검증·변경할 데이터 |
| --- | --- |
| 거래 등록·편집 | 분류·수단 참조와 보관 조건, 연결 환불 제한, 거래·회차 변경, revision·changeSequence |
| 거래 삭제 | 연결 환불 모두 삭제, 거래 삭제, 반복이면 회차 skipped와 retainedDraft 저장 |
| 환불 등록·편집·삭제 | 원거래 상태·금액·날짜, 해당 거래 환불 합계, 환불 행, 원거래 revision 증가 |
| 예정 확정 | 같은 원래 회차 키 존재 검사, 회차·거래 생성 또는 scheduled→confirmed |
| 반복 변경·중지·삭제·재개 | 버전·중지 구간·회차·미래 거래 갱신, 도래 처리 후 새 범위 적용 |
| 목표 기록 변경 | 해당 목표 전체 날짜별 잔액 검증, 기록 변경, 목표 revision 증가 |
| 분류·수단 삭제 | 모든 거래·버전·회차 초안·예산 참조 검사 후 삭제 또는 거부 |
| 월 예산 복사·삭제 | 전체 예산과 해당 월 한도, 대상 덮어쓰기 조건 검사 |
| 전체 복원 | 아래 복원 절차의 모든 도메인 저장소·설정·사본·appMeta |

부모 revision은 자식 변경 때도 증가시켜 원거래·목표의 열린 상세 편집과 충돌을 감지합니다. 모든 쓰기에는 시작 시 읽은 dataGeneration과 대상 revision을 전달합니다. 쓰기 시 달라졌으면 거부하고 입력을 유지합니다. 환불·저축 잔액처럼 여러 행에 걸친 제약은 UI에서 계산한 한도를 믿지 않고 쓰기 트랜잭션에서 다시 계산합니다.

저장 완료 안내는 IndexedDB 트랜잭션 전체 완료 후에만 표시합니다. 브라우저 저장 실패 시 모두 롤백합니다. 합계 캐시는 원장이 아니며 쓰기 성공 후 무효화·재계산합니다. 외부 파일 처리·사용자 확인을 기다리는 동안 DB 쓰기 트랜잭션을 열어 두지 않습니다.

## 5. 반복 처리 알고리즘

1. 처리 시작 시 한국 날짜 T를 고정합니다. 일반 scheduled 거래 중 date ≤ T를 확정 대상으로 읽습니다.
2. 각 반복 버전 적용 구간과 anchorDate·endDate에서 원래 회차일을 계산합니다. 월말 보정 후 다음 날짜를 계산할 때 보정일 대신 anchorDate를 사용합니다.
3. 중지 구간·삭제 상태를 적용하고 T까지의 누락 회차를 찾습니다. 이미 저장된 개별 회차는 규칙보다 우선합니다. date를 미래로 옮긴 active 회차는 originalDate가 지났어도 확정하지 않습니다.
4. 쓰기 단위 안에서 고유 키를 다시 확인하고 없는 회차만 생성합니다. skipped·suppressed는 규칙에 따라 제외합니다. active 거래의 현재 date ≤ T일 때만 confirmed로 만듭니다.
5. 완료 후 집계를 갱신합니다. 다시 실행해도 키와 상태가 같으므로 금액을 누적 가산하지 않습니다. 조회 집계는 항상 원장으로 계산합니다.

새 반복의 과거 시작은 종료일·현재일까지 실제 발생하는 건수와 합계를 미리 계산하고 확인 후 저장합니다. 일반 설정 변경은 내일부터 적용합니다. 아직 확정되지 않았어도 원래 회차일이 과거이고 거래일을 미래로 이동한 개별 회차는 유지합니다. 변경으로 사라진 일반 미래 회차는 거래·회차를 제거하고 새 버전에서 계산합니다. 개별 수정·건너뜀은 제거하지 않습니다.

중지·삭제는 먼저 도래 처리를 완료하고 사용자가 미리보기를 확인한 뒤 적용합니다. 현재 거래일이 미래인 active 회차는 제거하고 suppressed로 남깁니다. 아직 저장되지 않은 미래 회차는 상태·중지 구간으로 막습니다. 미리보기 후 데이터·날짜가 바뀌면 다시 확인합니다.

## 6. 조회와 집계 계약

| 값 | 계산 |
| --- | --- |
| 총수입 | 선택 기간 confirmed income 합계 |
| 환불 전 지출 | 선택 기간 confirmed expense 합계 |
| 환불액 | 환불 date가 선택 기간에 포함된 amount 합계 |
| 순지출 / 차액 | 환불 전 지출−환불액 / 총수입−순지출 |
| 예정액 | scheduled와 아직 저장 안 된 가상 회차. 같은 원래 키는 한 번만 합산 |
| 분류·수단별 환불 | 환불 원거래의 현재 categoryId/paymentMethodId로 묶음 |
| 사용 횟수 | 해당 수단의 기간 내 confirmed expense 건수, 환불 횟수 차감 없음 |
| 비중 | 그룹 환불 전 지출 / 전체 환불 전 지출. 분모 0이면 null로 반환하여 '—' 표시 |
| 예산 | 해당 월 순지출, 잔여=한도−사용액, 초과=max(사용액−한도,0) |
| 목표 잔액 | goalId의 deposit 합계−withdrawal 합계 |

필터별 OR와 조건 간 AND를 사용합니다. 확정 상태 필터는 환불을 포함하고 환불은 지출 유형입니다. 키워드는 거래에서는 title·memo, 환불에서는 원거래 title·환불 memo를 검색합니다. 가상 회차·건너뜀은 현재 투영/retainedDraft로 필터링합니다. 필터 합계는 결과 기록에서 계산하며 기간 전체 요약과 구분합니다. 조회용 합계를 거래 행으로 저장하지 않습니다.

## 7. JSON v1 계약

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-11-07T03:00:00.000Z",
  "timezone": "Asia/Seoul",
  "currency": "KRW",
  "data": {
    "categories": [], "paymentMethods": [],
    "transactions": [], "refunds": [],
    "recurrenceRules": [], "recurrenceVersions": [],
    "recurrenceOccurrences": [], "recurrencePauses": [],
    "monthlyBudgets": [], "categoryBudgets": [],
    "savingsGoals": [], "savingsEntries": [],
    "settings": { "ledgerView": "list" }
  }
}
```

모든 배열 키는 필수이며 비어 있을 수 있습니다. 예시는 빈 저장소의 구조를 나타냅니다. 각 행은 D-01~D-10의 필드와 메타를 사용합니다. null 허용 필드는 null로 내보냅니다. normalizedName은 내보내지 않고 검증 시 name에서 계산합니다. settings는 위 보기 설정만 내보냅니다. 합계·가상 회차·로컬 운용 정보·사본은 제외합니다. 내보내기는 일관된 읽기 스냅샷에서 수집합니다.

버전 1에 정의되지 않은 필드·열거값·누락 필드는 오류로 처리합니다. JSON 객체의 중복 속성 이름도 허용하지 않으며 파싱 시 검출 가능한 검증 경로를 사용합니다. 개체별 ID 고유성, 복합 키 고유성, 모든 참조와 정책 불변식을 검사합니다. ID가 다른 동일 내용의 일반 거래를 중복이라는 이유로 삭제하지 않습니다. sourceVersionId의 ruleId와 occurrence.ruleId가 같아야 합니다.

### 복원 순서

1. 파일을 메모리에서 파싱·검증합니다. 저장소를 비우지 않습니다. normalizedName·도래 회차·집계를 계산하고 미리보기를 구성합니다.
2. 현재 dataGeneration·changeSequence·한국 날짜를 미리보기와 함께 보관합니다. 사용자 확인 후 값이 달라지면 새 미리보기로 재확인합니다.
3. 기존 도메인 데이터를 JSON v1 사본으로 준비하고 적용할 새 데이터와 도래 회차를 준비합니다. 대용량 준비가 불가능하면 오류로 종료하고 기존 데이터는 유지합니다.
4. 모든 관련 저장소를 포함한 하나의 쓰기 트랜잭션에서 위 동시성 토큰을 재검사합니다. recoverySnapshots의 단일 사본을 기존 데이터로 교체하고, 도메인 데이터를 전체 대체하며 준비한 자동 확정을 적용합니다.
5. 새로운 dataGeneration을 만들고 changeSequence를 증가시킵니다. 실패 시 사본 변경까지 전부 롤백하여 이전 성공 복원의 사본도 유지합니다. 성공 시 현재 사본은 방금 대체한 데이터입니다.
6. 모든 열린 화면에 변경을 통지하고 조회를 다시 로드합니다. 이전 dataGeneration의 편집은 저장할 수 없습니다. 가져온 데이터에 기본 카테고리를 다시 합치지 않습니다.

브라우저 종료가 적용 중 발생해도 복원은 전체 성공 또는 전체 미적용이어야 합니다. 가져온 revision·ID는 보존할 수 있지만 새 dataGeneration으로 복원 전 편집과 구분합니다. 복원 직전 사본 저장 공간까지 포함해 실제 쓰기가 성공해야만 완료 처리합니다.

## 8. 설계 검증 사례

| 사례 | 데이터 기대값 |
| --- | --- |
| 매월 31일, 2월 말일 회차 | originalDate는 2월 말일, 다음 회차는 anchorDate 기준 3월 31일 |
| 확정 회차 날짜를 미래로 변경 | 같은 occurrenceId·originalDate, 거래 date만 변경하고 scheduled |
| 같은 회차 동시 확정 | [ruleId, originalDate]와 occurrenceId 고유성으로 거래 한 개 |
| 회차 거래 삭제 후 건너뜀 취소 | retainedDraft로 새 거래 생성, 기존 환불 없음, date 기준 상태 계산 |
| 원래 과거 회차를 미래로 옮긴 뒤 중지 | 미래 거래 제거·suppressed 유지, 원래 과거 회차 재생성 없음 |
| 다른 탭에서 환불 추가 후 원거래 금액 편집 저장 | 부모 revision 충돌 또는 환불 존재 검증으로 거부 |
| 보관 분류가 있는 예산 복사 | 원본 유지, 대상에는 활성 분류 한도만 생성 |
| 과거 저축 삭제가 이후 인출 잔액을 음수로 만듦 | 쓰기 취소, 목표·기록 revision 유지 |
| 복원 사본 보존 후 DB 쓰기 실패 | 전체 롤백, 기존 도메인 데이터와 이전 사본 유지 |
| 동일 백업 재복원 | 데이터 병합 없음, 도래분 한 번만 존재, 새 dataGeneration |

다음 구현 단계에서는 이 모델을 타입·저장소·입력 검증·계산 함수로 옮기고, 위 사례와 정책 P-10의 실제 동작을 테스트합니다.
