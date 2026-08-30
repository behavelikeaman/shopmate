# Step 2: types-and-lib

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — 데이터 모델, 배송비 규칙
- `/docs/ADR.md` — ADR-004(TDD 범위), ADR-005(정수 금액), ADR-007(장바구니 병합), ADR-012(판매자별 배송비), ADR-015(계산 이중화 수용)
- `/docs/PRD.md` — 규칙 절
- `/CLAUDE.md`
- `/supabase/migrations/0001_schema.sql` — 컬럼명·타입을 여기에 맞춘다

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

공유 타입과 순수 함수를 만든다. **순수 함수는 TDD다 — 테스트를 먼저 쓰고, 실패를 확인한 뒤, 통과시켜라** (CLAUDE.md CRITICAL, ADR-004).

### 1. 테스트 러너 도입

`vitest`를 devDependency로 추가하고 `package.json`에 `"test": "vitest run"`을 넣는다. `vitest.config.ts`에서 `@/*` alias를 `tsconfig.json`과 동일하게 해석하게 한다.

### 2. `src/types/index.ts`

DB는 snake_case, 앱 타입은 camelCase다. 변환은 Step 3의 `services/`가 담당한다. 여기서는 앱 타입만 정의한다.

```ts
export type Role = 'customer' | 'seller' | 'admin'
export type GroupStatus = 'paid' | 'shipped' | 'cancelled'

export type Seller = { id: string; storeName: string }
export type Product = { id, name, description, price, imageUrl, category, stock, createdAt, seller: Seller }

export type CartLine = { productId: string; quantity: number }      // 저장/전송용 최소 단위
export type CartLineView = CartLine & { product: Product }          // 화면에 그릴 때

export type SellerGroup = {                                          // 판매자별 묶음
  seller: Seller
  lines: CartLineView[]
  subtotal: number
  shippingFee: number
}
export type CartTotals = { subtotal: number; shippingTotal: number; total: number }

export type ShippingInfo = { name: string; phone: string; address: string }

export type OrderItem = { id, productId: string | null, nameSnapshot, unitPrice, quantity }
export type OrderGroup = {
  id, seller: Seller, status: GroupStatus,
  subtotal, shippingFee, items: OrderItem[],
  shippedAt: string | null, cancelledAt: string | null
}
export type Order = { id, shipping: ShippingInfo, createdAt, groups: OrderGroup[] }
```

`Order`에 `totalAmount` 필드를 두지 마라. 총액은 그룹 합으로 계산한다 (ADR-010). 계산은 아래 `calculateOrderTotals`가 한다.

### 3. `src/lib/pricing.ts` (TDD)

```ts
export const FREE_SHIPPING_THRESHOLD = 50000
export const SHIPPING_FEE = 3000

export function formatPrice(amount: number): string
// "12,000원" 형태. 0이면 "0원". 음수는 호출자 버그이므로 그대로 포맷하되 테스트로 동작을 고정한다.

export function groupBySeller(lines: CartLineView[]): SellerGroup[]
// 판매자별로 묶고, 그룹마다 subtotal 과 shippingFee 를 채워 돌려준다.
//   subtotal    = Σ(product.price * quantity)  — 전부 정수 연산
//   shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
// 그룹 순서는 결정적이어야 한다 (예: 스토어명 오름차순). 순서가 흔들리면 화면이 매번 달라진다.
// 입력 배열을 변형하지 마라.

export function calculateOrderTotals(groups: SellerGroup[]): CartTotals
// subtotal      = Σ groups[].subtotal
// shippingTotal = Σ groups[].shippingFee
// total         = subtotal + shippingTotal
// groups 가 비어 있으면 전부 0

export function remainingForFreeShipping(group: SellerGroup): number
// 무료배송까지 남은 금액. 이미 무료면 0.
```

**배송비는 판매자 그룹마다 따로 계산한다** (ADR-012). 주문 전체 소계로 판정하면 안 된다.

