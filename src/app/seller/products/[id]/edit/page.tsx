// 상품 수정 폼.
//
// 여기서 보이는 것과 실제로 수정되는 것은 다른 문제다. products 는 누구나 SELECT 되므로
// 남의 상품 id 로 이 화면을 열 수는 있지만, 저장은 RLS 의 products_update_own 이 막는다 (ADR-008).
import { notFound } from 'next/navigation'

import { updateProductAction } from '@/app/seller/products/actions'
import { ProductForm } from '@/components/ProductForm'
import { getProduct } from '@/services/products'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)

  if (!product) notFound()

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">상품 수정</h2>
      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        product={product}
        submitLabel="변경 사항 저장"
      />
    </section>
  )
}
