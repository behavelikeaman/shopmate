-- 0002_rls.sql — RLS 활성화 + 정책. docs/ARCHITECTURE.md "권한(RLS)" 표를 SQL 로 옮긴 것 (재실행 가능)
--
-- 브라우저에 나가는 anon 키는 공개값이므로, 이 파일이 이 프로젝트의 유일한 신뢰 경계다 (ADR-002).
-- 화면의 접근 제어나 미들웨어는 편의일 뿐이다.

-- ──────────────────────────────────────────────────────────────
-- 0. 헬퍼 함수 (모두 security definer)
--
--    왜 필요한가: 정책 안에서 같은 테이블을 다시 조회하면 무한 재귀가 난다.
--    - profiles 정책 안에서 profiles 를 읽으면 → 자기 자신 재귀
--    - orders 정책이 order_groups 를 읽고, order_groups 정책이 orders 를 읽으면 → 상호 재귀
--    security definer 함수는 호출자의 RLS 를 거치지 않으므로 이 고리가 끊긴다.
-- ──────────────────────────────────────────────────────────────

-- 지금 요청한 사람이 운영자인가
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- 지금 요청한 사람의 현재 role (profiles UPDATE 시 role 위조를 막는 데 쓴다)
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

-- 이 주문의 주문자가 나인가
create or replace function public.owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.user_id = (select auth.uid())
  );
$$;

-- 이 주문 안에 내가 판매자인 그룹이 있는가 (판매자는 발송을 위해 배송지를 읽어야 한다)
create or replace function public.is_order_seller(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.order_groups g
    where g.order_id = p_order_id and g.seller_id = (select auth.uid())
  );
$$;

-- 이 주문 그룹을 볼 수 있는가 (order_items 는 상위 그룹의 권한을 그대로 따른다)
create or replace function public.can_read_order_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.order_groups g
    join public.orders o on o.id = g.order_id
    where g.id = p_group_id
      and (g.seller_id = (select auth.uid()) or o.user_id = (select auth.uid()))
  ) or public.is_admin();
$$;

-- ──────────────────────────────────────────────────────────────
-- 1. RLS 활성화 — 예외 없이 모든 테이블
-- ──────────────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.products        enable row level security;
alter table public.carts           enable row level security;
alter table public.cart_items      enable row level security;
alter table public.orders          enable row level security;
alter table public.order_groups    enable row level security;
alter table public.order_items     enable row level security;

-- ──────────────────────────────────────────────────────────────
-- 2. profiles — 본인만 SELECT. role 은 스스로 바꿀 수 없다 (ADR-008)
--    INSERT 정책은 없다. 프로필 생성은 가입 트리거(security definer)만 한다.
-- ──────────────────────────────────────────────────────────────

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  -- 새 행의 role 이 DB 에 저장된 현재 role 과 같아야 통과한다 → 스스로 admin 이 될 수 없다
  with check (id = (select auth.uid()) and role = public.current_profile_role());

-- ──────────────────────────────────────────────────────────────
-- 3. seller_profiles — 스토어명은 누구나(익명 포함) 읽는다. 상품 상세에 표시되기 때문이다.
--    공개되는 것은 스토어명뿐이고, role 은 여기에 없다 (ADR-011).
-- ──────────────────────────────────────────────────────────────

drop policy if exists seller_profiles_select_all on public.seller_profiles;
create policy seller_profiles_select_all on public.seller_profiles
  for select to anon, authenticated
  using (true);

drop policy if exists seller_profiles_insert_own on public.seller_profiles;
create policy seller_profiles_insert_own on public.seller_profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists seller_profiles_update_own on public.seller_profiles;
create policy seller_profiles_update_own on public.seller_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists seller_profiles_delete_own on public.seller_profiles;
create policy seller_profiles_delete_own on public.seller_profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- ──────────────────────────────────────────────────────────────
-- 4. products — 카탈로그는 누구나 읽는다. 변경은 그 상품의 판매자 또는 운영자만.
--    판매자 격리는 화면이 아니라 이 정책이 보장한다 (ADR-008).
-- ──────────────────────────────────────────────────────────────

drop policy if exists products_select_all on public.products;
create policy products_select_all on public.products
  for select to anon, authenticated
  using (true);

