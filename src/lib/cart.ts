import type { CartLine } from '@/types'

/** 수량을 [0, stock] 범위의 정수로 맞춘다. 0은 "삭제 의도"를 뜻한다. */
export function clampQuantity(quantity: number, stock: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(stock)) return 0

  const maxQuantity = Math.floor(stock)
  const wanted = Math.floor(quantity)

  if (maxQuantity <= 0 || wanted < 1) return 0
  return Math.min(wanted, maxQuantity)
}

/**
 * 비로그인 장바구니(local)와 서버 장바구니(server)를 합친다 (ADR-007).
 *
 * - 같은 productId 는 수량을 더한다.
 * - 합산 결과가 재고를 넘으면 재고로 줄인다.
 * - 재고 목록에 없거나(삭제됨) 재고가 0인(품절) 상품은 제외한다.
 *
 * 결과 순서는 local → server 등장 순으로 결정적이다.
 */
export function mergeCartLines(
  local: CartLine[],
  server: CartLine[],
  stockByProductId: Record<string, number>,
): CartLine[] {
  const quantities = new Map<string, number>()

  for (const line of [...local, ...server]) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
  }

  const merged: CartLine[] = []

  for (const [productId, quantity] of quantities) {
    const stock = stockByProductId[productId]
    if (stock === undefined) continue // 삭제된 상품

    const clamped = clampQuantity(quantity, stock)
    if (clamped > 0) merged.push({ productId, quantity: clamped })
  }

  return merged
}
