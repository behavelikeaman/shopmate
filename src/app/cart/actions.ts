'use server'

// ══════════════════════════════════════════════════════════════
// [동작] 장바구니 담기·수량변경·삭제
// 브라우저가 보낸 수량을 그대로 믿지 않는다. 서버가 재고를 다시 읽어 판단한다.
// 품절이거나 재고가 모자라면 오류를 던지지 않고, 화면에 보여줄 문구를 돌려준다.
// ══════════════════════════════════════════════════════════════

// 장바구니 Server Action.
//
// 브라우저가 직접 부르는 함수다. 넘어온 상품 id 와 수량은 하나도 믿지 않고,
// 사용자·상품·재고를 서버에서 다시 읽어 판정한다 (CLAUDE.md, GLOSSARY "Server Action").
//
// 재고 부족·품절은 던지지 않고 { error } 로 돌려준다. 화면이 이유를 보여줘야 하기 때문이다.
import { revalidatePath } from 'next/cache'

import { clampQuantity } from '@/lib/cart'
import { getCurrentUser } from '@/services/auth'
import { mergeLocalCart, removeCartItem, setCartItem } from '@/services/cart'
import { getProduct } from '@/services/products'
import type { CartLine } from '@/types'

type ActionError = { error: string }

const NOT_LOGGED_IN: ActionError = { error: '로그인이 필요합니다' }
const NOT_FOUND: ActionError = { error: '상품을 찾을 수 없습니다' }
const SOLD_OUT: ActionError = { error: '품절된 상품입니다' }

/** 넘어온 수량을 정수로 정리한다. 재고 판정은 상품을 읽은 뒤에 따로 한다. */
function toRequestedQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0
  return Math.floor(quantity)
}

/**
 * 담기 · 수량 변경의 공통 경로. 수량은 "이만큼으로 맞춰라"는 뜻이다(더하지 않는다).
 * 장바구니에 누적하는 것은 상품 상세의 담기 버튼이 현재 수량을 알고 부르는 방식으로 처리한다.
 */
async function applyQuantity(productId: string, quantity: number): Promise<ActionError | void> {
  const user = await getCurrentUser()
  if (!user) return NOT_LOGGED_IN

  if (typeof productId !== 'string' || productId === '') return NOT_FOUND

  const requested = toRequestedQuantity(quantity)

  if (requested <= 0) {
    await removeCartItem(user.id, productId)
    revalidatePath('/cart')
    return
  }

  const product = await getProduct(productId)
  if (!product) return NOT_FOUND
  if (product.stock === 0) return SOLD_OUT

  // 클램프 규칙은 lib/cart.ts 가 갖고 있다. 여기서 다시 만들지 않는다.
  const allowed = clampQuantity(requested, product.stock)
  if (allowed < requested) {
    return { error: `재고가 부족합니다 (남은 수량: ${product.stock})` }
  }

  await setCartItem(user.id, productId, allowed)
  revalidatePath('/cart')
}

export async function addToCartAction(
  productId: string,
  quantity: number,
): Promise<ActionError | void> {
  return applyQuantity(productId, quantity)
}

export async function updateQuantityAction(
  productId: string,
  quantity: number,
): Promise<ActionError | void> {
  return applyQuantity(productId, quantity)
}

export async function removeFromCartAction(productId: string): Promise<ActionError | void> {
  const user = await getCurrentUser()
  if (!user) return NOT_LOGGED_IN
  if (typeof productId !== 'string' || productId === '') return NOT_FOUND

  await removeCartItem(user.id, productId)
  revalidatePath('/cart')
}

/** localStorage 에서 온 값이므로 모양부터 다시 검사한다. 재고 클램프는 mergeCartLines 가 한다. */
function sanitizeLocalLines(local: unknown): CartLine[] {
  if (!Array.isArray(local)) return []

  const lines: CartLine[] = []
  for (const item of local) {
    if (typeof item !== 'object' || item === null) continue
    const { productId, quantity } = item as { productId?: unknown; quantity?: unknown }
    if (typeof productId !== 'string' || productId === '') continue
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) continue

    const safeQuantity = Math.floor(quantity)
    if (safeQuantity > 0) lines.push({ productId, quantity: safeQuantity })
  }
  return lines
}

/** 로그인 직후 1회만 불린다 (CartMerge). 여러 번 불리면 수량이 계속 더해진다. */
export async function mergeLocalCartAction(local: CartLine[]): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const lines = sanitizeLocalLines(local)
  if (lines.length === 0) return

  await mergeLocalCart(user.id, lines)
  revalidatePath('/cart')
  revalidatePath('/', 'layout')
}
