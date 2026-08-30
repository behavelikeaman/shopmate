// ══════════════════════════════════════════════════════════════
// [화면] 주문 상세
// 주문 하나를 판매자별로 나눠 보여준다. 판매자마다 발송 시점이 다르기 때문이다.
// 아직 안 보낸 건에만 취소 버튼이 뜬다. 취소하면 재고가 돌아간다.
// 여기 적힌 가격은 주문할 때 복사해둔 값이다. 상품 가격이 나중에 바뀌어도 안 변한다.
// ══════════════════════════════════════════════════════════════

// 주문 상세. 판매자 그룹 블록 + 그룹별 상태 뱃지 + 그룹 단위 취소 (ADR-017, UI_GUIDE).
//
// 품목의 이름·단가는 order_items 의 스냅샷이다. products 를 조인해 현재 가격을 읽지 않는다 —
// 그러면 판매자가 가격을 고치는 순간 과거 영수증이 소급 변경된다 (ADR-006).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CancelGroupButton } from '@/components/CancelGroupButton'
import { OrderTotals } from '@/components/OrderTotals'
import { SellerGroupBlock } from '@/components/SellerGroupBlock'
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

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const { placed } = await searchParams
  await requireUser(`/orders/${id}`)

  // 남의 주문은 RLS 가 아예 돌려주지 않으므로 여기서 null 이 된다. 화면도 404 를 보여준다.
  const order = await getOrder(id)
  if (!order) notFound()

  const totals = calculateOrderTotals(order.groups)
  // 체크아웃에서 막 넘어온 경우다. 완료 안내를 위한 별도 페이지를 만들지 않는다.
  const justPlaced = placed === '1'

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {justPlaced ? (
        <section className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-medium text-[#15803d]">주문이 완료되었습니다.</p>
          <p className="text-2xl font-semibold tabular-nums text-neutral-900">
            {formatPrice(totals.total)}
          </p>
          <p className="text-xs text-neutral-500">주문번호 {order.id}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
              href="/orders"
            >
              주문내역 보기
            </Link>
            <Link
              className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
              href="/"
            >
              쇼핑 계속하기
            </Link>
          </div>
        </section>
      ) : null}

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">주문 상세</h1>
        <p className="text-sm text-neutral-500">{formatDateTime(order.createdAt)}</p>
        <p className="break-all text-xs text-neutral-500">주문번호 {order.id}</p>
      </div>

      {/* 판매자가 한 명뿐이어도 같은 그룹 구조로 그린다 (UI_GUIDE). */}
      <div className="space-y-4">
        {order.groups.map((group) => (
          <SellerGroupBlock
            footerExtra={
              // 취소된 그룹은 목록에서 사라지지 않고 '취소됨' 뱃지를 단 채 남는다 (UI_GUIDE).
              canCancelGroup(group.status) ? (
                <CancelGroupButton groupId={group.id} storeName={group.seller.storeName} />
              ) : null
            }
            key={group.id}
            shippingFee={group.shippingFee}
            status={group.status}
            storeName={group.seller.storeName}
            subtotal={group.subtotal}
          >
            {group.items.map((item) => (
              <div className="flex items-center gap-3 px-4 py-3" key={item.id}>
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
                  <p className="text-sm tabular-nums text-neutral-500">
                    {formatPrice(item.unitPrice)} × {item.quantity}개
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-neutral-900">
                  {formatPrice(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </SellerGroupBlock>
        ))}
      </div>

      {/* 최종 합계는 그룹 밖에 둔다. 취소된 그룹의 금액도 그대로 포함한 주문 당시 금액이다. */}
      <OrderTotals totals={totals} />

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
