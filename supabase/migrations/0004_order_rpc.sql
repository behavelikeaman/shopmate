-- ══════════════════════════════════════════════════════════════
-- [금고] 주문·취소·발송 처리
-- ★ 주문의 심장이다. 여기가 틀리면 돈과 재고가 어긋난다.
-- 주문 한 번에는 세 가지 일이 동시에 일어난다:
--   주문서 저장 → 재고 차감 → 장바구니 비우기
-- 중간에 하나라도 실패하면 전부 없던 일이 된다. 그래서 데이터베이스 안에 넣었다.
--
-- 동시에 두 사람이 같은 물건을 살 때를 막는 방법:
--   '재고를 확인하고 나서 빼기' 가 아니라 '재고가 충분할 때만 빼기' 로 쓴다.
--   확인과 빼기가 한 동작이라 그 사이에 끼어들 틈이 없다.
-- 취소도 같다. 두 번 눌러도 재고는 한 번만 복구된다.
-- ══════════════════════════════════════════════════════════════

-- 0004_order_rpc.sql — 주문 생성 · 취소 · 발송 Postgres 함수 (재실행 가능)
--
-- 왜 앱 코드가 아니라 DB 함수인가 (ADR-013):
--   주문 생성은 orders + order_groups + order_items INSERT + 재고 차감 + 장바구니 비우기다.
--   앱에서 쿼리를 여러 번 날리면 중간에 실패했을 때 재고와 주문이 어긋난 채로 남는다.
--   함수 한 번의 호출은 통째로 하나의 트랜잭션이므로, 실패하면 전부 없던 일이 된다.
--
-- 상태 변경과 재고 이동은 예외 없이 **조건부 UPDATE 의 영향 행 수**로 판정한다 (ADR-014).
-- select 로 확인한 뒤 update 하면 그 사이에 다른 요청이 끼어들어
-- 재고가 음수가 되거나 취소 한 번에 재고가 두 배로 복구된다.

-- ──────────────────────────────────────────────────────────────
-- 0. 배송비 규칙
--
--    같은 규칙이 src/lib/pricing.ts 에도 있다 (화면 표시용, ADR-015).
--    임계값 50000 · 배송비 3000 은 양쪽이 반드시 같은 값이어야 한다.
--    한쪽만 고치면 화면에 보인 금액과 실제 청구액이 달라진다.
--
--    판정 기준은 주문 전체 소계가 아니라 **판매자 그룹 소계**다 (ADR-012).
-- ──────────────────────────────────────────────────────────────

create or replace function public.shipping_fee_for(p_subtotal integer)
returns integer
language sql
immutable
as $$
  select case when p_subtotal >= 50000 then 0 else 3000 end;
$$;

comment on function public.shipping_fee_for(integer) is
  '판매자 그룹 소계로 배송비를 판정한다. src/lib/pricing.ts 의 FREE_SHIPPING_THRESHOLD=50000 · SHIPPING_FEE=3000 과 같은 값이어야 한다 (ADR-015).';

-- ──────────────────────────────────────────────────────────────
-- 1. 주문 생성
--
--    사용자 id 를 인자로 받지 않는다. 받으면 남의 이름으로 주문할 수 있다.
--    호출자는 오직 auth.uid() 로 판정한다.
--
--    금액·수량도 인자에 없다. 품목은 서버 장바구니에서, 가격·재고·판매자는
--    products 에서 지금 다시 읽는다. 클라이언트가 보낸 값은 애초에 들어올 자리가 없다.
-- ──────────────────────────────────────────────────────────────

