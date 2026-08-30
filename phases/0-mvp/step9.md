# Step 9: seller-console

## 읽어야 할 파일

- `/docs/PRD.md` — 핵심 기능 6(판매자 콘솔), 화면 표, 권한 규칙
- `/docs/ADR.md` — ADR-008(역할·판매자 격리), ADR-016(운영자 화면 제외), ADR-005, ADR-006, ADR-017
- `/docs/UI_GUIDE.md` — **"판매자 콘솔"**, **"되돌릴 수 없는 행동"**, "주문 상태"
- `/docs/ARCHITECTURE.md` — 권한(RLS) 표
- `/CLAUDE.md`
- `/src/services/auth.ts` (`requireSeller`), `/src/services/products.ts`, `/src/services/orders.ts`
- `/src/lib/pricing.ts`, `/src/lib/validation.ts`, `/src/lib/order-status.ts`
- `/supabase/migrations/0002_rls.sql` — 판매자 정책이 무엇을 허용하는지
- `/supabase/migrations/0004_order_rpc.sql` — `ship_order_group`, `cancel_order_group`
- `/src/middleware.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

판매자 콘솔을 만든다. 범위는 **내 상품 CRUD**와 **내 주문 그룹 조회·발송·취소**까지다.
운영자 전용 화면은 만들지 않는다 — `admin`은 같은 화면에서 전체가 보인다 (ADR-016).

### 1. `src/lib/product-form.ts` (TDD)

```ts
export function validateProductInput(input: {
  name?: string; price?: string | number; category?: string;
  stock?: string | number; imageUrl?: string; description?: string
}): { ok: boolean; value?: { name: string; price: number; category: string; stock: number; imageUrl: string | null; description: string | null }; errors: Record<string, string> }
```

- 폼에서 오는 값은 전부 문자열이다. 여기서 정수로 파싱하고 검증한다.
- `price`, `stock`: **정수여야 하고 0 이상.** `"1000.5"`, `"abc"`, `""`, 음수, `"1e3"`은 에러 (ADR-005).
- `imageUrl`: 비어 있으면 `null`, 있으면 `http://` 또는 `https://`로 시작해야 한다.
- `name`, `category`: 공백 제거 후 1자 이상.
- 에러 메시지는 한국어 한 줄.
- **테스트를 먼저 쓴다** (CLAUDE.md CRITICAL, ADR-004).

### 2. `src/services/products.ts`에 판매자용 함수 추가

```ts
export async function createProduct(input: ProductInput): Promise<Product>
export async function updateProduct(id: string, input: ProductInput): Promise<Product>
export async function deleteProduct(id: string): Promise<void>
export async function listMyProducts(): Promise<Product[]>   // admin이면 전체
```

- **`createServerSupabaseClient()`를 쓴다.** RLS의 판매자 정책(`seller_id = auth.uid()`)이 실제로 통과하는지 확인하는 것이 이 step의 목적 중 하나다. admin(service_role) 클라이언트로 우회하면 정책이 틀려도 모른다.
- `createProduct`는 `seller_id`를 **서버에서 현재 사용자로 채운다.** 폼에서 받지 마라 — 남의 이름으로 상품을 올릴 수 있다.
- `listMyProducts`는 `where seller_id = 나`를 쿼리에 쓰되, **그게 없어도 RLS가 막아야 한다.** 둘 다 있어야 한다(쿼리는 의도 표현, RLS는 방어).
- 삭제해도 과거 주문은 온전해야 한다 (`order_items.product_id`가 `on delete set null`, 상품명은 스냅샷 — ADR-006). 수동 검증 항목에 넣는다.

### 3. `src/app/seller/`

- `layout.tsx` — 최상단에서 `requireSeller()`를 호출한다. 하위 페이지마다 반복하지 않게 한 곳에 모은다.
  **단, Server Action 안에서도 각각 `requireSeller()`를 호출한다.** 레이아웃 가드는 액션을 보호하지 않는다 (ADR-008).
- `products/page.tsx` — 내 상품 **테이블**(UI_GUIDE "판매자 콘솔"). 컬럼: 이름 / 카테고리 / 가격 / 재고 / 동작(수정·삭제). 숫자는 `text-right tabular-nums`, 재고 0은 숫자만 빨강.
- `products/new/page.tsx`, `products/[id]/edit/page.tsx` — 폼. 검증 에러는 필드 아래.
- `products/actions.ts` — `createProductAction` / `updateProductAction` / `deleteProductAction`.
  각각 `requireSeller()` → `validateProductInput()` → 서비스 호출 → `revalidatePath`.
- `orders/page.tsx` — **내 주문 그룹** 테이블. 컬럼: 주문일 / 배송지 이름 / 품목 요약 / 소계+배송비 / 상태 / 동작.
  - 배송지 전체(주소·연락처)는 발송에 필요하므로 **행을 펼치거나 상세에서 볼 수 있게** 한다.
  - `canShipGroup(status)`가 true면 "발송 처리" 버튼, `canCancelGroup(status)`가 true면 "취소" 버튼.
