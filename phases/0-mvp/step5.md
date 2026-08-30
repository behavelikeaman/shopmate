# Step 5: cart

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — 데이터 흐름, 상태 관리
- `/docs/ADR.md` — ADR-007(비로그인 장바구니), ADR-012(판매자별 배송비), ADR-004
- `/docs/PRD.md` — 핵심 기능 2, 가격·배송비·로그인 전환 규칙
- `/docs/UI_GUIDE.md` — **"판매자 그룹 블록"** 절
- `/CLAUDE.md`
- `/src/lib/cart.ts`, `/src/lib/pricing.ts` — 이미 TDD로 만든 순수 함수. **재구현하지 말고 호출하라**
- `/src/types/index.ts`, `/src/services/supabase.ts`, `/src/services/products.ts`, `/src/services/auth.ts`
- `/supabase/migrations/0001_schema.sql`, `/supabase/migrations/0002_rls.sql`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

장바구니를 만든다. 로그인 사용자는 서버(`carts`/`cart_items`), 비로그인은 `localStorage`다 (ADR-007).
**화면은 판매자별로 묶여 보인다** (ADR-012, UI_GUIDE 원칙 4).

### 1. `src/services/cart.ts` — 서버 장바구니

```ts
export async function getOrCreateCart(userId: string): Promise<string>          // cart id
export async function getCartLines(userId: string): Promise<CartLine[]>
export async function getCartGroups(userId: string): Promise<SellerGroup[]>     // 판매자별 묶음
export async function setCartItem(userId: string, productId: string, quantity: number): Promise<void>
export async function removeCartItem(userId: string, productId: string): Promise<void>
export async function clearCart(userId: string): Promise<void>
export async function mergeLocalCart(userId: string, local: CartLine[]): Promise<void>
export async function getCartCount(userId: string): Promise<number>             // 헤더 뱃지용
```

규칙:
- `setCartItem`은 **멱등**이다. `cart_items`의 `unique (cart_id, product_id)`를 이용해 upsert하고, `quantity <= 0`이면 삭제한다.
- 수량은 저장 전에 `clampQuantity(quantity, product.stock)`를 통과시킨다. 재고보다 많은 수량이 DB에 들어가면 안 된다.
- `getCartGroups`는 라인을 읽고 상품을 붙인 뒤 **`groupBySeller()`를 호출**해 묶는다. 그룹핑·배송비 계산을 여기서 다시 구현하지 마라.
- `mergeLocalCart`는 `getStockMap`으로 재고를 읽어 **`mergeCartLines(local, server, stockMap)`을 호출**하고 결과를 저장한다.
- 모든 함수는 `createServerSupabaseClient()`를 쓴다. RLS가 소유권을 검증하게 두고, admin 클라이언트를 쓰지 마라.

### 2. `src/app/cart/actions.ts` — Server Actions

```ts
'use server'
export async function addToCartAction(productId: string, quantity: number): Promise<{ error: string } | void>
export async function updateQuantityAction(productId: string, quantity: number): Promise<{ error: string } | void>
export async function removeFromCartAction(productId: string): Promise<{ error: string } | void>
export async function mergeLocalCartAction(local: CartLine[]): Promise<void>
```

- 각 액션은 **서버에서 다시** 사용자·재고를 확인한다. 클라이언트가 보낸 `quantity`를 그대로 믿지 마라.
- 품절(`stock === 0`) 상품은 담을 수 없다 (PRD 규칙). `{ error: '품절된 상품입니다' }`.
- 재고 부족이면 `{ error: '재고가 부족합니다 (남은 수량: N)' }`를 **반환**한다. 던지지 말고 반환해서 UI가 표시하게 한다.
- 성공 시 `revalidatePath('/cart')`.

### 3. 비로그인 장바구니 — `src/lib/local-cart.ts` + Client Component

```ts
export function readLocalCart(): CartLine[]
export function writeLocalCart(lines: CartLine[]): void
export function clearLocalCart(): void
```

