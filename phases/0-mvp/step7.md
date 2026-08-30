# Step 7: checkout-orders

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — 데이터 흐름, 두 RPC 절
- `/docs/ADR.md` — ADR-013(RPC), ADR-014(조건부 UPDATE), ADR-015(계산 이중화), ADR-017(취소 정책), ADR-010
- `/docs/PRD.md` — 주문·취소 규칙, 로그인 전환 규칙
- `/docs/UI_GUIDE.md` — "판매자 그룹 블록", "주문 상태", "되돌릴 수 없는 행동"
- `/CLAUDE.md`
- `/supabase/migrations/0004_order_rpc.sql` — **호출할 함수의 인자와 예외 메시지를 여기서 확인하라**
- `/src/lib/pricing.ts`, `/src/lib/validation.ts`, `/src/lib/order-status.ts`
- `/src/services/cart.ts`, `/src/services/products.ts`, `/src/services/auth.ts`
- `/src/app/cart/actions.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Step 6에서 만든 RPC를 앱에서 호출하고, 체크아웃·주문내역 화면을 만든다.
**주문 로직을 TypeScript로 다시 구현하지 마라. RPC를 부르는 것이 전부다.**

### 1. `src/services/orders.ts`

```ts
export async function createOrder(shipping: ShippingInfo): Promise<{ ok: true; orderId: string } | { ok: false; error: string }>
export async function listOrders(): Promise<Order[]>                       // 내 주문 (RLS가 필터)
export async function getOrder(orderId: string): Promise<Order | null>
export async function cancelOrderGroup(groupId: string): Promise<{ ok: true } | { ok: false; error: string }>
export async function shipOrderGroup(groupId: string): Promise<{ ok: true } | { ok: false; error: string }>
```

- `createOrder`는 `supabase.rpc('create_order', { p_shipping_name, p_shipping_phone, p_shipping_address })` 한 번을 부른다. 재고 확인·금액 계산·INSERT를 여기서 하지 마라.
- `cancelOrderGroup` / `shipOrderGroup`도 각각 RPC 한 번.
- RPC가 던진 **한국어 예외 메시지를 그대로 `error`에 담아** 반환한다. 던지지 말고 반환한다(UI가 표시해야 한다). 다만 예상 못 한 DB 에러는 사용자에게 원문을 보여주지 말고 "주문을 처리하지 못했습니다"로 감싼다.
- 조회 함수는 `orders → order_groups → order_items → seller_profiles`를 조인해 `Order` 타입으로 매핑한다. **`products`를 조인해 현재 가격을 읽지 마라** (ADR-006). 상품명·단가는 `order_items`의 스냅샷을 쓴다.
- 목록/상세 총액은 `calculateOrderTotals`로 그룹 합에서 계산한다. `orders`에 총액 컬럼이 없다 (ADR-010).
- 전부 `createServerSupabaseClient()`. RLS가 "내 주문만"과 "판매자는 자기 그룹만"을 보장한다.

### 2. `src/app/checkout/`

- `page.tsx`: `requireUser('/checkout')`. **판매자 그룹 블록**으로 주문 요약(그룹별 소계·배송비) + 전체 합계 + 배송지 폼.
- `actions.ts`: `placeOrderAction(formData)` — `validateShipping()`으로 검증 → `createOrder()` → 성공 시 `/orders/{id}`로 redirect, 실패 시 에러 문자열 반환.
- 주문 버튼은 제출 중 비활성화한다(중복 클릭 방지). 다만 **UI 비활성화를 중복 주문 방지 수단으로 믿지 마라** — 실제 방어는 RPC가 빈 장바구니를 거부하는 것이다.

### 3. `src/app/orders/`

- `page.tsx`: 내 주문 목록. 주문마다 날짜·총액·그룹 요약(스토어명 + 상태 뱃지). 빈 상태는 UI_GUIDE를 따른다.
- `[id]/page.tsx`: 주문 상세.
  - **판매자 그룹 블록**으로 그리고, 그룹 헤더에 **상태 뱃지**(UI_GUIDE "주문 상태" 표)를 단다.
  - 그룹마다 품목(스냅샷 상품명·단가·수량), 소계, 배송비.
  - 전체 합계와 배송지.
  - `canCancelGroup(status)`가 true인 그룹에만 **취소 버튼**을 보인다 (UI_GUIDE "되돌릴 수 없는 행동" — Danger Text 버튼 + `window.confirm`에 무엇이 사라지는지 구체적으로).
  - 남의 주문 id로 접근하면 `notFound()`. RLS가 이미 막지만 UI도 404를 보여야 한다.
- `actions.ts`: `cancelGroupAction(groupId)` — `cancelOrderGroup()` 호출 → `revalidatePath`. 실패 메시지를 화면에 표시한다.

취소된 그룹은 목록에서 사라지지 않고 `취소됨` 뱃지를 단 채 남는다 (UI_GUIDE).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. 서로 다른 판매자 상품을 담고 주문 → /orders/{id} 로 이동, 그룹이 판매자별로 나뉘어 보인다
# 2. Supabase에서 각 상품 stock 이 주문 수량만큼 줄었다
# 3. 주문 후 장바구니가 비었다
# 4. 재고 1개짜리를 2개 주문 시도 → 주문 실패 + 재고가 줄지 않았다 (부분 주문도 안 생겼다)
# 5. 주문 후 판매자가 상품 가격을 바꿔도 기존 주문 금액은 그대로다
# 6. 한 그룹을 취소 → 그 그룹만 '취소됨'이 되고 그 상품 재고가 복구된다.
#    다른 그룹은 '발송 준비중' 그대로다
# 7. 취소를 두 번 시도 → 두 번째는 실패하고 재고가 두 배로 늘지 않는다
# 8. ★ 체크아웃 화면에 보인 합계와 /orders/{id} 에 저장된 합계가 일치한다   ← ADR-015 이중화 검증
```

