'use server'

// 체크아웃 Server Action.
//
// 폼에서 오는 값은 배송지 세 칸뿐이다. 품목·단가·소계·합계는 넘겨받지 않는다 —
// 넘겨받으면 브라우저에서 값을 바꿔 1원짜리 주문을 만들 수 있다.
// 금액은 create_order RPC 가 서버 장바구니와 products 를 다시 읽어 계산한다 (ADR-013).
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { validateShipping } from '@/lib/validation'
import { createOrder } from '@/services/orders'

/**
 * 폼이 다시 그릴 때 필요한 것. 필드별 문구는 화면이 해당 입력 아래에 붙이고,
 * error 는 주문 자체가 실패했을 때(재고 부족 등) 한 줄로 보여준다.
 * 규칙 자체는 lib/validation.ts 에만 있다 — 여기서 다시 판정하지 않는다.
 */
export type PlaceOrderState = {
  error?: string
  fieldErrors?: Partial<Record<'name' | 'phone' | 'address', string>>
} | null

export async function placeOrderAction(formData: FormData): Promise<PlaceOrderState> {
  const shipping = {
    name: String(formData.get('name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    address: String(formData.get('address') ?? '').trim(),
  }

  // 클라이언트가 검사했더라도 서버에서 다시 검사한다. RPC 도 빈 값을 한 번 더 거부한다.
  const validation = validateShipping(shipping)
  if (!validation.ok) {
    return { fieldErrors: validation.errors }
  }

  const result = await createOrder(shipping)
  if (!result.ok) {
    return { error: result.error }
  }

  // 주문이 성공하면 장바구니는 RPC 안에서 이미 비워졌다. 헤더 뱃지도 갱신되어야 한다.
  revalidatePath('/cart')
  revalidatePath('/', 'layout')
  // placed=1 이면 주문 상세가 완료 안내를 함께 그린다. 별도의 완료 페이지를 만들지 않는다.
  redirect(`/orders/${result.orderId}?placed=1`)
}
