'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 판매자 주문 표의 한 줄
// 누르면 배송지와 품목이 펼쳐진다. 별도 상세 화면을 만들지 않으려고 이렇게 했다.
// ══════════════════════════════════════════════════════════════

// 판매자 콘솔의 주문 그룹 한 줄 + 펼친 상세.
//
// 배송지 전체(주소·연락처)는 발송에 필요하지만 목록에서는 자리를 너무 먹는다.
// 그래서 이름만 줄에 두고, 나머지는 펼쳐서 본다. 별도 상세 라우트를 만들지 않는다.
//
// 발송·취소 가능 여부는 lib/order-status.ts 가 정하고(버튼을 보일지),
// 실제 판정은 RPC 의 조건부 UPDATE 가 한다 (ADR-014).
import { useState, useTransition } from 'react'

import { cancelGroupAction, shipGroupAction } from '@/app/seller/orders/actions'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { canCancelGroup, canShipGroup } from '@/lib/order-status'
import { formatPrice } from '@/lib/pricing'
import type { SellerOrderGroup } from '@/types'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(iso))
}

export function SellerOrderRow({ group }: { group: SellerOrderGroup }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const total = group.subtotal + group.shippingFee
  const itemCount = group.items.length
  const summary =
    itemCount === 0
      ? '-'
      : itemCount === 1
        ? `${group.items[0].nameSnapshot} ${group.items[0].quantity}개`
        : `${group.items[0].nameSnapshot} 외 ${itemCount - 1}건`

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action()
      setError(result.ok ? null : result.error)
    })
  }

  return (
    <>
      <tr className="border-b border-neutral-100">
        <td className="py-3 pr-3 align-top whitespace-nowrap">{formatDate(group.orderedAt)}</td>
        <td className="py-3 pr-3 align-top">{group.shipping.name}</td>
        <td className="py-3 pr-3 align-top">
          <button
            className="text-left text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
            onClick={() => setOpen((prev) => !prev)}
            type="button"
          >
            {summary}
          </button>
        </td>
        <td className="py-3 pr-3 text-right align-top tabular-nums">
          <div>{formatPrice(total)}</div>
          <div className="text-xs text-neutral-500">
            상품 {formatPrice(group.subtotal)} · 배송 {formatPrice(group.shippingFee)}
          </div>
        </td>
        <td className="py-3 pr-3 align-top">
          <OrderStatusBadge status={group.status} />
        </td>
        <td className="py-3 align-top">
          <div className="flex flex-col items-start gap-1">
            {canShipGroup(group.status) && (
              <button
                className="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline disabled:text-neutral-300"
                disabled={pending}
                onClick={() => run(() => shipGroupAction(group.id))}
                type="button"
              >
                {pending ? '처리 중…' : '발송 처리'}
              </button>
            )}
            {canCancelGroup(group.status) && (
              <button
                className="text-sm text-[#b91c1c] hover:underline disabled:text-neutral-400"
                disabled={pending}
                onClick={() => {
                  const ok = window.confirm(
                    `${group.shipping.name} 님의 주문(${summary})을 취소합니다. 재고는 복구되며, 취소는 되돌릴 수 없습니다.`,
                  )
                  if (!ok) return
                  run(() => cancelGroupAction(group.id))
                }}
                type="button"
              >
                취소
              </button>
            )}
            {!canShipGroup(group.status) && !canCancelGroup(group.status) && (
              <span className="text-sm text-neutral-400">-</span>
            )}
          </div>
        </td>
      </tr>

      {(open || error) && (
        <tr className="border-b border-neutral-100">
          <td className="pb-3" colSpan={6}>
            {error && <p className="mb-2 text-sm text-[#b91c1c]">{error}</p>}
            {open && (
              <div className="space-y-2 rounded-md bg-neutral-50 px-4 py-3">
                <div className="text-xs text-neutral-500">
                  주문번호 <span className="break-all">{group.orderId}</span>
                </div>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li className="flex justify-between gap-4" key={item.id}>
                      <span className="text-neutral-700">
                        {item.nameSnapshot} × {item.quantity}
                      </span>
                      <span className="tabular-nums text-neutral-900">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* 발송에 필요한 정보. 이 손님이 다른 판매자에게서 무엇을 샀는지는 보이지 않는다. */}
                <div className="border-t border-neutral-200 pt-2 text-neutral-700">
                  <p>
                    {group.shipping.name} · {group.shipping.phone}
                  </p>
                  <p>{group.shipping.address}</p>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
