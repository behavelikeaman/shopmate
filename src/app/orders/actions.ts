'use server'

// 주문 Server Action.
//
// 취소의 권한 판정(구매자 본인인가, 그 그룹의 판매자인가)과 상태 판정(paid 인가)은
// 전부 cancel_order_group RPC 안에서 한 트랜잭션으로 일어난다 (ADR-013, ADR-017).
// 여기서 상태를 미리 조회해 판단하지 않는다 — 그 사이에 다른 요청이 끼어든다 (ADR-014).
import { revalidatePath } from 'next/cache'

import { cancelOrderGroup } from '@/services/orders'

export async function cancelGroupAction(
  groupId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof groupId !== 'string' || groupId === '') {
    return { ok: false, error: '취소할 주문을 찾을 수 없습니다' }
  }

  const result = await cancelOrderGroup(groupId)
  if (!result.ok) return result

  // 재고가 복구되었으므로 상품 화면도 함께 갱신한다.
  revalidatePath('/orders', 'layout')
  revalidatePath('/', 'layout')

  return { ok: true }
}
