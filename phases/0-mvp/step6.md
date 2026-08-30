# Step 6: order-rpc

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **"주문 생성 — `create_order(...)` RPC"와 "주문 취소 — `cancel_order_group(group_id)` RPC" 절이 이 step의 사양이다.**
- `/docs/ADR.md` — ADR-005(정수 금액), ADR-006(스냅샷), ADR-009(3단 주문), ADR-012(판매자별 배송비), ADR-013(RPC 트랜잭션), ADR-014(조건부 UPDATE), ADR-015(계산 이중화), ADR-017(취소 정책)
- `/docs/PRD.md` — 가격·배송비 / 재고 / 주문 취소 규칙
- `/docs/GLOSSARY.md` — "데이터를 안전하게 바꾸기" 절 (트랜잭션·경쟁 상태·조건부 UPDATE·멱등성)
- `/CLAUDE.md`
- `/supabase/migrations/0001_schema.sql`, `/supabase/migrations/0002_rls.sql`
- `/src/lib/pricing.ts` — **배송비 규칙의 TypeScript 쪽 원본. SQL이 이 값과 정확히 같아야 한다** (ADR-015)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

주문 생성과 취소를 **Postgres 함수(RPC)로** 작성한다. **이 step은 SQL만 만든다. TypeScript 파일을 건드리지 않는다.**
앱 계층(서비스·액션·화면)은 Step 7에서 이 함수를 호출만 한다.

산출물: `supabase/migrations/0004_order_rpc.sql`

파일 상단에 배송비 상수를 SQL 상수(함수 또는 `create or replace function shipping_fee_for(subtotal integer)`)로 **한 번만** 정의하고 재사용한다. `lib/pricing.ts`의 `FREE_SHIPPING_THRESHOLD = 50000`, `SHIPPING_FEE = 3000`과 **값이 같아야 한다** (ADR-015).

### 1. `create_order(p_shipping_name text, p_shipping_phone text, p_shipping_address text) returns uuid`

`security definer`. 호출자는 `auth.uid()`로 판정한다. **인자로 사용자 id를 받지 마라** — 받으면 남의 이름으로 주문할 수 있다.

절차 — **순서를 지켜라**:

1. `auth.uid()`가 NULL이면 예외.
2. 그 사용자의 서버 장바구니(`carts` → `cart_items`)를 읽는다. 비어 있으면 예외(`장바구니가 비어 있습니다`).
3. 해당 상품들의 **현재 `price`, `stock`, `seller_id`, `name`을 `products`에서 다시 읽는다.** 클라이언트가 보낸 값은 애초에 인자에 없다.
4. 재고가 부족한 상품이 하나라도 있으면 **주문 전체를 실패**시키고, 어떤 상품이 몇 개 부족한지 메시지에 담는다. 부분 주문을 만들지 마라 (PRD).
5. `orders` 1행을 INSERT한다 (배송지 3개 컬럼 + `user_id`). **`total_amount`·`status` 컬럼은 존재하지 않는다** (ADR-010).
6. 장바구니 품목을 `seller_id`로 묶어 그룹마다:
   - `subtotal = Σ(price * quantity)`
   - `shipping_fee = shipping_fee_for(subtotal)` — **그룹 소계 기준** (ADR-012)
   - `order_groups` 1행 INSERT (`status = 'paid'`, ADR-003)
   - 그 그룹의 품목들을 `order_items`에 INSERT. **`name_snapshot`과 `unit_price`를 지금 값으로 복사한다** (ADR-006).
7. 재고 차감 — 품목마다:
   ```sql
   update products set stock = stock - v_qty where id = v_pid and stock >= v_qty;
   -- 영향 행이 0이면 예외를 던져 전체 롤백    ← ADR-014
   ```
   **`select`로 재고를 확인한 뒤 `update`하지 마라.** 동시 주문에서 재고가 음수가 된다.
8. 그 사용자의 `cart_items`를 비운다.
9. 생성된 `orders.id`를 반환한다.

전체가 하나의 함수 호출이므로 어느 단계에서 예외가 나든 **전부 롤백된다** (ADR-013). 보상 로직을 따로 만들지 마라.

### 2. `cancel_order_group(p_group_id uuid) returns void`

`security definer`. 절차:

