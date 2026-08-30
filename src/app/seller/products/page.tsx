// ══════════════════════════════════════════════════════════════
// [화면] 판매자 — 내 상품 목록
// 내가 등록한 상품을 표로 보여준다. 손님 화면과 달리 카드가 아니라 표다 — 한눈에 많이 보려고.
// 재고 0인 상품은 숫자만 빨갛게 표시한다.
// ══════════════════════════════════════════════════════════════

// 판매자 — 내 상품 목록.
//
// 고객 화면과 목적이 다르다. 카드 그리드가 아니라 테이블로 그린다 (UI_GUIDE 판매자 콘솔).
// "내 상품만" 은 서비스의 where 와 RLS 가 함께 보장한다 (ADR-008).
import Link from 'next/link'

import { DeleteProductButton } from '@/components/DeleteProductButton'
import { formatPrice } from '@/lib/pricing'
import { listMyProducts } from '@/services/products'

const TH_CLASS =
  'text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 pb-2'

export default async function SellerProductsPage() {
  const products = await listMyProducts()

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          내 상품 {products.length}개
        </h2>
        <Link
          className="rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#115e59]"
          href="/seller/products/new"
        >
          상품 등록
        </Link>
      </div>

      {products.length === 0 ? (
        // 판매자 콘솔의 빈 상태는 좌측 정렬이다 (UI_GUIDE).
        <p className="text-sm text-neutral-700">등록한 상품이 없습니다.</p>
      ) : (
        // 좁은 화면에서 테이블이 잘리지 않게 감싼다.
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH_CLASS}>이름</th>
                <th className={TH_CLASS}>카테고리</th>
                <th className={`${TH_CLASS} text-right`}>가격</th>
                <th className={`${TH_CLASS} text-right`}>재고</th>
                <th className={TH_CLASS}>동작</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr className="border-b border-neutral-100" key={product.id}>
                  <td className="py-3 pr-3 text-neutral-900">
                    <Link
                      className="underline-offset-4 hover:underline"
                      href={`/products/${product.id}`}
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-neutral-500">{product.category}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-neutral-900">
                    {formatPrice(product.price)}
                  </td>
                  {/* 재고 0 은 숫자만 빨강. 행 전체를 물들이지 않는다 (UI_GUIDE). */}
                  <td
                    className={`py-3 pr-3 text-right tabular-nums ${
                      product.stock === 0 ? 'text-[#b91c1c]' : 'text-neutral-900'
                    }`}
                  >
                    {product.stock}
                  </td>
                  <td className="py-3">
                    {/* 행 안의 동작은 Text 버튼이다. 각 행에 Primary 버튼을 놓지 않는다. */}
                    <div className="flex items-start gap-3">
                      <Link
                        className="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
                        href={`/seller/products/${product.id}/edit`}
                      >
                        수정
                      </Link>
                      <DeleteProductButton name={product.name} productId={product.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
