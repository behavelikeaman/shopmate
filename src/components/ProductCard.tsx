// 목록의 상품 카드. 클래스는 docs/UI_GUIDE.md "상품 카드" 그대로다.
//
// 마켓플레이스라서 스토어명이 장식이 아니라 정보다 — 누가 파는지가 카드에 보여야 한다.
// 품절이어도 카드를 흐리게 만들지 않는다. 상세는 볼 수 있어야 한다 (PRD 재고 규칙).
import Link from 'next/link'

import { formatPrice } from '@/lib/pricing'
import type { Product } from '@/types'

import { ProductImage } from './ProductImage'

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock === 0

  return (
    <Link
      className="group overflow-hidden rounded-md border border-neutral-200 bg-white transition-colors hover:border-neutral-400"
      href={`/products/${product.id}`}
    >
      <div className="relative">
        <ProductImage alt={product.name} className="aspect-square" src={product.imageUrl} />
        {soldOut && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-sm bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-500">
            품절
          </span>
        )}
      </div>

      <div className="space-y-1 p-3">
        <p className="text-xs text-neutral-500">{product.category}</p>
        <p className="line-clamp-2 text-sm text-neutral-900">{product.name}</p>
        <p className="text-xs text-neutral-500">{product.seller.storeName}</p>
        <p className="text-sm font-medium tabular-nums text-neutral-900">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  )
}
