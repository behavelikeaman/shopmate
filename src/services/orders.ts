// ══════════════════════════════════════════════════════════════
// [창구] 주문 읽고 쓰기
// 주문 목록·상세를 읽고, 주문 만들기·취소·발송을 데이터베이스에 요청한다.
// ★ 주문을 만드는 계산은 여기에 없다. 데이터베이스 안의 함수를 부르기만 한다.
//   이유: 주문은 '주문서 저장 + 재고 차감 + 장바구니 비우기'를 한 덩어리로 해야 하기 때문이다.
// 주문 내역의 가격은 그때 저장해둔 값을 쓴다. 상품 가격이 나중에 바뀌어도 영수증은 안 변한다.
// ══════════════════════════════════════════════════════════════

// 주문 조회 · 주문 생성/취소/발송 RPC 호출.
//
// 이 파일에는 주문 로직이 없다. 재고 확인·금액 계산·INSERT 는 전부
// create_order / cancel_order_group / ship_order_group 안에서 한 트랜잭션으로 일어난다 (ADR-013).
// 여기서 같은 일을 TypeScript 로 다시 하면 중간에 실패했을 때 재고와 주문이 어긋난다.
//
// 조회는 order_items 의 스냅샷(name_snapshot, unit_price)만 읽는다.
// products 를 조인해 현재 가격을 보여주면 과거 주문 금액이 소급 변경된다 (ADR-006).
//
// 전부 서버 클라이언트(anon + 쿠키 세션)다. "내 주문만", "판매자는 자기 그룹만"은 RLS 가 보장한다.
import 'server-only'

import type {
  GroupStatus,
  Order,
  OrderGroup,
  OrderItem,
  Seller,
  SellerOrderGroup,
  ShippingInfo,
} from '@/types'

import { getCurrentProfile } from './auth'
import { fetchSellers, UNKNOWN_STORE_NAME } from './products'
import { createServerSupabaseClient } from './supabase'

/**
 * RPC 예외 메시지를 사용자에게 보여줄 문장으로 바꾼다.
 *
 * 0004_order_rpc.sql 이 던지는 예외는 전부 한국어 완성문이므로 그대로 쓴다
 * ('장바구니가 비어 있습니다.', '재고가 부족한 상품이 있어…' 등).
 * 한글이 없는 메시지는 우리가 쓴 문장이 아니라 Postgres/PostgREST 원문이다 —
 * 제약 이름이나 컬럼 구조가 그대로 노출되므로 감싼다.
 */
function toUserMessage(message: string | undefined, fallback: string): string {
  const text = (message ?? '').trim()
  return /[가-힣]/.test(text) ? text : fallback
}

type OrderItemRow = {
  id: string
  product_id: string | null
  name_snapshot: string
  unit_price: number
  quantity: number
}

type OrderGroupRow = {
  id: string
  seller_id: string
  status: GroupStatus
  subtotal: number
  shipping_fee: number
  shipped_at: string | null
  cancelled_at: string | null
  order_items: OrderItemRow[] | null
}

type OrderRow = {
  id: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  created_at: string
  order_groups: OrderGroupRow[] | null
}

// order_groups → orders, order_items → order_groups 는 외래키가 있으므로 임베디드 조인이 된다.
// seller_profiles 만 조인 경로가 없어 따로 읽는다 (products.ts 의 fetchSellers 와 같은 이유).
const ORDER_COLUMNS = `
  id, shipping_name, shipping_phone, shipping_address, created_at,
  order_groups (
    id, seller_id, status, subtotal, shipping_fee, shipped_at, cancelled_at,
    order_items ( id, product_id, name_snapshot, unit_price, quantity )
  )
`

/** 판매자 콘솔은 그룹에서 시작해 주문(배송지)을 거꾸로 붙인다. */
type SellerGroupRow = OrderGroupRow & {
  order_id: string
  created_at: string
  orders: {
    shipping_name: string
    shipping_phone: string
    shipping_address: string
    created_at: string
  } | null
}

const SELLER_GROUP_COLUMNS = `
  id, order_id, seller_id, status, subtotal, shipping_fee, created_at, shipped_at, cancelled_at,
  order_items ( id, product_id, name_snapshot, unit_price, quantity ),
  orders ( shipping_name, shipping_phone, shipping_address, created_at )
`

function toItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    nameSnapshot: row.name_snapshot,
    unitPrice: row.unit_price,
    quantity: row.quantity,
  }
}

function toGroup(row: OrderGroupRow, seller: Seller): OrderGroup {
  return {
    id: row.id,
    seller,
    status: row.status,
    subtotal: row.subtotal,
    shippingFee: row.shipping_fee,
    items: (row.order_items ?? []).map(toItem),
    shippedAt: row.shipped_at,
    cancelledAt: row.cancelled_at,
  }
}

/** 그룹 순서는 스토어명 → 판매자 id 로 고정한다 (장바구니의 groupBySeller 와 같은 규칙). */
function sortGroups(groups: OrderGroup[]): OrderGroup[] {
  return groups.sort(
    (a, b) =>
      a.seller.storeName.localeCompare(b.seller.storeName, 'ko') ||
      a.seller.id.localeCompare(b.seller.id),
  )
}

