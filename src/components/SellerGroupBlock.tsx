// ══════════════════════════════════════════════════════════════
// [부품] 판매자 한 명 몫의 묶음 상자
// 머리에 스토어명, 안에 상품들, 발에 소계와 배송비가 들어간다.
// 장바구니·결제·주문 상세 세 화면이 이 부품을 같이 쓴다. 그래서 어디서나 같은 모양으로 보인다.
// 판매자가 한 명뿐일 때도 같은 모양으로 그린다. 두 명이 됐을 때 화면이 낯설지 않게.
// ══════════════════════════════════════════════════════════════

// 판매자 그룹 블록. 장바구니·체크아웃·주문 상세 세 화면이 이 하나를 공유한다.
// 구조는 docs/UI_GUIDE.md "판매자 그룹 블록" 그대로다:
//   헤더(스토어명 + 선택적 상태 뱃지) / 품목 / 푸터(소계 · 배송비 · 선택적 무료배송 안내)
//
// 여기서 금액을 계산하지 않는다. 소계·배송비는 이미 계산된 값을 받아 그리기만 한다
// (계산은 lib/pricing.ts 와 create_order RPC 에만 있다).
//
// 'use client' 를 붙이지 않았다. Server Component 에서도, Client Component 안에서도
// 그대로 쓰려면 어느 쪽도 아니어야 한다.
import type { ReactNode } from 'react'

import { formatPrice } from '@/lib/pricing'
import type { GroupStatus } from '@/types'

import { OrderStatusBadge } from './OrderStatusBadge'

export function SellerGroupBlock({
  storeName,
  status,
  subtotal,
  shippingFee,
  freeShippingRemaining = 0,
  footerExtra,
  children,
}: {
  storeName: string
  /** 주문 화면에서만 넘긴다. 장바구니·체크아웃에는 상태가 없다. */
  status?: GroupStatus
  subtotal: number
  shippingFee: number
  /** 장바구니에서만 넘긴다. 0 이면 안내를 그리지 않는다. */
  freeShippingRemaining?: number
  /** 취소 버튼처럼 그룹 단위 동작이 들어갈 자리. */
  footerExtra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0 truncate text-sm font-medium text-neutral-900">{storeName}</span>
        {status && <OrderStatusBadge status={status} />}
      </header>

      <div className="divide-y divide-neutral-200">{children}</div>

      <footer className="space-y-1 px-4 py-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">소계</span>
          <span className="tabular-nums text-neutral-900">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">배송비</span>
          <span className="tabular-nums text-neutral-900">{formatPrice(shippingFee)}</span>
        </div>
        {freeShippingRemaining > 0 && (
          <p className="text-xs text-neutral-500">
            {formatPrice(freeShippingRemaining)} 더 담으면 이 판매자 배송비 무료
          </p>
        )}
        {footerExtra}
      </footer>
    </section>
  )
}
