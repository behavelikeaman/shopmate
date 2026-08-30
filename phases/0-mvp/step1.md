# Step 1: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — **데이터 모델 절과 "권한(RLS)" 표가 이 step의 사양이다.** 표를 그대로 SQL로 옮기는 것이 목표다.
- `/docs/ADR.md` — ADR-002(RLS), ADR-005(정수 금액), ADR-006(스냅샷), ADR-008(역할 3종·판매자 격리), ADR-009(3단 주문), ADR-010(orders에 총액 없음), ADR-011(profiles 분리)
- `/docs/PRD.md` — 규칙 절
- `/CLAUDE.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`supabase/migrations/`에 스키마와 RLS 정책을 SQL로 작성한다. **애플리케이션 코드는 작성하지 않는다. SQL 파일만 만든다.**

산출물 (파일명 순서대로 적용되도록 숫자 접두사를 붙인다):

1. `supabase/migrations/0001_schema.sql` — 테이블 + 인덱스 + 가입 트리거
2. `supabase/migrations/0002_rls.sql` — RLS 활성화 + 정책
3. `supabase/migrations/0003_seed.sql` — 실습용 시드

### 테이블

ARCHITECTURE.md의 데이터 모델 절을 그대로 따른다. 컬럼명·타입을 바꾸지 마라.

```
profiles(id uuid pk → auth.users(id) on delete cascade,
         role text not null default 'customer' check (role in ('customer','seller','admin')),
         created_at timestamptz default now())

seller_profiles(id uuid pk → auth.users(id) on delete cascade,
                store_name text not null,
                created_at timestamptz default now())

products(id uuid pk default gen_random_uuid(),
         seller_id uuid not null → auth.users(id) on delete cascade,
         name text not null, description text,
         price integer not null check (price >= 0),
         image_url text, category text not null,
         stock integer not null default 0 check (stock >= 0),
         created_at timestamptz default now())

carts(id uuid pk, user_id uuid not null unique → auth.users(id) on delete cascade,
      created_at timestamptz default now())

cart_items(id uuid pk, cart_id uuid not null → carts(id) on delete cascade,
           product_id uuid not null → products(id) on delete cascade,
           quantity integer not null check (quantity > 0),
           unique (cart_id, product_id))

orders(id uuid pk, user_id uuid not null → auth.users(id),
       shipping_name text not null, shipping_phone text not null, shipping_address text not null,
       created_at timestamptz default now())

order_groups(id uuid pk, order_id uuid not null → orders(id) on delete cascade,
             seller_id uuid not null → auth.users(id),
             status text not null default 'paid' check (status in ('paid','shipped','cancelled')),
             subtotal integer not null check (subtotal >= 0),
             shipping_fee integer not null check (shipping_fee >= 0),
             created_at timestamptz default now(),
             shipped_at timestamptz, cancelled_at timestamptz,
             unique (order_id, seller_id))

order_items(id uuid pk, group_id uuid not null → order_groups(id) on delete cascade,
            product_id uuid → products(id) on delete set null,
            name_snapshot text not null,
            unit_price integer not null check (unit_price >= 0),
            quantity integer not null check (quantity > 0))