- `orders/actions.ts` — `shipGroupAction(groupId)` / `cancelGroupAction(groupId)`. 각각 `requireSeller()` 후 Step 7의 서비스 함수(`shipOrderGroup` / `cancelOrderGroup`)를 호출한다. **RPC를 직접 다시 부르는 코드를 새로 쓰지 마라.**
- 삭제·취소는 되돌릴 수 없으므로 UI_GUIDE "되돌릴 수 없는 행동"을 따른다 — Danger Text 버튼 + `window.confirm`에 무엇이 사라지는지 구체적으로. **모달 컴포넌트를 새로 만들지 마라.**

### 4. 판매자 승격 안내

관리자 승격과 판매자 계정 준비는 SQL로 한다 (ADR-016). `README.md`에 이미 관리자 승격 SQL이 있으니, 필요하면 판매자 관련 항목을 한 줄 보완하라. 그 외 운영자 화면은 만들지 않는다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test    # product-form 테스트 포함, 기존 테스트 전부 통과
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. 일반(customer) 계정으로 /seller/products 접근 → 접근 불가
# 2. seller 계정으로 접근 → 내 상품만 보인다
# 3. ★ 판매자 A로 로그인해 판매자 B의 상품 id로 /seller/products/{B상품}/edit 직접 접근
#    → 수정되지 않는다 (RLS가 막는다)
# 4. 상품 생성 → 목록(/)에 즉시 반영된다
# 5. 가격을 잘못 입력("abc", 음수, 소수) → 필드 에러가 뜨고 저장되지 않는다
# 6. 이미 주문된 상품을 삭제 → 그 주문 상세의 상품명·단가·합계가 그대로 남아 있다
# 7. /seller/orders 에서 발송 처리 → 구매자의 /orders 에 '발송 완료'로 반영된다
# 8. 발송 완료된 그룹은 구매자도 판매자도 취소할 수 없다
# 9. 판매자 A의 /seller/orders 에 판매자 B의 주문 그룹이 보이지 않는다
```

3번과 9번을 반드시 확인하라. **판매자 격리가 이 프로젝트의 핵심 보안 요구사항이다.**

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 모든 판매자 Server Action이 자체적으로 `requireSeller()`를 호출하는가? (레이아웃 가드에만 의존하지 않는가)
   - 판매자 서비스가 `service_role` 클라이언트로 RLS를 우회하지 않는가?
   - `grep -rn "SERVICE_ROLE" src/` 결과가 여전히 `services/supabase.ts` 한 곳뿐인가?
   - `createProduct`가 `seller_id`를 폼이 아니라 서버 세션에서 채우는가?
   - `validateProductInput`이 TDD로 작성되었는가?
   - 발송·취소가 Step 7의 서비스 함수를 재사용하는가? (RPC 호출을 새로 쓰지 않았는가)
3. `phases/0-mvp/index.json`의 step 9를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 화면·액션, 판매자 격리 수동 검증(3·9번) 결과, 알려진 한계"`
   - 실패 → `"status": "error"` + `error_message` / 개입 필요 (판매자 계정 미준비 등) → `"status": "blocked"` + `blocked_reason`

## 금지사항

- 판매자 권한 확인을 `seller/layout.tsx` 한 곳에만 두지 마라. 이유: Server Action은 레이아웃을 거치지 않고 호출될 수 있다 (ADR-008).
- 판매자 CRUD에 `service_role` 클라이언트를 쓰지 마라. 이유: RLS 판매자 정책이 실제로 동작하는지 검증할 기회를 잃고, 정책이 틀린 채로 남는다.
- `seller_id`를 폼 입력이나 클라이언트 값에서 받지 마라. 이유: 남의 이름으로 상품을 등록할 수 있다.
- 사용자가 자신을 `admin`이나 `seller`로 승격할 수 있는 UI·액션을 만들지 마라. 이유: 누구나 권한을 얻는다 (ADR-008).
- 상품 삭제 시 관련 `order_items`를 함께 지우지 마라. 이유: 과거 주문 이력이 사라진다 (ADR-006).
- 발송·취소 RPC 호출 코드를 새로 쓰지 마라. 이유: Step 7의 `shipOrderGroup`·`cancelOrderGroup`을 재사용한다. 두 벌이 되면 한쪽만 고쳐진다.
- 운영자 전용 화면(전체 매출, 사용자 관리, 판매자 승격 UI)을 만들지 마라. 이유: ADR-016에서 MVP 제외로 정했다.
- 상품 이미지 업로드(Supabase Storage)를 구현하지 마라. 이유: PRD MVP 제외. 외부 URL 입력만 받는다.
- 새 UI 라이브러리나 테이블/모달 컴포넌트 패키지를 설치하지 마라.
- 기존 테스트를 깨뜨리지 마라.
