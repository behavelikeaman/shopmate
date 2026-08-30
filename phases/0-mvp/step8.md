# Step 8: admin

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md` (핵심 기능 5, 화면 표)
- `/docs/ADR.md` (ADR-008 관리자 판별)
- `/docs/UI_GUIDE.md`
- `/CLAUDE.md`
- `/src/services/auth.ts` (`requireAdmin`)
- `/src/services/products.ts`, `/src/services/orders.ts`
- `/src/lib/pricing.ts`, `/src/lib/validation.ts`
- `/supabase/migrations/0002_rls.sql` (관리자 정책이 무엇을 허용하는지)
- `/src/middleware.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

관리자 화면을 만든다. 범위는 상품 CRUD와 주문 목록 조회·상태 변경까지다.

### 1. `src/lib/product-form.ts` (TDD)

```ts
export function validateProductInput(input: {
  name?: string; price?: string | number; category?: string; stock?: string | number; imageUrl?: string
}): { ok: boolean; value?: { name: string; price: number; category: string; stock: number; imageUrl: string | null }; errors: Record<string, string> }
```

- 폼에서 오는 값은 전부 문자열이다. 여기서 정수로 파싱하고 검증한다.
- `price`, `stock`: 정수여야 하고 0 이상. `"1000.5"`, `"abc"`, `""`, 음수는 에러 (ADR-005).
- `imageUrl`: 비어 있으면 `null`, 있으면 `http(s)://`로 시작해야 한다.
- `name`, `category`: 공백 제거 후 1자 이상.
- **테스트를 먼저 쓴다** (CLAUDE.md CRITICAL, ADR-004).

### 2. `src/services/products.ts`에 관리자용 함수 추가

```ts
export async function createProduct(input: ProductInput): Promise<Product>
export async function updateProduct(id: string, input: ProductInput): Promise<Product>
export async function deleteProduct(id: string): Promise<void>
export async function listAllProductsForAdmin(): Promise<Product[]>
```

- **`createServerSupabaseClient()`를 쓴다.** RLS의 관리자 정책이 실제로 통과하는지 확인하는 것이 이 step의 목적 중 하나다. admin(service_role) 클라이언트로 우회하면 정책이 틀려도 모른다.
- 삭제는 주문 이력에 영향을 주면 안 된다. `order_items.product_id`가 `on delete set null`이고 상품명은 스냅샷이므로 (ADR-006), 삭제해도 과거 주문은 온전해야 한다. 이걸 수동 검증 항목에 넣는다.

### 3. `src/services/orders.ts`에 관리자용 함수 추가

```ts
export async function listAllOrders(): Promise<Order[]>
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>
```

`updateOrderStatus`는 `'paid' | 'shipped' | 'cancelled'` 외의 값을 거부한다. 취소 시 재고를 되돌릴지는 MVP 범위 밖이므로 **되돌리지 않는다** — 대신 그 한계를 summary에 명시하라.

### 4. 화면

- `src/app/admin/layout.tsx` — 최상단에서 `requireAdmin()`을 호출한다. 하위 페이지마다 반복 확인하지 않아도 되게 한 곳에 모은다. 단, **Server Action 안에서도 각각 `requireAdmin()`을 호출한다.** 레이아웃 가드는 액션을 보호하지 않는다.
- `src/app/admin/products/page.tsx` — 상품 테이블(이름·카테고리·가격·재고·수정/삭제). 재고 0은 시각적으로 구분.
- `src/app/admin/products/new/page.tsx`, `src/app/admin/products/[id]/edit/page.tsx` — 폼. 검증 에러는 필드 아래에 표시.
- `src/app/admin/products/actions.ts` — `createProductAction` / `updateProductAction` / `deleteProductAction`. 각각 `requireAdmin()` → `validateProductInput()` → 서비스 호출 → `revalidatePath`.
- `src/app/admin/orders/page.tsx` — 주문 목록(날짜·주문자·합계·상태 선택). 상태 변경은 Server Action.
- 삭제는 되돌릴 수 없으므로 확인 절차를 둔다. `window.confirm`으로 충분하다 — 모달 컴포넌트를 새로 만들지 마라.

UI는 UI_GUIDE를 따르되, 관리자 화면은 밀도 우선이다. 상품 카드 그리드가 아니라 테이블을 쓴다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test    # product-form 테스트 포함, 기존 테스트 전부 통과
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. 일반 계정으로 /admin/products 접근 → 접근 불가
# 2. profiles.role='admin' 으로 승격한 계정으로 접근 → 목록이 보인다
# 3. 상품 생성 → 목록(/)에 즉시 반영된다
# 4. 가격을 잘못 입력("abc", 음수, 소수) → 필드 에러가 뜨고 저장되지 않는다
# 5. 이미 주문된 상품을 삭제 → 해당 주문 상세의 상품명·단가·합계가 그대로 남아 있다
# 6. /admin/orders 에서 주문 상태를 shipped 로 변경 → 구매자의 /orders 에 반영된다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 모든 관리자 Server Action이 자체적으로 `requireAdmin()`을 호출하는가? (레이아웃 가드에만 의존하지 않는가)
   - 관리자 서비스가 `service_role` 클라이언트로 RLS를 우회하지 않는가?
   - `grep -rn "SERVICE_ROLE" src/` 결과가 여전히 `services/supabase.ts` 한 곳뿐인가?
   - `validateProductInput`이 TDD로 작성되었는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 8을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 화면·액션과 알려진 한계(주문 취소 시 재고 미복구 등)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (관리자 계정 미승격 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 관리자 권한 확인을 `admin/layout.tsx` 한 곳에만 두지 마라. 이유: Server Action은 레이아웃을 거치지 않고 호출될 수 있다.
- 관리자 CRUD에 `service_role` 클라이언트를 쓰지 마라. 이유: RLS 관리자 정책이 실제로 동작하는지 검증할 기회를 잃고, 정책이 틀린 채로 배포된다.
- 사용자가 자신을 관리자로 승격할 수 있는 UI나 액션을 만들지 마라. 이유: 누구나 관리자가 된다 (ADR-008).
- 상품을 삭제할 때 관련 `order_items`를 함께 지우지 마라. 이유: 과거 주문 이력이 사라진다 (ADR-006).
- 상품 이미지 업로드(Supabase Storage)를 구현하지 마라. 이유: PRD MVP 제외 사항이다. 외부 URL 입력만 받는다.
- 새 UI 라이브러리나 테이블/모달 컴포넌트 패키지를 설치하지 마라. 이유: 외부 의존성 최소화.
- 기존 테스트를 깨뜨리지 마라.
