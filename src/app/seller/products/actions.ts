'use server'

// ══════════════════════════════════════════════════════════════
// [동작] 판매자 — 상품 등록·수정·삭제
// ★ 세 가지 모두 각자 안에서 '판매자가 맞는지'를 다시 확인한다.
//   화면 틀에서 한 확인은 이 코드를 지켜주지 못한다.
// 상품을 지워도 과거 주문 내역은 그대로 남는다.
// ══════════════════════════════════════════════════════════════

// 판매자 상품 Server Action.
//
// 각 액션이 자기 안에서 requireSeller() 를 부른다. 레이아웃 가드는 액션을 보호하지 못한다 —
// 액션은 페이지를 거치지 않고 직접 호출될 수 있다 (ADR-008).
// 그리고 그것도 편의일 뿐이고, 남의 상품을 못 건드리는 보장은 RLS 의 products 정책이 한다.
//
// seller_id 는 폼에서 받지 않는다. services/products.ts 가 서버 세션에서 채운다.
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { validateProductInput, type ProductFormField } from '@/lib/product-form'
import { requireSeller } from '@/services/auth'
import { createProduct, deleteProduct, updateProduct } from '@/services/products'

export type ProductFormState = {
  error?: string
  fieldErrors?: Partial<Record<ProductFormField, string>>
} | null

/** 폼에서 오는 값은 전부 문자열이다. 정수 변환·검증은 lib/product-form.ts 가 한다. */
function readForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    price: String(formData.get('price') ?? ''),
    category: String(formData.get('category') ?? ''),
    stock: String(formData.get('stock') ?? ''),
    imageUrl: String(formData.get('imageUrl') ?? ''),
    description: String(formData.get('description') ?? ''),
  }
}

/** 상품이 바뀌면 카탈로그와 콘솔이 함께 낡는다. */
function revalidateProductViews() {
  revalidatePath('/seller/products')
  revalidatePath('/', 'layout')
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireSeller()

  const validation = validateProductInput(readForm(formData))
  if (!validation.ok || !validation.value) {
    return { fieldErrors: validation.errors }
  }

  try {
    await createProduct(validation.value)
  } catch (error) {
    return { error: error instanceof Error ? error.message : '상품을 등록하지 못했습니다' }
  }

  revalidateProductViews()
  redirect('/seller/products')
}

export async function updateProductAction(
  productId: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireSeller()

  if (typeof productId !== 'string' || productId === '') {
    return { error: '수정할 상품을 찾을 수 없습니다' }
  }

  const validation = validateProductInput(readForm(formData))
  if (!validation.ok || !validation.value) {
    return { fieldErrors: validation.errors }
  }

  try {
    // 남의 상품 id 를 넣어도 RLS 가 0 행을 갱신하고, 서비스가 그것을 에러로 바꾼다.
    await updateProduct(productId, validation.value)
  } catch (error) {
    return { error: error instanceof Error ? error.message : '상품을 수정하지 못했습니다' }
  }

  revalidateProductViews()
  redirect('/seller/products')
}

export async function deleteProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSeller()

  if (typeof productId !== 'string' || productId === '') {
    return { ok: false, error: '삭제할 상품을 찾을 수 없습니다' }
  }

  try {
    // 관련 order_items 는 함께 지우지 않는다 — product_id 만 null 이 되고
    // 주문의 상품명·단가 스냅샷은 그대로 남는다 (ADR-006).
    await deleteProduct(productId)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '상품을 삭제하지 못했습니다' }
  }

  revalidateProductViews()
  return { ok: true }
}