create or replace function public.create_order(
  p_shipping_name    text,
  p_shipping_phone   text,
  p_shipping_address text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id  uuid := auth.uid();
  v_cart_id  uuid;
  v_order_id uuid;
  v_shortage text;
  v_item     record;
  v_updated  integer;
begin
  -- 1. 로그인 확인
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if nullif(trim(coalesce(p_shipping_name, '')), '') is null
     or nullif(trim(coalesce(p_shipping_phone, '')), '') is null
     or nullif(trim(coalesce(p_shipping_address, '')), '') is null then
    raise exception '배송지 정보를 모두 입력해 주세요.';
  end if;

  -- 2. 서버 장바구니를 읽는다
  select c.id into v_cart_id
  from public.carts c
  where c.user_id = v_user_id;

  if v_cart_id is null
     or not exists (select 1 from public.cart_items ci where ci.cart_id = v_cart_id) then
    raise exception '장바구니가 비어 있습니다.';
  end if;

  -- 3~4. 상품의 현재 가격·재고·판매자를 다시 읽고, 하나라도 모자라면 주문 전체를 실패시킨다.
  --      부분 주문은 만들지 않는다 (PRD).
  --      이 조회는 "무엇이 몇 개 모자란지"를 알려주기 위한 것이다.
  --      재고가 음수가 되지 않게 막는 실제 방어선은 7번의 조건부 UPDATE 다.
  select string_agg(
           format('%s (재고 %s개, 주문 %s개)', p.name, p.stock, ci.quantity),
           ', ' order by p.name
         )
    into v_shortage
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id
    and p.stock < ci.quantity;

  if v_shortage is not null then
    raise exception '재고가 부족한 상품이 있어 주문할 수 없습니다: %', v_shortage;
  end if;

  -- 5. orders 1행. 배송지와 주문 시각만 둔다 — total_amount·status 컬럼은 존재하지 않는다 (ADR-010).
  insert into public.orders (user_id, shipping_name, shipping_phone, shipping_address)
  values (v_user_id, trim(p_shipping_name), trim(p_shipping_phone), trim(p_shipping_address))
  returning id into v_order_id;

  -- 6. 판매자별 그룹. 소계와 배송비는 그 그룹 안에서만 계산한다 (ADR-012).
  --    status 는 생성 시점에 'paid' — 결제는 모의 승인이다 (ADR-003).
  insert into public.order_groups (order_id, seller_id, status, subtotal, shipping_fee)
  select
    v_order_id,
    p.seller_id,
    'paid',
    sum(p.price * ci.quantity)::integer,
    public.shipping_fee_for(sum(p.price * ci.quantity)::integer)
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id
  group by p.seller_id;

  -- 6-2. 품목. 상품명과 단가를 지금 값으로 복사한다 (ADR-006).
  --      나중에 가격이 바뀌거나 상품이 삭제돼도 이 영수증은 변하지 않는다.
  insert into public.order_items (group_id, product_id, name_snapshot, unit_price, quantity)
  select g.id, p.id, p.name, p.price, ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  join public.order_groups g
    on g.order_id = v_order_id and g.seller_id = p.seller_id
  where ci.cart_id = v_cart_id;

  -- 7. 재고 차감. 조건부 UPDATE 이므로 확인과 차감 사이에 다른 주문이 끼어들 틈이 없다 (ADR-014).
  --    product_id 순서로 도는 것은 동시 주문끼리 서로를 기다리다 엉키는(교착) 것을 피하기 위해서다.
  for v_item in
    select ci.product_id, ci.quantity
    from public.cart_items ci
    where ci.cart_id = v_cart_id
    order by ci.product_id
  loop
    update public.products
       set stock = stock - v_item.quantity
     where id = v_item.product_id
       and stock >= v_item.quantity;

    get diagnostics v_updated = row_count;

    -- 영향 행 0 = 그 사이에 남이 먼저 사갔다. 예외를 던지면 여기까지 한 일이 전부 롤백된다.
    if v_updated = 0 then
      raise exception '재고가 부족해 주문에 실패했습니다. 장바구니를 다시 확인해 주세요.';
    end if;
  end loop;

  -- 8. 장바구니 비우기
  delete from public.cart_items where cart_id = v_cart_id;

  -- 9. 생성된 주문 id
  return v_order_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 2. 주문 그룹 취소 (ADR-017)
--
--    취소 단위는 주문 전체가 아니라 판매자 그룹이다.
--    구매자 본인과 그 그룹의 판매자가 각각 취소할 수 있고, 운영자도 할 수 있다.
--
--    이 함수는 멱등이다. 두 번 호출하면 두 번째는 2단계에서 실패하고,
--    재고는 한 번만 복구된다.
-- ──────────────────────────────────────────────────────────────

create or replace function public.cancel_order_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 1. 호출자 확인. 구매자 본인이거나, 그 그룹의 판매자이거나, 운영자여야 한다.
  --    (권한 판정이지 상태 판정이 아니다. 상태는 2번의 조건부 UPDATE 가 본다.)
  if not exists (
    select 1
    from public.order_groups g
    join public.orders o on o.id = g.order_id
    where g.id = p_group_id
      and (o.user_id = v_user_id or g.seller_id = v_user_id)
  ) and not public.is_admin() then
    raise exception '이 주문을 취소할 권한이 없습니다.';
  end if;

  -- 2. 조건부 UPDATE. 멱등성의 핵심이다 (ADR-014).
  update public.order_groups
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_group_id
     and status = 'paid';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception '이미 취소되었거나 발송된 주문은 취소할 수 없습니다.';
  end if;

  -- 3. 영향 행이 1이었을 때만 여기까지 온다. 그러므로 재고는 한 번만 복구된다.
  --    product_id 가 NULL 이면(상품이 삭제됨) 건너뛴다 (ADR-006).
  update public.products p
     set stock = p.stock + i.quantity
  from public.order_items i
  where i.group_id = p_group_id
    and i.product_id is not null
    and p.id = i.product_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 3. 발송 처리
--
--    재고는 건드리지 않는다. 주문 시점에 이미 차감되었다.
-- ──────────────────────────────────────────────────────────────

create or replace function public.ship_order_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 발송은 그 그룹의 판매자(또는 운영자)만 한다. 구매자는 할 수 없다.
  if not exists (
    select 1 from public.order_groups g
    where g.id = p_group_id and g.seller_id = v_user_id
  ) and not public.is_admin() then
    raise exception '이 주문을 발송 처리할 권한이 없습니다.';
  end if;

  update public.order_groups
     set status = 'shipped',
         shipped_at = now()
   where id = p_group_id
     and status = 'paid';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception '발송 준비중인 주문만 발송 처리할 수 있습니다.';
  end if;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 4. 실행 권한 — 로그인한 사용자에게만. 익명에게는 주지 않는다.
--    security definer 함수는 소유자 권한으로 돌기 때문에 실행 권한을 좁게 잡아야 한다.
-- ──────────────────────────────────────────────────────────────

revoke all on function public.shipping_fee_for(integer)     from public, anon;
revoke all on function public.create_order(text, text, text) from public, anon;
revoke all on function public.cancel_order_group(uuid)       from public, anon;
revoke all on function public.ship_order_group(uuid)         from public, anon;

grant execute on function public.shipping_fee_for(integer)      to authenticated;
grant execute on function public.create_order(text, text, text) to authenticated;
grant execute on function public.cancel_order_group(uuid)       to authenticated;
grant execute on function public.ship_order_group(uuid)         to authenticated;
