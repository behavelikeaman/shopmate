// ══════════════════════════════════════════════════════════════
// [화면] 상품 상세
// 상품 하나의 사진·가격·재고·판매자를 보여주고 장바구니에 담게 한다.
// 폴더 이름의 [id] 는 '주소에 따라 바뀌는 자리'다. 상품이 1000개여도 이 파일 하나가 처리한다.
// 품절이면 담기 버튼이 눌리지 않고, 왜 안 되는지 화면에 적힌다.
// ══════════════════════════════════════════════════════════════

// 상품 상세. Server Component 다 — 상품·판매자·이미 담긴 수량을 서버에서 읽어 내려준다.
// 담기 버튼만 인터랙션이 필요해서 Client Component 로 떼어 놓았다.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddToCartForm } from '@/components/AddToCartForm'
import { ProductImage } from '@/components/ProductImage'
import { formatPrice } from '@/lib/pricing'
import { getCurrentUser } from '@/services/auth'
import { getCartLines } from '@/services/cart'
import { getProduct } from '@/services/products'

export const metadata: Metadata = {
  title: '상품 상세 — ShopMate',
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const product = await getProduct(id)
  if (!product) notFound()

  const user = await getCurrentUser()
  const lines = user ? await getCartLines(user.id) : []
  const quantityInCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0

  const soldOut = product.stock === 0

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <ProductImage alt={product.name} className="aspect-square rounded-md" src={product.imageUrl} />

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-neutral-500">{product.category}</p>
            <h1 className="text-xl font-semibold text-neutral-900">{product.name}</h1>
            {/* 마켓플레이스이므로 누가 파는지가 정보다 (ADR-011). */}
            <p className="text-sm text-neutral-500">{product.seller.storeName}</p>
          </div>

          <p className="text-lg font-semibold tabular-nums text-neutral-900">
            {formatPrice(product.price)}
          </p>

          <p className="text-sm tabular-nums text-neutral-500">
            {soldOut ? (
              <span className="inline-flex items-center rounded-sm bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-500">
                품절
              </span>
            ) : (
              `재고 ${product.stock}개`
            )}
          </p>

          {product.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
              {product.description}
            </p>
          )}

          <AddToCartForm
            isLoggedIn={Boolean(user)}
            productId={product.id}
            quantityInCart={quantityInCart}
            stock={product.stock}
          />

          <Link
            className="inline-block text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
            href="/"
          >
            목록으로
          </Link>
        </div>
      </div>
    </main>
  )
}
