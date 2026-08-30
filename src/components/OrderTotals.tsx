// 전체 요약 블록. 그룹 푸터의 금액과 시각적으로 구분되어야 하므로 회색 배경에 따로 둔다
// (docs/UI_GUIDE.md "판매자 그룹 블록" — 최종 합계는 그룹 밖).
import type { ReactNode } from 'react'

import { formatPrice } from '@/lib/pricing'
import type { CartTotals } from '@/types'

export function OrderTotals({
  totals,
  totalLabel = '총 결제 금액',
  action,
}: {
  totals: CartTotals
  totalLabel?: string
  /** 주문하기 버튼처럼 요약 아래에 붙는 것. */
  action?: ReactNode
}) {
  return (
    <div className="space-y-2 rounded-md bg-neutral-50 p-4">
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-neutral-500">상품 소계</span>
        <span className="tabular-nums text-neutral-900">{formatPrice(totals.subtotal)}</span>
      </div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-neutral-500">배송비 합계</span>
        <span className="tabular-nums text-neutral-900">{formatPrice(totals.shippingTotal)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2">
        <span className="text-sm text-neutral-700">{totalLabel}</span>
        <span className="text-lg font-semibold tabular-nums">{formatPrice(totals.total)}</span>
      </div>
      {action}
    </div>
  )
}