1. 호출자 확인: `auth.uid()`가 **그 그룹이 속한 주문의 구매자이거나, 그 그룹의 `seller_id`이거나, admin**이어야 한다. 아니면 예외 (ADR-017).
2. 조건부 UPDATE로 상태를 바꾼다:
   ```sql
   update order_groups
      set status = 'cancelled', cancelled_at = now()
    where id = p_group_id and status = 'paid';
   -- 영향 행이 0이면 → 이미 취소됐거나 발송됨. 예외를 던진다.
   ```
   **`select`로 상태를 확인한 뒤 `update`하지 마라.** 동시에 두 번 취소되면 재고가 두 배로 복구된다 (ADR-014).
3. 영향 행이 1이었을 때만, 그 그룹의 `order_items` 수량만큼 `products.stock`을 되돌린다.
   `product_id`가 NULL(삭제된 상품)이면 건너뛴다 (ADR-006).

이 함수는 **멱등**이다. 두 번 호출하면 두 번째는 2단계에서 실패하고 재고는 한 번만 복구된다.

### 3. `ship_order_group(p_group_id uuid) returns void`

`security definer`. 호출자가 그 그룹의 `seller_id`이거나 admin이어야 한다.

```sql
update order_groups
   set status = 'shipped', shipped_at = now()
 where id = p_group_id and status = 'paid';
-- 영향 행이 0이면 예외
```

발송은 재고를 건드리지 않는다(이미 주문 시 차감됨).

### 작성 규칙

- 세 함수 모두 `create or replace function`으로 쓰고, 파일을 다시 실행해도 깨지지 않게 한다.
- 예외 메시지는 **한국어로, 사용자에게 그대로 보여줄 수 있는 문장**으로 쓴다. 앱 계층이 이걸 받아 화면에 띄운다.
- `security definer` 함수에는 `set search_path = public, pg_temp`를 붙인다. 이유: 검색 경로를 조작해 함수 안에서 엉뚱한 테이블을 부르게 만드는 공격을 막는다.
- 함수 실행 권한을 `authenticated` 역할에 부여한다(`grant execute`). 익명 사용자에게는 주지 마라.

## Acceptance Criteria

이 step은 앱 코드를 만들지 않는다.

```bash
npm run build   # 기존 코드가 여전히 빌드되는지 (변경 없어야 정상)
npm run test
ls supabase/migrations   # 0004_order_rpc.sql 이 있는가
```

정적 점검 — 확인하고 결과를 summary에 적는다:
- 세 함수 모두 `security definer` + `set search_path`가 붙었는가?
- **재고 차감·복구·상태 변경이 전부 조건부 UPDATE인가?** `select ... then update` 패턴이 하나도 없는가?
- `create_order`가 사용자 id를 인자로 받지 않고 `auth.uid()`를 쓰는가?
- 배송비 상수가 `lib/pricing.ts`의 값(50000 / 3000)과 일치하는가?
- 그룹 소계 기준으로 배송비를 계산하는가? (주문 전체 소계가 아닌가)

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md의 두 RPC 절차와 단계가 일치하는가?
   - `order_items`에 `name_snapshot`·`unit_price`를 복사해 넣는가? (ADR-006)
   - 부분 주문을 만들 수 있는 경로가 없는가?
3. `phases/0-mvp/index.json`의 step 6을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 함수 3종의 시그니처와 예외 메시지 목록. 앱 계층에서 어떻게 호출하는지 한 줄"`
   - 실패 → `"status": "error"` + `error_message` / 개입 필요 → `"status": "blocked"` + `blocked_reason`

## 금지사항

- TypeScript 파일(`src/` 하위)을 만들거나 수정하지 마라. 이유: 이 step은 SQL 계층만 다룬다. 앱 계층은 Step 7이다.
- 실제 Supabase 프로젝트에 접속해 함수를 적용하려 하지 마라. 이유: 적용은 사람이 대시보드에서 한다.
- `select`로 상태·재고를 확인한 뒤 `update`하지 마라. 이유: 동시 요청에서 재고가 음수가 되거나 두 배로 복구된다 (ADR-014).
- `create_order`에 사용자 id를 인자로 받지 마라. 이유: 남의 이름으로 주문할 수 있다.
- 주문 조회 시 `products`를 조인해 현재 가격을 읽게 만들지 마라. 이유: 과거 주문 금액이 소급 변경된다 (ADR-006).
- 재고가 부족해도 가능한 만큼만 부분 주문을 만들지 마라. 이유: PRD에서 전체 실패로 정했다.
- 취소 시 재고를 복구하지 않고 넘어가지 마라. 이유: 취소할수록 팔 수 있는 물건이 사라진다 (ADR-017).
- `orders`에 총액이나 상태를 저장하려 하지 마라. 이유: 그 컬럼은 존재하지 않는다 (ADR-010).
- 기존 테스트를 깨뜨리지 마라.