```

**`orders`에 `total_amount`나 `status`를 넣지 마라.** 의도적으로 뺀 컬럼이다 (ADR-010). 이유는 ARCHITECTURE.md의 "왜 `orders`에 총액과 상태가 없나" 절에 있다.

인덱스: `products(seller_id)`, `products(category)`, `orders(user_id)`, `order_groups(order_id)`, `order_groups(seller_id, status)`, `order_items(group_id)`, `cart_items(cart_id)`.

### 가입 시 프로필 자동 생성

`auth.users`에 INSERT가 일어나면 `profiles` 행을 만드는 `security definer` 트리거 함수를 둔다.

- `raw_user_meta_data`에 판매자 가입 표시(예: `is_seller: true`)와 `store_name`이 들어오면 `role`을 `'seller'`로 하고 `seller_profiles` 행도 함께 만든다. 그렇지 않으면 `'customer'`.
- `role`이 `'admin'`으로 설정되는 경로는 이 트리거에 **절대 만들지 마라** (ADR-008).
- 애플리케이션 코드가 profiles를 만들게 하지 마라. 회원가입 경로가 여러 개가 되면 누락된다.

### RLS 정책

모든 테이블에 `enable row level security`를 건다. 정책은 **ARCHITECTURE.md의 "권한(RLS)" 표를 그대로 옮긴 것**이어야 한다. 표에 없는 권한을 임의로 추가하지 마라.

핵심만 다시 적으면:

| 테이블 | SELECT | 변경 |
|--------|--------|------|
| `products` | 누구나(익명 포함) | `seller_id = auth.uid()` 또는 admin |
| `profiles` | 본인만 | 본인 UPDATE. **`role`은 스스로 못 바꾼다** |
| `seller_profiles` | 누구나 | 본인만 |
| `carts`·`cart_items` | 본인 소유만 | 본인 소유만 |
| `orders` | 주문자 본인, **자기 그룹이 속한 주문의 판매자**, admin | INSERT는 RPC에서만. UPDATE/DELETE 정책 없음 |
| `order_groups` | 주문자 본인, 그룹의 seller, admin | `status` UPDATE만. 판매자 `paid→shipped\|cancelled`, 구매자 `paid→cancelled` |
| `order_items` | 상위 `order_groups` 권한을 따름 | INSERT는 RPC에서만. UPDATE/DELETE 정책 없음 |

작성 요령:

- 관리자 판정은 `public.is_admin()` 같은 `security definer` 헬퍼로 감싼다. **`profiles` 정책 안에서 `profiles`를 직접 조회하면 무한 재귀가 난다.**
- `orders`의 판매자 SELECT는 "이 주문에 내가 판매자인 그룹이 존재하는가"(`exists`)로 쓴다.
- `profiles`의 `role` 자기변경 차단은 `with check`에서 기존 값과 같은지 비교하거나, `role`을 건드리지 못하게 하는 방식으로 구현한다. 어떤 방식이든 **가입 후 스스로 admin이 될 수 없어야 한다.**
- `order_groups`의 상태 전이 제약(`paid`에서만 출발)은 `using`/`with check`에 담는다. RPC가 별도로 조건부 UPDATE를 하더라도 정책에도 걸어둔다.

### 시드

- 서로 다른 **판매자 3명** 분량으로 만든다. 판매자 계정은 `auth.users`에 직접 넣을 수 없으므로, 시드 파일 상단에 **"판매자 계정을 앱에서 가입시킨 뒤 그 uuid를 아래 상수에 채워라"**는 주석과 함께 자리를 만들어 둔다. 그 상태로도 파일이 문법 오류 없이 읽히게 하라.
- 상품 12~15개, 카테고리 3~4종, **일부는 `stock = 0`**(품절 케이스), 일부는 배송비 임계값(50,000원) 근처 가격으로 둔다.
- 고정 uuid + `on conflict do nothing`으로 여러 번 실행해도 중복되지 않게 한다.

### 마이그레이션 작성 규칙

- 재실행 가능하게 쓴다: `create table if not exists`, `drop policy if exists ...; create policy ...`, `create or replace function`.
- 각 파일 상단에 무엇을 하는 파일인지 주석 한 줄.

## Acceptance Criteria

이 step은 앱 코드를 만들지 않으므로 SQL 자체를 검증한다.

```bash
npm run build           # 기존 골격이 여전히 빌드되는지 (변경 없어야 정상)
ls supabase/migrations  # 0001_schema.sql 0002_rls.sql 0003_seed.sql
```

정적 점검 — 아래를 확인하고 결과를 summary에 적는다:
- 모든 `create table`에 대응하는 `enable row level security`가 있는가?
- **RLS만 켜고 정책이 없는 테이블이 없는가?** (그런 테이블은 아무도 못 읽는다)
- 금액 컬럼이 전부 `integer`인가? (`numeric`/`float`이 하나라도 있으면 실패)
- `orders`에 `total_amount`·`status`가 **없는가?**
- `is_admin()`이 `security definer`인가?

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md 데이터 모델과 컬럼명·타입이 일치하는가?
   - "권한(RLS)" 표의 모든 행이 정책으로 옮겨졌는가?
   - ADR-008(스스로 admin 불가), ADR-010(orders 총액 없음), ADR-011(profiles 분리)을 지켰는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 마이그레이션 파일, 테이블·정책 목록, 시드에서 사람이 채워야 할 판매자 uuid 자리"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 실제 Supabase 프로젝트에 접속해서 마이그레이션을 적용하려 하지 마라. 이유: 이 세션에는 DB 자격 증명이 없고, 적용은 사람이 대시보드에서 한다. SQL 파일 작성까지가 범위다.
- ORM(Prisma, Drizzle 등)을 도입하지 마라. 이유: ADR-002에서 명시적으로 배제했다.
- `orders`에 `total_amount`나 `status` 컬럼을 만들지 마라. 이유: 판매자에게 `orders` SELECT가 열리므로 총액이 새고, 판매자마다 발송 시점이 달라 주문 전체 상태가 성립하지 않는다 (ADR-009, ADR-010).
- RLS를 끄거나 `using (true)`로 뭉개지 마라. 이유: anon 키는 브라우저에 공개되므로 RLS가 유일한 신뢰 경계다.
- 주문 생성·취소 함수(RPC)를 여기서 만들지 마라. 이유: Step 6의 범위다. 이 step은 테이블과 정책까지.
- `src/` 하위 파일을 만들거나 수정하지 마라. 이유: Step 2 이후의 범위다.
- 기존 테스트를 깨뜨리지 마라.
