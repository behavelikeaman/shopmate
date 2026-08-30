'use client'

// 장바구니 화면 본체. 로그인/비로그인 양쪽이 이 컴포넌트 하나를 공유한다 —
// 저장 위치만 다를 뿐 보이는 것은 같아야 하기 때문이다.
//
// 금액은 전부 props 로 받은 계산 결과를 그대로 그린다. 여기서 더하거나 배송비를 판정하지 않는다
// (계산은 lib/pricing.ts 한 곳에만 있다).
import Link from 'next/link'

import { formatPrice, remainingForFreeShipping } from '@/lib/pricing'
import type { CartTotals, SellerGroup } from '@/types'

import { OrderTotals } from './OrderTotals'
import { ProductImage } from './ProductImage'
import { QuantityStepper } from './QuantityStepper'
import { SellerGroupBlock } from './SellerGroupBlock'

export function CartView({
  groups,
  totals,
  checkoutHref,
  error,
  pending = false,
  onQuantityChange,
  onRemove,
}: {
  groups: SellerGroup[]
  totals: CartTotals
  checkoutHref: string
  error?: string | null
  pending?: boolean
  onQuantityChange: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
}) {
  if (groups.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-neutral-700">장바구니가 비어 있습니다.</p>
        <Link
          className="mt-4 inline-block rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
          href="/"
        >
          쇼핑 계속하기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}

      {/* 판매자가 한 명뿐이어도 같은 그룹 구조로 그린다 (UI_GUIDE). */}
      <div className="space-y-4">
        {groups.map((group) => (
          <SellerGroupBlock
            freeShippingRemaining={remainingForFreeShipping(group)}
            key={group.seller.id}
            shippingFee={group.shippingFee}
            storeName={group.seller.storeName}
            subtotal={group.subtotal}
          >
            {group.lines.map((line) => (
              <div className="flex flex-wrap items-center gap-3 px-4 py-3" key={line.productId}>
                <Link className="shrink-0" href={`/products/${line.product.id}`}>
                  <ProductImage
                    alt={line.product.name}
                    className="h-14 w-14 rounded-sm"
                    src={line.product.imageUrl}
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    className="block truncate text-sm text-neutral-900"
                    href={`/products/${line.product.id}`}
                  >
                    {line.product.name}
                  </Link>
                  <p className="text-sm tabular-nums text-neutral-500">
                    {formatPrice(line.product.price)} · 재고 {line.product.stock}개
                  </p>
                </div>

                <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                  <QuantityStepper
                    disabled={pending}
                    max={line.product.stock}
                    onChange={(quantity) => onQuantityChange(line.productId, quantity)}
                    quantity={line.quantity}
                  />

                  <span className="text-sm font-medium tabular-nums text-neutral-900 sm:w-24 sm:text-right">
                    {formatPrice(line.product.price * line.quantity)}
                  </span>

                  {/* 삭제는 되돌릴 수 없으므로 Primary 버튼으로 만들지 않는다 (UI_GUIDE). */}
                  <button
                    className="text-sm text-[#b91c1c] hover:underline disabled:text-neutral-400"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`"${line.product.name}"을(를) 장바구니에서 뺍니다.`)) {
                        onRemove(line.productId)
                      }
                    }}
                    type="button"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </SellerGroupBlock>
        ))}
      </div>

      {/* 최종 합계는 그룹 밖에 둔다 (UI_GUIDE). */}
      <OrderTotals
        action={
          <Link
            className="mt-2 block rounded-md bg-[#0f766e] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-[#115e59]"
            href={checkoutHref}
          >
            주문하기
          </Link>
        }
        totalLabel="총 결제 예정 금액"
        totals={totals}
      />
    </div>
  )
}
