// 주문 상세. 판매자 그룹 블록 + 그룹별 상태 뱃지 + 그룹 단위 취소 (ADR-017, UI_GUIDE).
//
// 품목의 이름·단가는 order_items 의 스냅샷이다. products 를 조인해 현재 가격을 읽지 않는다 —
// 그러면 판매자가 가격을 고치는 순간 과거 영수증이 소급 변경된다 (ADR-006).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CancelGroupButton } from '@/components/CancelGroupButton'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { canCancelGroup } from '@/lib/order-status'
import { calculateOrderTotals, formatPrice } from '@/lib/pricing'
import { requireUser } from '@/services/auth'
import { getOrder } from '@/services/orders'

export const metadata: Metadata = {
  title: '주문 상세 — ShopMate',
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireUser(`/orders/${id}`)

  // 남의 주문은 RLS 가 아예 돌려주지 않으므로 여기서 null 이 된다. 화면도 404 를 보여준다.
  const order = await getOrder(id)
  if (!order) notFound()

  const totals = calculateOrderTotals(order.groups)

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">주문 상세</h1>
        <p className="text-sm text-neutral-500">{formatDateTime(order.createdAt)}</p>
        <p className="text-xs text-neutral-500">주문번호 {order.id}</p>
      </div>

      {/* 판매자가 한 명뿐이어도 같은 그룹 구조로 그린다 (UI_GUIDE). */}
      <div className="space-y-4">
        {order.groups.map((group) => (
          <section
            className="divide-y divide-neutral-200 rounded-md border border-neutral-200"
            key={group.id}
          >
            <header className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-neutral-900">
                {group.seller.storeName}
              </span>
              <OrderStatusBadge status={group.status} />
            </header>

            <ul className="divide-y divide-neutral-200">
              {group.items.map((item) => (
                <li className="flex items-center gap-4 px-4 py-3" key={item.id}>
                  <div className="min-w-0 flex-1">
                    {/* 상품이 삭제되면 productId 가 null 이다. 이름은 스냅샷으로 남는다. */}
                    {item.productId ? (
                      <Link
                        className="block truncate text-sm text-neutral-900"
                        href={`/products/${item.productId}`}
                      >
                        {item.nameSnapshot}
                      </Link>
                    ) : (
                      <p className="truncate text-sm text-neutral-900">{item.nameSnapshot}</p>
                    )}
                    <p className="text-sm text-neutral-500 tabular-nums">
                      {formatPrice(item.unitPrice)} × {item.quantity}개
                    </p>
                  </div>
                  <span className="text-sm font-medium text-neutral-900 tabular-nums">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <footer className="space-y-1 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">소계</span>
                <span className="text-neutral-900 tabular-nums">
                  {formatPrice(group.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">배송비</span>
                <span className="text-neutral-900 tabular-nums">
                  {formatPrice(group.shippingFee)}
                </span>
              </div>

              {/* 취소된 그룹은 목록에서 사라지지 않고 '취소됨' 뱃지를 단 채 남는다 (UI_GUIDE). */}
              {canCancelGroup(group.status) && (
                <CancelGroupButton groupId={group.id} storeName={group.seller.storeName} />
              )}
            </footer>
          </section>
        ))}
      </div>

      {/* 최종 합계는 그룹 밖에 둔다. 취소된 그룹의 금액도 그대로 포함한 주문 당시 금액이다. */}
      <div className="space-y-2 rounded-md bg-neutral-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">상품 소계</span>
          <span className="text-neutral-900 tabular-nums">{formatPrice(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">배송비 합계</span>
          <span className="text-neutral-900 tabular-nums">{formatPrice(totals.shippingTotal)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
          <span className="text-sm text-neutral-700">총 결제 금액</span>
          <span className="text-lg font-semibold tabular-nums">{formatPrice(totals.total)}</span>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">배송지</h2>
        <div className="rounded-md border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
          <p>{order.shipping.name}</p>
          <p className="tabular-nums">{order.shipping.phone}</p>
          <p>{order.shipping.address}</p>
        </div>
      </section>

      <Link
        className="inline-block text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
        href="/orders"
      >
        주문 내역으로
      </Link>
    </main>
  )
}
