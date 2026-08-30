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

export type PlaceOrderState = { error: string } | null

/** 검증 결과에서 화면에 보여줄 한 줄을 만든다. 규칙 자체는 validateShipping 이 갖고 있다. */
function firstError(errors: Record<string, string | undefined>): string {
  return Object.values(errors).find((message): message is string => Boolean(message)) ?? ''
}

export async function placeOrderAction(formData: FormData): Promise<PlaceOrderState> {
  const shipping = {
    name: String(formData.get('name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    address: String(formData.get('address') ?? '').trim(),
  }

  // 클라이언트가 검사했더라도 서버에서 다시 검사한다. RPC 도 빈 값을 한 번 더 거부한다.
  const validation = validateShipping(shipping)
  if (!validation.ok) {
    return { error: firstError(validation.errors) }
  }

  const result = await createOrder(shipping)
  if (!result.ok) {
    return { error: result.error }
  }

  // 주문이 성공하면 장바구니는 RPC 안에서 이미 비워졌다. 헤더 뱃지도 갱신되어야 한다.
  revalidatePath('/cart')
  revalidatePath('/', 'layout')
  redirect(`/orders/${result.orderId}`)
}
