# Step 1: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (데이터 모델 절, Supabase 클라이언트 3종 표)
- `/docs/ADR.md` (ADR-002 RLS, ADR-005 정수 금액, ADR-006 스냅샷, ADR-008 관리자 판별)
- `/docs/PRD.md` (규칙 절 — 품절·재고 부족·가격 스냅샷)
- `/CLAUDE.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`supabase/migrations/`에 스키마와 RLS 정책을 SQL로 작성한다. **코드는 작성하지 않는다. SQL 파일만 만든다.**

산출물 (파일명은 순서대로 적용되도록 숫자 접두사를 붙인다):

1. `supabase/migrations/0001_schema.sql` — 테이블 생성
2. `supabase/migrations/0002_rls.sql` — RLS 활성화 + 정책
3. `supabase/migrations/0003_seed.sql` — 실습용 시드 상품 12개 내외 (여러 카테고리, 일부는 `stock = 0`으로 품절 케이스 포함)

### 테이블 (ARCHITECTURE.md 데이터 모델 절을 그대로 따른다)

```
profiles(id uuid pk → auth.users(id) on delete cascade,
         role text not null default 'customer' check (role in ('customer','admin')),
         created_at timestamptz default now())

products(id uuid pk default gen_random_uuid(),
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
       status text not null default 'paid' check (status in ('paid','shipped','cancelled')),
       subtotal integer not null check (subtotal >= 0),
       shipping_fee integer not null check (shipping_fee >= 0),
       total_amount integer not null check (total_amount >= 0),
       shipping_name text not null, shipping_phone text not null, shipping_address text not null,
       created_at timestamptz default now())

order_items(id uuid pk, order_id uuid not null → orders(id) on delete cascade,
            product_id uuid → products(id) on delete set null,
            name_snapshot text not null,
            unit_price integer not null check (unit_price >= 0),
            quantity integer not null check (quantity > 0))
```

`products(category)`, `orders(user_id)`, `order_items(order_id)`, `cart_items(cart_id)`에 인덱스를 만든다.

### 가입 시 profiles 자동 생성

`auth.users`에 INSERT가 일어나면 같은 `id`로 `profiles` 행을 만드는 트리거 함수를 둔다 (`security definer`). 애플리케이션 코드가 profiles를 만들게 하지 마라 — 회원가입 경로가 여러 개가 되면 누락된다.

### RLS 정책

모든 테이블에 `enable row level security`를 건다. 정책은 최소한 다음을 만족해야 한다:

| 테이블 | 정책 |
|--------|------|
| `products` | 누구나(익명 포함) SELECT 가능. INSERT/UPDATE/DELETE는 `profiles.role = 'admin'`인 사용자만 |
| `profiles` | 본인 행만 SELECT. UPDATE는 본인이되 `role` 컬럼은 스스로 바꿀 수 없어야 한다 |
| `carts`, `cart_items` | 본인 소유(`carts.user_id = auth.uid()`)만 SELECT/INSERT/UPDATE/DELETE. `cart_items`는 상위 `carts`를 통해 소유를 판정한다 |
| `orders`, `order_items` | 본인 것만 SELECT. 관리자는 전체 SELECT + `orders.status` UPDATE 가능. 일반 사용자의 orders UPDATE/DELETE는 없음 |

관리자 판정을 RLS에서 반복해 쓰게 되므로, `public.is_admin()` 같은 `security definer` 헬퍼 함수를 만들어 정책에서 호출하라. `profiles` 정책 안에서 `profiles`를 다시 조회하면 무한 재귀가 나므로 반드시 `security definer` 함수로 감싼다.

### 마이그레이션 작성 규칙

- 재실행 가능하게 쓴다: `create table if not exists`, `drop policy if exists ... ; create policy ...`. 이유: 다른 PC에서 SQL Editor에 다시 붙여넣어도 깨지지 않아야 한다.
- 각 파일 상단에 무엇을 하는 파일인지 주석 한 줄을 단다.
- 시드는 `insert ... on conflict do nothing` 형태로, 고정 uuid를 써서 여러 번 실행해도 중복되지 않게 한다.

## Acceptance Criteria

이 step은 실행 가능한 앱 코드를 만들지 않으므로 SQL 자체를 검증한다:

```bash
npm run build          # 기존 골격이 여전히 빌드되는지 (변경 없어야 정상)
ls supabase/migrations # 0001_schema.sql 0002_rls.sql 0003_seed.sql
```

추가로 SQL 정적 점검 — 아래를 눈으로 확인하고 결과를 summary에 적는다:
- 모든 `create table`에 대응하는 `enable row level security`가 있는가?
- 정책이 없는 RLS 테이블이 없는가? (RLS만 켜고 정책이 없으면 아무도 못 읽는다)
- 금액 컬럼이 전부 `integer`인가? (`numeric`/`float`이 하나라도 있으면 실패)

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 데이터 모델과 컬럼명·타입이 일치하는가?
   - CLAUDE.md의 "모든 테이블에 RLS" CRITICAL 규칙을 지켰는가?
   - ADR-005(정수 금액), ADR-006(스냅샷 컬럼), ADR-008(role 기반 관리자)을 반영했는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 마이그레이션 파일과 테이블·정책 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 실제 Supabase 프로젝트에 접속해서 마이그레이션을 적용하려 하지 마라. 이유: 이 세션에는 DB 자격 증명이 없고, 적용은 사람이 대시보드에서 한다. SQL 파일 작성까지가 이 step의 범위다.
- ORM(Prisma, Drizzle 등)을 도입하지 마라. 이유: ADR-002에서 명시적으로 배제했다.
- 애플리케이션 코드(`src/` 하위 파일)를 만들거나 수정하지 마라. 이유: Step 2 이후의 범위다.
- RLS를 끄거나 `using (true)`로 뭉개지 마라. 이유: anon 키는 브라우저에 공개되므로 RLS가 유일한 신뢰 경계다 (CLAUDE.md CRITICAL).
- 기존 테스트를 깨뜨리지 마라.
