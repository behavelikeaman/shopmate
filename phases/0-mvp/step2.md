# Step 2: types-and-lib

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (데이터 모델, 배송비 규칙)
- `/docs/ADR.md` (ADR-004 TDD 범위, ADR-005 정수 금액, ADR-007 장바구니 병합)
- `/docs/PRD.md` (규칙 절)
- `/CLAUDE.md`
- `/supabase/migrations/0001_schema.sql` (컬럼명·타입을 여기에 맞춘다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

공유 타입과 순수 함수를 만든다. **순수 함수는 TDD다 — 테스트를 먼저 쓰고, 실패를 확인한 뒤, 통과시켜라** (CLAUDE.md CRITICAL, ADR-004).

### 1. 테스트 러너 도입

`vitest`를 devDependency로 추가하고 `package.json`에 `"test": "vitest run"` 스크립트를 넣는다. `vitest.config.ts`에서 `@/*` alias를 `tsconfig.json`과 동일하게 해석하도록 설정한다.

### 2. `src/types/index.ts`

DB row 타입과 화면용 타입을 정의한다. 시그니처만 제시하니 내부는 재량껏 채워라:

```ts
export type Role = 'customer' | 'admin'
export type OrderStatus = 'paid' | 'shipped' | 'cancelled'

export type Product = { id, name, description, price, imageUrl, category, stock, createdAt }
export type CartLine = { productId: string; quantity: number }        // 저장/전송용 최소 단위
export type CartLineView = CartLine & { product: Product }            // 화면에 그릴 때
export type CartTotals = { subtotal: number; shippingFee: number; total: number }
export type ShippingInfo = { name: string; phone: string; address: string }
export type OrderItem = { id, productId: string | null, nameSnapshot, unitPrice, quantity }
export type Order = { id, status: OrderStatus, subtotal, shippingFee, totalAmount, shipping: ShippingInfo, createdAt, items: OrderItem[] }
```

DB는 snake_case, 앱 타입은 camelCase다. 변환은 Step 3의 `services/`가 담당한다. 여기서는 앱 타입만 정의한다.

### 3. `src/lib/pricing.ts` (TDD)

```ts
export const FREE_SHIPPING_THRESHOLD = 50000
export const SHIPPING_FEE = 3000

export function formatPrice(amount: number): string
// "12,000원" 형태. 0이면 "0원". 음수는 호출자 버그이므로 그대로 포맷하되 테스트로 동작을 고정한다.

export function calculateTotals(lines: CartLineView[]): CartTotals
// subtotal = Σ(product.price * quantity), 전부 정수 연산
// shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
// 단, lines가 비어 있으면 shippingFee = 0 (빈 장바구니에 배송비를 붙이지 않는다)
// total = subtotal + shippingFee
```

테스트로 반드시 고정할 케이스: 빈 배열, 임계값 정확히 50000(무료), 49999(3000원), 수량 2 이상, 여러 상품 합산.

### 4. `src/lib/cart.ts` (TDD)

```ts
export function mergeCartLines(
  local: CartLine[],
  server: CartLine[],
  stockByProductId: Record<string, number>,
): CartLine[]
// 같은 productId는 수량을 합산한다 (ADR-007).
// 합산 결과가 재고를 넘으면 재고 수량으로 클램프한다.
// stockByProductId에 없거나 재고가 0인 상품은 결과에서 제외한다 (삭제·품절된 상품).
// 입력 배열을 변형하지 마라(순수 함수).

export function clampQuantity(quantity: number, stock: number): number
// 1 미만이면 0(=삭제 의도), stock 초과면 stock. 정수가 아니면 내림.
```

테스트로 반드시 고정할 케이스: 양쪽 빈 배열, 한쪽만 있음, 겹치는 상품 합산, 재고 초과 클램프, 재고 0 제외, stockByProductId에 없는 상품 제외, 입력 불변성.

### 5. `src/lib/validation.ts` (TDD)

```ts
export function validateShipping(input: Partial<ShippingInfo>): { ok: boolean; errors: Partial<Record<keyof ShippingInfo, string>> }
// name: 공백 제거 후 1자 이상
// phone: 숫자와 하이픈만, 숫자 9~11자리
// address: 공백 제거 후 5자 이상
// 에러 메시지는 한국어 한 줄.
```

## Acceptance Criteria

```bash
npm run test    # 모든 테스트 통과
npm run build   # 타입 에러 없음
npm run lint    # lint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 순수 함수가 전부 `src/lib/`에 있는가? (`services/`나 컴포넌트에 로직이 새지 않았는가)
   - 금액 계산에 부동소수 연산이나 `numeric` 문자열이 섞이지 않았는가? (ADR-005)
   - 테스트를 먼저 작성했는가? (CLAUDE.md CRITICAL)
3. 결과에 따라 `phases/0-mvp/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "정의한 타입과 lib 함수 시그니처, 테스트 개수"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- Supabase에 접속하거나 `@supabase/*` 패키지를 설치하지 마라. 이유: Step 3의 범위다. 이 step의 함수는 DB를 전혀 모르는 순수 함수여야 테스트가 싸다.
- React 컴포넌트를 만들지 마라. 이유: Step 7의 범위다.
- 금액을 `toFixed()`나 실수 연산으로 다루지 마라. 이유: 합계에 오차가 누적된다 (ADR-005).
- 날짜·통화 포맷을 위해 새 라이브러리(dayjs, currency.js 등)를 설치하지 마라. 이유: `Intl`로 충분하며, 외부 의존성 최소화가 이 프로젝트의 철학이다.
- 기존 테스트를 깨뜨리지 마라.