drop policy if exists products_insert_own on public.products;
create policy products_insert_own on public.products
  for insert to authenticated
  with check (seller_id = (select auth.uid()) or public.is_admin());

drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products
  for update to authenticated
  using (seller_id = (select auth.uid()) or public.is_admin())
  with check (seller_id = (select auth.uid()) or public.is_admin());

drop policy if exists products_delete_own on public.products;
create policy products_delete_own on public.products
  for delete to authenticated
  using (seller_id = (select auth.uid()) or public.is_admin());

-- ──────────────────────────────────────────────────────────────
-- 5. carts / cart_items — 본인 소유만. cart_items 는 상위 carts 로 소유를 판정한다.
-- ──────────────────────────────────────────────────────────────

drop policy if exists carts_select_own on public.carts;
create policy carts_select_own on public.carts
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists carts_insert_own on public.carts;
create policy carts_insert_own on public.carts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists carts_update_own on public.carts;
create policy carts_update_own on public.carts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists carts_delete_own on public.carts;
create policy carts_delete_own on public.carts
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists cart_items_select_own on public.cart_items;
create policy cart_items_select_own on public.cart_items
  for select to authenticated
  using (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
  ));

drop policy if exists cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own on public.cart_items
  for insert to authenticated
  with check (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
  ));

drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own on public.cart_items
  for update to authenticated
  using (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
  ));

drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own on public.cart_items
  for delete to authenticated
  using (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
  ));

-- ──────────────────────────────────────────────────────────────
-- 6. orders — 주문자 본인, 자기 그룹이 속한 주문의 판매자, 운영자가 읽는다.
--    INSERT 정책이 없다: 주문 생성은 create_order RPC(security definer, Step 6)만 한다.
--    UPDATE/DELETE 정책도 없다: 주문은 수정·삭제되지 않는다.
-- ──────────────────────────────────────────────────────────────

drop policy if exists orders_select_participants on public.orders;
create policy orders_select_participants on public.orders
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_order_seller(id)
    or public.is_admin()
  );

-- ──────────────────────────────────────────────────────────────
-- 7. order_groups — 주문자 본인, 그룹의 판매자, 운영자가 읽는다.
--    변경은 status 전이만 허용한다. 출발 상태는 항상 'paid' 다 (ADR-014, ADR-017).
--      판매자: paid → shipped | cancelled
--      구매자: paid → cancelled
--    INSERT/DELETE 정책은 없다 (생성은 RPC 안에서만).
-- ──────────────────────────────────────────────────────────────

drop policy if exists order_groups_select_participants on public.order_groups;
create policy order_groups_select_participants on public.order_groups
  for select to authenticated
  using (
    seller_id = (select auth.uid())
    or public.owns_order(order_id)
    or public.is_admin()
  );

drop policy if exists order_groups_update_seller on public.order_groups;
create policy order_groups_update_seller on public.order_groups
  for update to authenticated
  using (seller_id = (select auth.uid()) and status = 'paid')
  with check (seller_id = (select auth.uid()) and status in ('shipped', 'cancelled'));

drop policy if exists order_groups_update_buyer on public.order_groups;
create policy order_groups_update_buyer on public.order_groups
  for update to authenticated
  using (public.owns_order(order_id) and status = 'paid')
  with check (public.owns_order(order_id) and status = 'cancelled');

-- RLS 의 with check 는 "어떤 컬럼을 바꿨는지"를 보지 못한다.
-- 금액(subtotal·shipping_fee)까지 고쳐지는 것을 막기 위해 컬럼 단위 권한으로 한 번 더 좁힌다.
-- service_role 과 security definer RPC 는 이 제한을 받지 않는다.
revoke update on public.order_groups from anon, authenticated;
grant update (status, shipped_at, cancelled_at) on public.order_groups to authenticated;

-- ──────────────────────────────────────────────────────────────
-- 8. order_items — 상위 order_groups 의 권한을 그대로 따른다.
--    INSERT/UPDATE/DELETE 정책은 없다 (생성은 RPC 안에서만, 수정·삭제는 하지 않는다).
-- ──────────────────────────────────────────────────────────────

drop policy if exists order_items_select_participants on public.order_items;
create policy order_items_select_participants on public.order_items
  for select to authenticated
  using (public.can_read_order_group(group_id));
