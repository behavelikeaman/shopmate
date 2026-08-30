-- 0001_schema.sql — ShopMate 테이블 + 인덱스 + 가입 시 profiles 자동 생성 트리거 (재실행 가능)

-- ──────────────────────────────────────────────────────────────
-- 1. 프로필
--    role(권한)과 store_name(공개 스토어명)을 두 테이블로 나눈다 (ADR-011).
--    RLS는 행 단위라 "이 컬럼만 공개"가 불가능하기 때문이다.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'customer'
             check (role in ('customer', 'seller', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.seller_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  store_name text not null,
  created_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- 2. 상품
--    금액은 원 단위 정수만 쓴다 (ADR-005).
-- ──────────────────────────────────────────────────────────────

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  price       integer not null check (price >= 0),
  image_url   text,
  category    text not null,
  stock       integer not null default 0 check (stock >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists products_seller_id_idx on public.products (seller_id);
create index if not exists products_category_idx  on public.products (category);

-- ──────────────────────────────────────────────────────────────
-- 3. 장바구니
--    UNIQUE(cart_id, product_id) — 같은 상품이 두 줄로 들어가는 것을 DB가 막는다.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  unique (cart_id, product_id)
);

create index if not exists cart_items_cart_id_idx on public.cart_items (cart_id);

-- ──────────────────────────────────────────────────────────────
-- 4. 주문 3단 구조 (ADR-009)
--    orders          — 결제 단위. 배송지와 주문 시각만 둔다.
--    order_groups    — 판매자별 이행 단위. status·금액은 여기에만 있다.
--    order_items     — 품목. 상품명·단가를 스냅샷으로 복사한다 (ADR-006).
--
--    orders 에 total_amount·status 를 두지 않는 것은 의도된 설계다 (ADR-010).
--    판매자가 배송지를 읽어야 해서 orders SELECT 가 판매자에게 열리는데,
--    그 행에 총액이 있으면 "다른 판매자에게서 얼마를 샀는지"가 새어 나간다.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id),
  shipping_name    text not null,
  shipping_phone   text not null,
  shipping_address text not null,
  created_at       timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);

create table if not exists public.order_groups (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  seller_id    uuid not null references auth.users (id),
  status       text not null default 'paid'
               check (status in ('paid', 'shipped', 'cancelled')),
  subtotal     integer not null check (subtotal >= 0),
  shipping_fee integer not null check (shipping_fee >= 0),
  created_at   timestamptz not null default now(),
  shipped_at   timestamptz,
  cancelled_at timestamptz,
  unique (order_id, seller_id)
);

create index if not exists order_groups_order_id_idx         on public.order_groups (order_id);
create index if not exists order_groups_seller_id_status_idx on public.order_groups (seller_id, status);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.order_groups (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  unit_price    integer not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0)
);

create index if not exists order_items_group_id_idx on public.order_items (group_id);

-- ──────────────────────────────────────────────────────────────
-- 5. 가입 시 프로필 자동 생성
--    애플리케이션 코드가 profiles 를 만들게 하지 않는다.
--    가입 경로가 여러 개가 되면 누락되고, 프로필 없는 사용자가 생긴다.
--
--    raw_user_meta_data 에 is_seller=true 와 store_name 이 오면 판매자로 만든다.
--    role 이 'admin' 이 되는 경로는 여기에 없다 (ADR-008). 승격은 SQL 로만 한다.
-- ──────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_seller  boolean := coalesce(new.raw_user_meta_data ->> 'is_seller', 'false') = 'true';
  v_store_name text    := nullif(trim(coalesce(new.raw_user_meta_data ->> 'store_name', '')), '');
begin
  -- store_name 없이 판매자가 될 수는 없다. 스토어명은 상품 상세에 표시되어야 한다.
  if v_is_seller and v_store_name is null then
    v_is_seller := false;
  end if;

  insert into public.profiles (id, role)
  values (new.id, case when v_is_seller then 'seller' else 'customer' end)
  on conflict (id) do nothing;

  if v_is_seller then
    insert into public.seller_profiles (id, store_name)
    values (new.id, v_store_name)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
