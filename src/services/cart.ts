// ══════════════════════════════════════════════════════════════
// [창구] 장바구니 읽고 쓰기
// 로그인한 사람의 장바구니를 데이터베이스에서 읽고 고친다.
// 같은 상품을 또 담아도 줄이 두 개 생기지 않는다. 수량만 바뀐다.
// 재고보다 많은 수량은 저장 직전에 재고만큼으로 줄인다.
// ══════════════════════════════════════════════════════════════

// 서버 장바구니 (carts / cart_items).
//
// 전부 서버 클라이언트(anon + 쿠키 세션)를 쓴다. "남의 장바구니를 못 만진다"는 RLS 정책이
// 보장해야 하는 규칙이므로, admin 클라이언트로 우회하면 그 정책이 맞는지 영영 확인되지 않는다.
//
// 그룹핑·배송비·수량 클램프는 여기서 다시 구현하지 않고 lib/ 의 순수 함수를 부른다.
// 같은 규칙이 두 벌이 되면 한쪽만 고쳐져 화면 금액과 청구액이 어긋난다.
import 'server-only'

import { clampQuantity, mergeCartLines } from '@/lib/cart'
import { groupBySeller } from '@/lib/pricing'
import type { CartLine, CartLineView, SellerGroup } from '@/types'

import { getProductsByIds, getStockMap } from './products'
import { createServerSupabaseClient } from './supabase'

type CartItemRow = {
  product_id: string
  quantity: number
}

/** 장바구니 id 만 찾는다. 없으면 null — 조회 경로에서 빈 행을 만들지 않기 위해서다. */
async function findCartId(userId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`장바구니를 불러오지 못했습니다: ${error.message}`)
  return (data as { id: string } | null)?.id ?? null
}

/**
 * 장바구니 id. 없으면 만든다.
 * carts.user_id 에 unique 제약이 있으므로, 동시에 두 번 들어와 충돌(23505)하면
 * 다시 읽어서 이미 만들어진 행을 쓴다.
 */
export async function getOrCreateCart(userId: string): Promise<string> {
  const existing = await findCartId(userId)
  if (existing) return existing

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('id')
    .single()

  if (error) {
    const retried = await findCartId(userId)
    if (retried) return retried
    throw new Error(`장바구니를 만들지 못했습니다: ${error.message}`)
  }

  return (data as { id: string }).id
}

/** 저장된 줄. 상품 정보는 붙이지 않는다. 순서는 product_id 오름차순으로 고정한다. */
export async function getCartLines(userId: string): Promise<CartLine[]> {
  const cartId = await findCartId(userId)
  if (!cartId) return []

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cart_items')
    .select('product_id, quantity')
    .eq('cart_id', cartId)
    .order('product_id', { ascending: true })

  if (error) throw new Error(`장바구니를 불러오지 못했습니다: ${error.message}`)

  return ((data ?? []) as CartItemRow[]).map((row) => ({
    productId: row.product_id,
    quantity: row.quantity,
  }))
}

/**
 * 화면용 판매자별 묶음. 배송비 판정은 groupBySeller 가 한다 (ADR-012).
 * 그 사이 삭제된 상품은 조용히 빠진다 — 장바구니 때문에 화면이 죽으면 안 된다.
 */
export async function getCartGroups(userId: string): Promise<SellerGroup[]> {
  const lines = await getCartLines(userId)
  if (lines.length === 0) return []

  const products = await getProductsByIds(lines.map((line) => line.productId))
  const byId = new Map(products.map((product) => [product.id, product]))

  const views: CartLineView[] = []
  for (const line of lines) {
    const product = byId.get(line.productId)
    if (product) views.push({ ...line, product })
  }

  return groupBySeller(views)
}

/**
 * 수량 지정. 같은 상품을 몇 번 불러도 결과가 같다(멱등) — 더하지 않고 덮어쓴다.
 * unique (cart_id, product_id) 를 충돌 대상으로 삼아 upsert 한다.
 *
 * 수량은 저장 직전에 DB 의 현재 재고로 다시 클램프한다. 호출자가 이미 검사했더라도
 * 여기가 마지막 관문이다 — 재고보다 많은 수량이 저장되면 주문 단계에서 터진다.
 */
export async function setCartItem(
  userId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const stockMap = await getStockMap([productId])
  const stock = stockMap[productId] ?? 0
  const safeQuantity = clampQuantity(quantity, stock)

  if (safeQuantity <= 0) {
    await removeCartItem(userId, productId)
    return
  }

  const cartId = await getOrCreateCart(userId)
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('cart_items')
    .upsert(
      { cart_id: cartId, product_id: productId, quantity: safeQuantity },
      { onConflict: 'cart_id,product_id' },
    )

  if (error) throw new Error(`장바구니에 담지 못했습니다: ${error.message}`)
}

export async function removeCartItem(userId: string, productId: string): Promise<void> {
  const cartId = await findCartId(userId)
  if (!cartId) return

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', cartId)
    .eq('product_id', productId)

  if (error) throw new Error(`장바구니에서 빼지 못했습니다: ${error.message}`)
}

export async function clearCart(userId: string): Promise<void> {
  const cartId = await findCartId(userId)
  if (!cartId) return

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId)

  if (error) throw new Error(`장바구니를 비우지 못했습니다: ${error.message}`)
}

/**
 * 비로그인 장바구니를 서버 장바구니에 합친다 (ADR-007).
 * 합치는 규칙(수량 합산·재고 클램프·삭제/품절 제외)은 mergeCartLines 가 갖고 있다.
 */
export async function mergeLocalCart(userId: string, local: CartLine[]): Promise<void> {
  if (local.length === 0) return

  const server = await getCartLines(userId)
  const stockMap = await getStockMap([
    ...local.map((line) => line.productId),
    ...server.map((line) => line.productId),
  ])

  const merged = mergeCartLines(local, server, stockMap)

  const cartId = await getOrCreateCart(userId)
  const supabase = await createServerSupabaseClient()

  // 결과로 통째로 바꾼다. 남은 줄을 골라 지우는 것보다 어긋날 여지가 적다.
  const { error: deleteError } = await supabase.from('cart_items').delete().eq('cart_id', cartId)
  if (deleteError) throw new Error(`장바구니를 합치지 못했습니다: ${deleteError.message}`)

  if (merged.length === 0) return

  const { error: insertError } = await supabase.from('cart_items').insert(
    merged.map((line) => ({
      cart_id: cartId,
      product_id: line.productId,
      quantity: line.quantity,
    })),
  )
  if (insertError) throw new Error(`장바구니를 합치지 못했습니다: ${insertError.message}`)
}

/** 헤더 뱃지용. 줄 수가 아니라 담긴 물건의 총 개수다. */
export async function getCartCount(userId: string): Promise<number> {
  const lines = await getCartLines(userId)
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}