8번을 반드시 확인하라. 화면 금액은 `lib/pricing.ts`가, 저장 금액은 SQL이 계산하므로 두 값이 어긋날 수 있다 (ADR-015).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 재고 확인·금액 계산·주문 INSERT가 TypeScript에 다시 구현되어 있지 않은가? (RPC 호출뿐인가)
   - 주문 조회가 `products`를 조인해 현재 가격을 읽지 않는가? (ADR-006)
   - `Order`에 총액을 저장하지 않고 그룹 합으로 계산하는가? (ADR-010)
   - 취소 버튼이 `paid` 그룹에만 보이는가?
   - 취소·삭제가 Danger Text 버튼인가? (Primary가 아닌가 — UI_GUIDE)
3. `phases/0-mvp/index.json`의 step 7을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 파일, 서비스·액션 시그니처, 수동 검증 8번(금액 일치) 결과"`
   - 실패 → `"status": "error"` + `error_message` / 개입 필요 → `"status": "blocked"` + `blocked_reason`

## 금지사항

- 주문 생성·취소 로직을 TypeScript로 다시 구현하지 마라. 이유: 트랜잭션이 깨져 재고와 주문이 어긋난다 (ADR-013). RPC를 부르는 것이 전부다.
- SQL 파일(`supabase/migrations/`)을 수정하지 마라. 이유: Step 6에서 확정했다. 함수에 문제가 있으면 고치지 말고 summary에 적어라.
- 클라이언트가 보낸 가격·소계·합계를 서버로 넘기지 마라. 이유: 브라우저에서 값을 조작해 1원짜리 주문을 만들 수 있다.
- `order_items` 조회 시 `products`를 조인해 현재 가격을 표시하지 마라. 이유: 과거 주문 금액이 소급 변경된다 (ADR-006).
- `calculateOrderTotals`·`validateShipping`·`canCancelGroup`을 다시 구현하지 마라.
- 실제 PG를 연동하지 마라. 이유: ADR-003.
- 판매자 콘솔 화면을 만들지 마라. 이유: Step 9의 범위다. (`shipOrderGroup` 서비스 함수는 여기서 만들되, 화면은 Step 9다.)
- 기존 테스트를 깨뜨리지 마라.
