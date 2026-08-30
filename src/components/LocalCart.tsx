'use client'

// 비로그인 사용자의 장바구니 (ADR-007). 줄은 localStorage 에, 상품 정보는 서버에서 받은 목록에 있다.
//
// localStorage 는 서버 렌더 중에 없다. 그래서 첫 렌더는 빈 상태로 그리고,
// useEffect 안에서 읽어 채운다.
import { useEffect, useState } from 'react'

import { clampQuantity } from '@/lib/cart'
import { readLocalCart, writeLocalCart } from '@/lib/local-cart'
import { calculateOrderTotals, groupBySeller } from '@/lib/pricing'
import type { CartLine, CartLineView, Product } from '@/types'

import { CartView } from './CartView'

export function LocalCart({ products }: { products: Product[] }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLines(readLocalCart())
    setLoaded(true)
  }, [])

  function update(next: CartLine[]) {
    setLines(next)
    writeLocalCart(next)
  }

  const byId = new Map(products.map((product) => [product.id, product]))

  // 삭제됐거나 품절된 상품은 화면에서 뺀다. 수량은 재고를 넘지 못한다.
  const views: CartLineView[] = []
  for (const line of lines) {
    const product = byId.get(line.productId)
    if (!product) continue

    const quantity = clampQuantity(line.quantity, product.stock)
    if (quantity > 0) views.push({ productId: line.productId, quantity, product })
  }

  const groups = groupBySeller(views)
  const totals = calculateOrderTotals(groups)

  // 읽기 전에는 "비었습니다"를 잠깐 보여주지 않는다.
  if (!loaded) {
    return <div className="h-32 rounded-md bg-neutral-100" />
  }

  return (
    <CartView
      // 비로그인은 체크아웃에서 튕기지 않고, 로그인 후 원래 가려던 곳으로 돌아온다 (PRD).
      checkoutHref="/login?next=%2Fcheckout"
      groups={groups}
      onQuantityChange={(productId, quantity) => {
        const product = byId.get(productId)
        const safe = clampQuantity(quantity, product?.stock ?? 0)
        if (safe <= 0) {
          update(lines.filter((line) => line.productId !== productId))
          return
        }
        update(
          lines.map((line) => (line.productId === productId ? { ...line, quantity: safe } : line)),
        )
      }}
      onRemove={(productId) => update(lines.filter((line) => line.productId !== productId))}
      totals={totals}
    />
  )
}
