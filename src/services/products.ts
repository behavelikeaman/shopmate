// 상품 조회. 전부 서버 클라이언트(anon + 세션)를 쓴다 — 카탈로그는 익명도 읽을 수 있으므로
// admin 클라이언트가 필요 없다. RLS 를 우회하면 정책이 맞는지 영영 확인되지 않는다.
import type { Product, Seller } from '@/types'
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
const UNKNOWN_STORE_NAME = '알 수 없는 판매자'

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
async function fetchSellers(sellerIds: string[]): Promise<Map<string, Seller>> {
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