async function toOrders(rows: OrderRow[]): Promise<Order[]> {
  const sellerIds = rows.flatMap((row) => (row.order_groups ?? []).map((g) => g.seller_id))
  const sellers = await fetchSellers(sellerIds)

  return rows.map((row) => ({
    id: row.id,
    shipping: {
      name: row.shipping_name,
      phone: row.shipping_phone,
      address: row.shipping_address,
    },
    createdAt: row.created_at,
    groups: sortGroups(
      (row.order_groups ?? []).map((group) =>
        toGroup(
          group,
          sellers.get(group.seller_id) ?? {
            id: group.seller_id,
            storeName: UNKNOWN_STORE_NAME,
          },
        ),
      ),
    ),
  }))
}

/**
 * 주문 생성. RPC 한 번이 전부다.
 * 품목·금액은 인자에 없다 — RPC 가 서버 장바구니와 products 를 다시 읽는다 (ADR-013).
 */
export async function createOrder(
  shipping: ShippingInfo,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc('create_order', {
    p_shipping_name: shipping.name,
    p_shipping_phone: shipping.phone,
    p_shipping_address: shipping.address,
  })

  if (error) {
    return { ok: false, error: toUserMessage(error.message, '주문을 처리하지 못했습니다') }
  }
  if (typeof data !== 'string' || data === '') {
    return { ok: false, error: '주문을 처리하지 못했습니다' }
  }

  return { ok: true, orderId: data }
}

/** 내 주문 목록. "내 것만" 거르는 조건은 쓰지 않는다 — RLS 가 이미 거른다. */
export async function listOrders(): Promise<Order[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`주문 내역을 불러오지 못했습니다: ${error.message}`)

  return toOrders((data ?? []) as unknown as OrderRow[])
}

/** 없는 주문과 남의 주문은 똑같이 null 이다 (RLS 가 남의 행을 아예 돌려주지 않는다). */
export async function getOrder(orderId: string): Promise<Order | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .maybeSingle()

  if (error) throw new Error(`주문을 불러오지 못했습니다: ${error.message}`)
  if (!data) return null

  const orders = await toOrders([data as unknown as OrderRow])
  return orders[0] ?? null
}

/**
 * 그룹 취소. 권한 판정도 상태 판정도 RPC 안에서 한다 (ADR-014, ADR-017).
 * 여러 번 불려도 재고는 한 번만 복구된다.
 */
export async function cancelOrderGroup(
  groupId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.rpc('cancel_order_group', { p_group_id: groupId })
  if (error) {
    return { ok: false, error: toUserMessage(error.message, '주문을 처리하지 못했습니다') }
  }

  return { ok: true }
}

/** 발송 처리. 화면은 Step 9 의 판매자 콘솔에서 붙인다. */
export async function shipOrderGroup(
  groupId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.rpc('ship_order_group', { p_group_id: groupId })
  if (error) {
    return { ok: false, error: toUserMessage(error.message, '주문을 처리하지 못했습니다') }
  }

  return { ok: true }
}

/**
 * 판매자 콘솔용 — 내게 들어온 주문 그룹 목록. admin 이면 전체가 보인다 (ADR-016).
 *
 * order_groups 에서 시작해 orders(배송지)와 order_items(스냅샷)를 임베디드 조인으로 붙인다.
 * 이렇게 하면 같은 주문의 다른 판매자 그룹은 애초에 결과에 들어오지 않는다.
 *
 * where seller_id = 나 는 의도를 드러내려고 쓴다. 이 조건을 빼먹어도 남의 그룹이 나오면
 * 안 되고, 그 보장은 RLS 의 order_groups_select_participants 가 한다 (ADR-008).
 */
export async function listSellerOrderGroups(): Promise<SellerOrderGroup[]> {
  const supabase = await createServerSupabaseClient()

  const profile = await getCurrentProfile()
  if (!profile) throw new Error('로그인이 필요합니다')

  let request = supabase
    .from('order_groups')
    .select(SELLER_GROUP_COLUMNS)
    .order('created_at', { ascending: false })

  if (profile.role !== 'admin') {
    request = request.eq('seller_id', profile.id)
  }

  const { data, error } = await request
  if (error) throw new Error(`주문을 불러오지 못했습니다: ${error.message}`)

  const rows = (data ?? []) as unknown as SellerGroupRow[]
  const sellers = await fetchSellers(rows.map((row) => row.seller_id))

  return rows.map((row) => {
    const seller = sellers.get(row.seller_id) ?? {
      id: row.seller_id,
      storeName: UNKNOWN_STORE_NAME,
    }

    return {
      ...toGroup(row, seller),
      orderId: row.order_id,
      orderedAt: row.orders?.created_at ?? row.created_at,
      shipping: {
        name: row.orders?.shipping_name ?? '',
        phone: row.orders?.shipping_phone ?? '',
        address: row.orders?.shipping_address ?? '',
      },
    }
  })
}