- `localStorage` 키는 상수 하나로 고정한다(예: `shopmate.cart.v1`). 파싱 실패나 스키마 불일치 시 **빈 배열을 반환하고 조용히 복구한다** — 옛날 데이터 때문에 앱이 죽으면 안 된다.
- SSR에서 `localStorage`에 접근하면 터진다. 반드시 `useEffect` 안에서만 읽어라.
- 로그인 직후 로컬 장바구니가 비어 있지 않으면 `mergeLocalCartAction(local)`을 호출하고 `clearLocalCart()` 한다. **"사용자가 로그인 상태이고 로컬 장바구니가 비어있지 않을 때 1회"**만 실행되게 하라 (매 렌더마다 부르면 수량이 계속 늘어난다).

### 4. 장바구니 페이지 `src/app/cart/page.tsx`

- **로그인 사용자**: Server Component에서 `getCartGroups(userId)` → `calculateOrderTotals(groups)` → 렌더.
- **비로그인 사용자**: Client Component에서 로컬 라인을 읽고, 상품 정보는 서버에서 받은 상품 목록으로 채운 뒤 `groupBySeller()`로 묶는다.
- **판매자 그룹 블록**으로 그린다 (UI_GUIDE). 그룹 헤더에 스토어명, 그룹 푸터에 소계 / 배송비 / 무료배송까지 남은 금액(`remainingForFreeShipping`).
- **그룹이 하나뿐이어도 같은 구조로 그린다** (UI_GUIDE 규칙).
- 최종 합계(소계 합 / 배송비 합 / 총액)는 그룹 밖 전체 요약 블록에 둔다.
- 빈 장바구니는 UI_GUIDE의 빈 상태 규칙을 따른다.
- "주문하기" 버튼은 `/checkout`으로 간다. 비로그인이면 `/login?next=/checkout`.

수량 스테퍼·삭제 버튼은 `src/components/`에 둔다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test    # Step 2의 lib 테스트가 여전히 통과해야 한다
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. 비로그인으로 서로 다른 판매자 상품 2개 담기 → 그룹이 2개로 나뉘어 보인다
# 2. 각 그룹에 배송비가 따로 붙는다. 한 그룹만 5만원을 넘기면 그 그룹만 0원이다
# 3. 새로고침해도 유지된다
# 4. 로그인 → 로컬 장바구니가 서버로 병합되고 로컬은 비워진다 (수량이 두 배가 되지 않는다)
# 5. 다른 브라우저에서 같은 계정 로그인 → 장바구니가 보인다
# 6. 재고보다 많은 수량 입력 → 재고 수량으로 제한된다
# 7. 품절 상품은 담기지 않고 이유가 보인다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `lib/`의 `mergeCartLines`·`clampQuantity`·`groupBySeller`·`calculateOrderTotals`를 services나 컴포넌트에서 다시 구현하지 않았는가?
   - Server Action이 클라이언트가 보낸 수량을 서버에서 재검증하는가?
   - 병합이 1회만 실행되는가?
   - `localStorage` 접근이 전부 클라이언트 실행 경로 안에 있는가?
   - Supabase 호출이 `services/` 안에만 있는가?
3. `phases/0-mvp/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 파일, 서비스·액션 시그니처, 병합 트리거 위치"`
   - 실패 → `"status": "error"` + `error_message` / 개입 필요 → `"status": "blocked"` + `blocked_reason`

## 금지사항

- `lib/`의 순수 함수를 services나 컴포넌트에서 다시 구현하지 마라. 이유: TDD로 검증한 로직이 두 벌이 되면 한쪽만 고쳐지고 금액이 어긋난다.
- 배송비를 장바구니 전체 소계로 계산하지 마라. 이유: 판매자별이다 (ADR-012).
- 비로그인 사용자를 위해 DB에 익명 장바구니 행을 만들지 마라. 이유: ADR-007에서 고아 레코드 문제를 피하려 localStorage를 선택했다.
- 장바구니 조회·수정을 위해 `app/api/` 라우트를 만들지 마라. 이유: ADR-001.
- 장바구니 서비스에 admin(service_role) 클라이언트를 쓰지 마라. 이유: RLS가 "남의 장바구니를 못 만진다"를 보장하는지 검증되지 않는다.
- 주문 생성·취소 로직을 만들지 마라. 이유: Step 6~7의 범위다.
- 기존 테스트를 깨뜨리지 마라.
