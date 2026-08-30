// ══════════════════════════════════════════════════════════════
// [창구] 상품 읽고 쓰기
// 상품 목록·상세·카테고리를 데이터베이스에서 가져온다. 판매자 상품 등록·수정·삭제도 여기 있다.
// 상품 등록 시 '누가 파는지'는 폼에서 받지 않고 서버가 로그인 정보로 채운다.
//   폼에서 받으면 남의 이름으로 상품을 올릴 수 있다.
// ══════════════════════════════════════════════════════════════

// 상품 조회. 전부 서버 클라이언트(anon + 세션)를 쓴다 — 카탈로그는 익명도 읽을 수 있으므로
// admin 클라이언트가 필요 없다. RLS 를 우회하면 정책이 맞는지 영영 확인되지 않는다.
import type { ProductInput } from '@/lib/product-form'
import type { Product, Seller } from '@/types'

import { getCurrentProfile } from './auth'
import { createServerSupabaseClient } from './supabase'

/** products 테이블의 원본 행 모양 (snake_case). 이 이름은 이 파일 밖으로 나가지 않는다. */
type ProductRow = {
  id: string
  seller_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string
  stock: number
  created_at: string
}

const PRODUCT_COLUMNS =
  'id, seller_id, name, description, price, image_url, category, stock, created_at'

/** 스토어명을 못 찾았을 때 화면에 보여줄 값. 이름이 비어 보이는 것보다 낫다. */
export const UNKNOWN_STORE_NAME = '알 수 없는 판매자'

function toProduct(row: ProductRow, seller: Seller): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    imageUrl: row.image_url,
    category: row.category,
    stock: row.stock,
    createdAt: row.created_at,
    seller,
  }
}

/**
 * 판매자명을 seller_profiles 에서 채운다 (ADR-011).
 * profiles 를 읽으면 안 된다 — 본인 행만 읽히므로 남의 스토어명이 나오지 않는다.
 *
 * PostgREST 의 임베디드 조인 대신 두 번째 조회로 붙이는 이유:
 * products.seller_id 와 seller_profiles.id 는 둘 다 auth.users 를 가리킬 뿐,
 * 서로를 가리키는 외래키가 없어서 조인 경로가 자동으로 추론되지 않는다.
 */
export async function fetchSellers(sellerIds: string[]): Promise<Map<string, Seller>> {
  const unique = [...new Set(sellerIds)]
  if (unique.length === 0) return new Map()

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('seller_profiles')
    .select('id, store_name')
    .in('id', unique)

  if (error) {
    throw new Error(`판매자 정보를 불러오지 못했습니다: ${error.message}`)
  }

  const sellers = new Map<string, Seller>()
  for (const row of (data ?? []) as { id: string; store_name: string }[]) {
    sellers.set(row.id, { id: row.id, storeName: row.store_name })
  }
  return sellers
}

async function attachSellers(rows: ProductRow[]): Promise<Product[]> {
  const sellers = await fetchSellers(rows.map((row) => row.seller_id))
  return rows.map((row) =>
    toProduct(
      row,
      sellers.get(row.seller_id) ?? { id: row.seller_id, storeName: UNKNOWN_STORE_NAME },
    ),
  )
}

/**
 * 상품 목록. 정렬은 등록순(created_at)이다 —
 * 품절 상품도 목록에 그대로 두고 뒤로 밀지 않는다 (PRD 재고 규칙).
 */
export async function listProducts(opts?: {
  category?: string
  query?: string
}): Promise<Product[]> {
  const supabase = await createServerSupabaseClient()

  let request = supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .order('created_at', { ascending: true })

  if (opts?.category) {
    request = request.eq('category', opts.category)
  }
  if (opts?.query) {
    request = request.ilike('name', `%${opts.query}%`)
  }

  const { data, error } = await request
  if (error) {
    throw new Error(`상품 목록을 불러오지 못했습니다: ${error.message}`)
  }

  return attachSellers((data ?? []) as ProductRow[])
}

/** 없는 id 는 에러가 아니라 null 이다. 404 화면은 호출하는 쪽이 결정한다. */
export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`상품을 불러오지 못했습니다: ${error.message}`)
  }
  if (!data) return null

  const products = await attachSellers([data as ProductRow])
  return products[0]
}

/** 카테고리 필터용 목록. 중복을 제거하고 가나다순으로 돌려준다. */
export async function listCategories(): Promise<string[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.from('products').select('category')
  if (error) {
    throw new Error(`카테고리를 불러오지 못했습니다: ${error.message}`)
  }

  const categories = new Set((data ?? []).map((row) => (row as { category: string }).category))
  return [...categories].sort((a, b) => a.localeCompare(b, 'ko'))
}

