# Step 6: checkout-orders

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (데이터 흐름의 [주문 생성] 절 — 이 step의 핵심)
- `/docs/ADR.md` (ADR-003 모의 결제, ADR-005 정수 금액, ADR-006 스냅샷)
- `/docs/PRD.md` (규칙 절 — 재고 부족 시 주문 실패, 가격 스냅샷)
- `/CLAUDE.md` (금액 재계산 CRITICAL 규칙)
- `/src/lib/pricing.ts`, `/src/lib/validation.ts`
- `/src/services/cart.ts`, `/src/services/products.ts`, `/src/services/auth.ts`
- `/src/app/cart/actions.ts`
- `/supabase/migrations/0001_schema.sql`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

체크아웃과 주문을 만든다. **이 step이 이 프로젝트에서 가장 중요한 부분이다** — 돈이 계산되는 곳이다.

### 1. `src/services/orders.ts`

```ts
export async function createOrder(userId: string, shipping: ShippingInfo): Promise<
  { ok: true; orderId: string } | { ok: false; error: string }
>
export async function listOrders(userId: string): Promise<Order[]>
export async function getOrder(userId: string, orderId: string): Promise<Order | null>
```

`createOrder`의 절차 — **순서를 지켜라**:

1. `getCartLines(userId)`로 서버 장바구니를 읽는다. 비어 있으면 `{ ok: false, error: '장바구니가 비어 있습니다' }`.
2. 해당 상품들의 **현재 가격과 재고를 DB에서 다시 읽는다.** 클라이언트나 장바구니 화면이 보낸 금액은 전부 버린다 (CLAUDE.md CRITICAL).
3. 재고가 부족한 상품이 하나라도 있으면 주문 전체를 실패시키고 어떤 상품이 몇 개 부족한지 메시지에 담는다. **부분 주문을 만들지 마라** (PRD 규칙).
4. `calculateTotals()`로 소계·배송비·합계를 계산한다. 이 함수를 다시 구현하지 마라.
5. `orders` 1행 + `order_items` N행을 INSERT한다. `order_items`에는 **주문 시점의 상품명(`name_snapshot`)과 단가(`unit_price`)를 복사해 넣는다** (ADR-006). 나중에 조회할 때 `products`를 조인해 현재 가격을 읽지 마라.
6. 각 상품의 `stock`을 주문 수량만큼 차감한다.
7. `clearCart(userId)`로 장바구니를 비운다.
8. 결제는 모의이므로 `status`는 생성 시점에 `'paid'`다 (ADR-003).

원자성에 대해:
- 이 흐름은 여러 쿼리에 걸쳐 있으므로 애플리케이션 코드만으로는 원자적이지 않다. **가능하면 Postgres 함수(`create_order(p_user_id, p_shipping ...)`)로 내려 트랜잭션 안에서 처리하고, `services/orders.ts`는 그 RPC를 호출만 하라.** 이 경우 `supabase/migrations/0004_create_order.sql`을 추가한다.
- RPC 방식을 택했다면 재고 차감은 `update products set stock = stock - $n where id = $id and stock >= $n`처럼 **조건부 UPDATE**로 하고, 영향 행이 0이면 예외를 던져 롤백시킨다. `select` 후 `update`하면 동시 주문에서 재고가 음수가 된다.
- RPC를 쓰지 않기로 했다면, 실패 지점마다 이미 쓴 데이터를 되돌리는 보상 로직을 반드시 넣고 그 한계를 summary에 명시하라.

### 2. `src/app/checkout/` — 체크아웃

- `page.tsx`: 로그인 필수(`requireUser()`). 장바구니 요약(상품·수량·소계·배송비·합계) + 배송지 폼.
- `actions.ts`: `placeOrderAction(formData)` — `validateShipping()`으로 검증 → `createOrder()` → 성공 시 `/orders/{id}`로 redirect, 실패 시 에러 문자열 반환.
- 주문 버튼은 제출 중 비활성화한다(중복 클릭 방지). 다만 **UI의 비활성화를 중복 주문 방지 수단으로 믿지 마라** — 서버가 빈 장바구니를 거부하는 것이 실제 방어다.

### 3. `src/app/orders/` — 주문 내역

- `page.tsx`: 내 주문 목록 (주문번호 일부, 날짜, 상태, 합계, 대표 상품명).
- `[id]/page.tsx`: 주문 상세 (품목별 스냅샷 상품명·단가·수량, 소계/배송비/합계, 배송지). 남의 주문 id로 접근하면 `notFound()` — RLS가 이미 막지만 UI도 404를 보여야 한다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. 담기 → 체크아웃 → 주문 완료 → /orders 에 나타난다
# 2. Supabase에서 해당 상품 stock 이 주문 수량만큼 줄었다
# 3. 주문 후 장바구니가 비었다
# 4. 재고 1개짜리 상품을 2개 주문 시도 → 주문 실패 + 재고가 줄지 않았다
# 5. 주문 후 대시보드에서 상품 가격을 바꿔도 기존 주문 금액은 그대로다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 주문 합계가 **서버에서 DB 가격으로** 재계산되는가? 클라이언트가 보낸 금액을 쓰는 경로가 하나도 없는가? (CLAUDE.md CRITICAL)
   - `order_items`에 `name_snapshot`·`unit_price`가 실제로 저장되는가? 주문 조회가 `products`를 조인해 현재 가격을 읽지는 않는가? (ADR-006)
   - 재고 차감이 조건부 UPDATE거나 트랜잭션 안에 있는가?
   - 금액이 전부 정수 연산인가? (ADR-005)
3. 결과에 따라 `phases/0-mvp/index.json`의 step 6을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "주문 생성 방식(RPC 여부), 생성한 파일, 원자성 처리 방법"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 클라이언트가 보낸 가격·소계·합계를 저장하지 마라. 이유: 브라우저에서 값을 조작해 1원짜리 주문을 만들 수 있다.
- `order_items` 조회 시 `products`를 조인해 현재 가격을 표시하지 마라. 이유: 상품 가격이 바뀌면 과거 주문 금액이 소급 변경된다 (ADR-006).
- 재고를 `select` 후 `update`로 차감하지 마라. 이유: 동시 주문 시 재고가 음수가 된다. 조건부 UPDATE나 트랜잭션을 써라.
- 재고가 부족해도 가능한 만큼만 부분 주문을 만들지 마라. 이유: PRD에서 전체 실패로 정했다.
- 실제 PG(토스페이먼츠·아임포트 등)를 연동하지 마라. 이유: ADR-003에서 모의 결제로 정했다.
- `calculateTotals()`를 다시 구현하지 마라. 이유: 배송비 규칙이 두 벌이 되면 화면과 청구액이 달라진다.
- 관리자 화면을 만들지 마라. 이유: Step 8의 범위다.
- 기존 테스트를 깨뜨리지 마라.
