// ══════════════════════════════════════════════════════════════
// [화면] 판매자 — 상품 등록
// 새 상품을 올리는 폼이다. 검사와 저장은 전부 서버가 한다.
// ══════════════════════════════════════════════════════════════

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