테스트로 반드시 고정할 케이스:
- 빈 배열 → 그룹 0개, 합계 전부 0
- 판매자 1명 / 2명 이상
- 그룹 소계가 정확히 50000(무료), 49999(3000원)
- 한 그룹은 무료, 다른 그룹은 유료인 혼합 케이스
- **주문 전체 합은 50000을 넘지만 각 그룹은 미달** → 두 그룹 모두 배송비가 붙어야 한다 (이 규칙의 핵심)
- 그룹 순서의 결정성
- 입력 불변성

### 4. `src/lib/cart.ts` (TDD)

```ts
export function mergeCartLines(
  local: CartLine[], server: CartLine[], stockByProductId: Record<string, number>,
): CartLine[]
// 같은 productId 는 수량 합산 (ADR-007). 합산 결과가 재고를 넘으면 재고로 클램프.
// stockByProductId 에 없거나 재고가 0인 상품은 결과에서 제외 (삭제·품절).
// 입력 배열을 변형하지 마라.

export function clampQuantity(quantity: number, stock: number): number
// 1 미만이면 0(=삭제 의도), stock 초과면 stock, 정수가 아니면 내림.
```

테스트: 양쪽 빈 배열, 한쪽만 있음, 겹치는 상품 합산, 재고 초과 클램프, 재고 0 제외, 목록에 없는 상품 제외, 입력 불변성.

### 5. `src/lib/validation.ts` (TDD)

```ts
export function validateShipping(input: Partial<ShippingInfo>): { ok: boolean; errors: Partial<Record<keyof ShippingInfo, string>> }
// name: 공백 제거 후 1자 이상
// phone: 숫자와 하이픈만, 숫자 9~11자리
// address: 공백 제거 후 5자 이상
// 에러 메시지는 한국어 한 줄.
```

### 6. `src/lib/order-status.ts` (TDD)

```ts
export function canCancelGroup(status: GroupStatus): boolean       // 'paid' 일 때만 true
export function canShipGroup(status: GroupStatus): boolean         // 'paid' 일 때만 true
export function statusLabel(status: GroupStatus): string           // 발송 준비중 / 발송 완료 / 취소됨
```

표기 문자열은 `docs/UI_GUIDE.md`의 "주문 상태" 표와 일치해야 한다.

## Acceptance Criteria

```bash
npm run test    # 모든 테스트 통과
npm run build   # 타입 에러 없음
npm run lint    # lint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 순수 함수가 전부 `src/lib/`에 있는가?
   - **배송비가 그룹별로 계산되는가?** 주문 전체 소계로 판정하는 코드가 없는가? (ADR-012)
   - 금액 계산에 부동소수 연산이 섞이지 않았는가? (ADR-005)
   - `Order` 타입에 `totalAmount` 필드를 만들지 않았는가? (ADR-010)
   - 테스트를 먼저 작성했는가?
3. `phases/0-mvp/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "정의한 타입과 lib 함수 시그니처, 테스트 개수"`
   - 실패 → `"status": "error"` + `error_message` / 개입 필요 → `"status": "blocked"` + `blocked_reason`

## 금지사항

- Supabase에 접속하거나 `@supabase/*` 패키지를 설치하지 마라. 이유: Step 3의 범위다. 이 step의 함수는 DB를 전혀 모르는 순수 함수여야 테스트가 싸다.
- React 컴포넌트를 만들지 마라. 이유: Step 8의 범위다.
- 배송비를 주문 전체 기준으로 계산하지 마라. 이유: 판매자마다 실제로 물건을 부치므로 그룹별이어야 한다 (ADR-012).
- 금액을 `toFixed()`나 실수 연산으로 다루지 마라. 이유: 합계에 오차가 누적된다.
- 날짜·통화 포맷을 위해 새 라이브러리(dayjs, currency.js 등)를 설치하지 마라. 이유: `Intl`로 충분하다.
- 기존 테스트를 깨뜨리지 마라.
