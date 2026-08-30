// 내 주문 목록. "내 것만" 거르는 조건은 코드에 없다 — RLS 가 거른다 (ADR-008).
// 총액은 저장된 값이 아니라 그룹들의 합이다 (ADR-010).
import type { Metadata } from 'next'
import Link from 'next/link'

import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { calculateOrderTotals, formatPrice } from '@/lib/pricing'
import { requireUser } from '@/services/auth'
import { listOrders } from '@/services/orders'

export const metadata: Metadata = {
  title: '주문 내역 — ShopMate',
}

/** 2026. 8. 30. 형태. 주문 시각은 서버가 준 ISO 문자열이다. */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(iso))
}

export default async function OrdersPage() {
  await requireUser('/orders')
  const orders = await listOrders()

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">주문 내역</h1>

      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-neutral-700">아직 주문이 없습니다.</p>
          <Link
            className="mt-4 inline-block rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
            href="/"
          >
            쇼핑하러 가기
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const totals = calculateOrderTotals(order.groups)

            return (
              <li
                className="divide-y divide-neutral-200 rounded-md border border-neutral-200"
                key={order.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-900">{formatDate(order.createdAt)}</p>
                    <p className="break-all text-xs text-neutral-500">주문번호 {order.id}</p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatPrice(totals.total)}
                  </span>
                </div>

                <ul className="divide-y divide-neutral-100">
                  {order.groups.map((group) => (
                    <li
                      className="flex items-center justify-between gap-2 px-4 py-3"
                      key={group.id}
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-neutral-900">
                        {group.seller.storeName}
                      </span>
                      <OrderStatusBadge status={group.status} />
                    </li>
                  ))}
                </ul>

                <div className="px-4 py-3">
                  <Link
                    className="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
                    href={`/orders/${order.id}`}
                  >
                    주문 상세 보기
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
