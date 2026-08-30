// 상품 등록 폼. 검증도 저장도 Server Action 이 한다.
import { createProductAction } from '@/app/seller/products/actions'
import { ProductForm } from '@/components/ProductForm'

export default function NewProductPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">상품 등록</h2>
      <ProductForm action={createProductAction} submitLabel="상품 등록" />
    </section>
  )
}