/**
 * 상품 id → 현재 재고. 장바구니 병합에서 수량을 재고로 클램프할 때 쓴다.
 * 존재하지 않는 id 는 결과에서 빠진다 (0 으로 채우지 않는다 — "삭제됨"과 "품절"은 다르다).
 */
export async function getStockMap(productIds: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(productIds)]
  if (unique.length === 0) return {}

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('products').select('id, stock').in('id', unique)

  if (error) {
    throw new Error(`재고를 불러오지 못했습니다: ${error.message}`)
  }

  const stockMap: Record<string, number> = {}
  for (const row of (data ?? []) as { id: string; stock: number }[]) {
    stockMap[row.id] = row.stock
  }
  return stockMap
}

/**
 * 여러 상품을 한 번에. 비로그인 장바구니(localStorage 에 id 만 있다)를 화면에 그릴 때 쓴다.
 * 없는 id 는 조용히 빠진다 — 삭제된 상품이 장바구니에 남아 있을 수 있기 때문이다.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .in('id', unique)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`상품을 불러오지 못했습니다: ${error.message}`)
  }

  return attachSellers((data ?? []) as ProductRow[])
}

// ──────────────────────────────────────────────────────────────
// 판매자 콘솔용. 전부 서버 클라이언트(anon + 세션)라서 RLS 의 판매자 정책이 그대로 적용된다.
// admin(service_role) 클라이언트로 우회하면 정책이 틀려도 알 수 없다 (ARCHITECTURE).
// ──────────────────────────────────────────────────────────────

/** 폼 → DB 컬럼(snake_case) 변환. seller_id 는 여기에 없다 — 호출자가 서버 세션에서 채운다. */
function toProductRow(input: ProductInput) {
  return {
    name: input.name,
    description: input.description,
    price: input.price,
    image_url: input.imageUrl,
    category: input.category,
    stock: input.stock,
  }
}

/**
 * 내 상품 등록.
 *
 * seller_id 는 폼에서 받지 않고 서버가 현재 사용자로 채운다 —
 * 받으면 남의 이름으로 상품을 올릴 수 있다. RLS 의 with check 도 같은 것을 한 번 더 막는다.
 */
export async function createProduct(input: ProductInput): Promise<Product> {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다')

  const { data, error } = await supabase
    .from('products')
    .insert({ ...toProductRow(input), seller_id: user.id })
    .select(PRODUCT_COLUMNS)
    .single()

  if (error) {
    throw new Error(`상품을 등록하지 못했습니다: ${error.message}`)
  }

  const products = await attachSellers([data as ProductRow])
  return products[0]
}

/**
 * 내 상품 수정.
 *
 * seller_id 는 갱신 대상에 넣지 않는다(상품의 주인은 바뀌지 않는다).
 * 남의 상품 id 로 불러도 RLS 가 걸러 0 행이 갱신되고, 그때 maybeSingle 이 null 을 준다.
 */
export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('products')
    .update(toProductRow(input))
    .eq('id', id)
    .select(PRODUCT_COLUMNS)
    .maybeSingle()

  if (error) {
    throw new Error(`상품을 수정하지 못했습니다: ${error.message}`)
  }
  // 없는 상품과 남의 상품은 구분하지 않는다 — 남의 상품이 존재한다는 사실도 알려줄 이유가 없다.
  if (!data) {
    throw new Error('상품을 수정하지 못했습니다: 내 상품이 아니거나 이미 삭제되었습니다')
  }

  const products = await attachSellers([data as ProductRow])
  return products[0]
}

/**
 * 내 상품 삭제.
 *
 * 관련 order_items 는 건드리지 않는다. order_items.product_id 는 on delete set null 이라
 * 참조만 끊기고, 주문의 상품명·단가 스냅샷은 그대로 남는다 (ADR-006).
 */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) {
    throw new Error(`상품을 삭제하지 못했습니다: ${error.message}`)
  }
}

/**
 * 내 상품 목록. admin 이면 전체가 보인다 (ADR-016 — 운영자 전용 화면을 만들지 않는다).
 *
 * where seller_id = 나 는 의도를 드러내려고 쓴다.
 * 이 조건을 빼먹어도 남의 상품이 나오면 안 된다 — 그 보장은 RLS 가 한다 (ADR-008).
 */
export async function listMyProducts(): Promise<Product[]> {
  const supabase = await createServerSupabaseClient()

  const profile = await getCurrentProfile()
  if (!profile) throw new Error('로그인이 필요합니다')

  // admin 은 전체를 봐야 하므로 자기 id 조건을 걸지 않는다. 걸러내는 쪽은 어느 경우든 RLS 다.
  let request = supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .order('created_at', { ascending: false })

  if (profile.role !== 'admin') {
    request = request.eq('seller_id', profile.id)
  }

  const { data, error } = await request
  if (error) {
    throw new Error(`내 상품을 불러오지 못했습니다: ${error.message}`)
  }

  return attachSellers((data ?? []) as ProductRow[])
}
