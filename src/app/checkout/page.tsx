// 체크아웃. 주문 요약은 장바구니와 같은 판매자 그룹 블록으로 그린다 (UI_GUIDE 원칙 4).
//
// 여기 보이는 금액은 lib/pricing.ts 가, 실제 저장되는 금액은 create_order RPC(SQL) 가 계산한다.
// 같은 규칙이 두 곳에 있다는 것을 알고 그대로 둔 결정이다 (ADR-015) —
// 그래서 주문 뒤 /orders/[id] 의 금액과 이 화면의 금액이 같은지 수동으로 확인해야 한다.
import type { Metadata } from 'next'
import Link from 'next/link'

import { CheckoutForm } from '@/components/CheckoutForm'
import { OrderTotals } from '@/components/OrderTotals'
import { SellerGroupBlock } from '@/components/SellerGroupBlock'
import { calculateOrderTotals, formatPrice } from '@/lib/pricing'
import { requireUser } from '@/services/auth'
import { getCartGroups } from '@/services/cart'

export const metadata: Metadata = {
  title: '체크아웃 — ShopMate',
}

export default async function CheckoutPage() {
  const user = await requireUser('/checkout')

  const groups = await getCartGroups(user.id)
  const totals = calculateOrderTotals(groups)
  const isEmpty = groups.length === 0

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">체크아웃</h1>

      {isEmpty ? (
        <div className="py-16 text-center">
          <p className="text-sm text-neutral-700">장바구니가 비어 있어 주문할 수 없습니다.</p>
          <Link
            className="mt-4 inline-block rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
            href="/"
          >
            쇼핑 계속하기
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              주문 상품
            </h2>

            {/* 판매자가 한 명뿐이어도 같은 그룹 구조로 그린다 (UI_GUIDE). */}
            <div className="space-y-4">
              {groups.map((group) => (
                <SellerGroupBlock
                  key={group.seller.id}
                  shippingFee={group.shippingFee}
                  storeName={group.seller.storeName}
                  subtotal={group.subtotal}
                >
                  {group.lines.map((line) => (
                    <div className="flex items-center gap-3 px-4 py-3" key={line.productId}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-neutral-900">{line.product.name}</p>
                        <p className="text-sm tabular-nums text-neutral-500">
                          {formatPrice(line.product.price)} × {line.quantity}개
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-neutral-900">
                        {formatPrice(line.product.price * line.quantity)}
                      </span>
                    </div>
                  ))}
                </SellerGroupBlock>
              ))}
            </div>

            {/* 최종 합계는 그룹 밖에 둔다 (UI_GUIDE). */}
            <OrderTotals totals={totals} />
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">배송지</h2>
            <CheckoutForm />
          </section>
        </>
      )}
    </main>
  )
}
