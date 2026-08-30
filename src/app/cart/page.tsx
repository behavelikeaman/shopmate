// ══════════════════════════════════════════════════════════════
// [화면] 장바구니
// 로그인했으면 서버에 저장된 장바구니를, 안 했으면 브라우저에 저장된 것을 보여준다.
// 상품을 판매자별로 묶어서 보여준다. 배송비가 판매자마다 붙기 때문이다.
// ══════════════════════════════════════════════════════════════

// 장바구니. 로그인 사용자는 서버 장바구니를, 비로그인은 브라우저 장바구니를 본다 (ADR-007).
// 두 경우 모두 판매자별 그룹 블록 하나로 그린다 (ADR-012, UI_GUIDE 원칙 4).
import type { Metadata } from 'next'

import { LocalCart } from '@/components/LocalCart'
import { ServerCart } from '@/components/ServerCart'
import { calculateOrderTotals } from '@/lib/pricing'
import { getCurrentUser } from '@/services/auth'
import { getCartGroups } from '@/services/cart'
import { listProducts } from '@/services/products'

export const metadata: Metadata = {
  title: '장바구니 — ShopMate',
}

export default async function CartPage() {
  const user = await getCurrentUser()

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">장바구니</h1>
      {user ? <LoggedInCart userId={user.id} /> : <AnonymousCart />}
    </main>
  )
}

async function LoggedInCart({ userId }: { userId: string }) {
  const groups = await getCartGroups(userId)
  return <ServerCart groups={groups} totals={calculateOrderTotals(groups)} />
}

/**
 * 비로그인은 브라우저에 상품 id 와 수량만 갖고 있다. 이름·가격·재고는 서버에서 붙여야 하는데,
 * 어떤 id 를 갖고 있는지는 서버가 모른다. 그래서 카탈로그를 통째로 내려 클라이언트가 맞춘다.
 * (조회용 API 라우트를 만들지 않는다 — ADR-001)
 */
async function AnonymousCart() {
  const products = await listProducts()
  return <LocalCart products={products} />
}
