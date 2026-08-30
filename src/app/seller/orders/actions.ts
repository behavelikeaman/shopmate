'use server'

// ══════════════════════════════════════════════════════════════
// [동작] 판매자 — 발송 처리·취소
// 발송과 취소를 데이터베이스에 요청한다.
// 요청하는 코드를 새로 쓰지 않고, 구매자 쪽에서 쓰던 것을 그대로 재사용한다.
// ══════════════════════════════════════════════════════════════

// 판매자 주문 Server Action.
//
// 발송·취소 로직은 여기 없다. Step 7 의 shipOrderGroup / cancelOrderGroup 을 그대로 재사용한다 —
// RPC 호출을 두 벌 만들면 한쪽만 고쳐진다.
// 권한(그룹의 판매자인가)과 상태(paid 인가) 판정은 RPC 안의 조건부 UPDATE 가 한다 (ADR-014).
import { revalidatePath } from 'next/cache'

import { requireSeller } from '@/services/auth'
import { cancelOrderGroup, shipOrderGroup } from '@/services/orders'

/** 발송·취소 후에는 판매자 콘솔과 구매자 주문 화면이 같이 낡는다. */
function revalidateOrderViews() {
  revalidatePath('/seller/orders')
  revalidatePath('/orders', 'layout')
  revalidatePath('/', 'layout')
}

export async function shipGroupAction(
  groupId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSeller()

  if (typeof groupId !== 'string' || groupId === '') {
    return { ok: false, error: '발송 처리할 주문을 찾을 수 없습니다' }
  }

  const result = await shipOrderGroup(groupId)
  if (!result.ok) return result

  revalidateOrderViews()
  return { ok: true }
}

export async function cancelGroupAction(
  groupId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSeller()

  if (typeof groupId !== 'string' || groupId === '') {
    return { ok: false, error: '취소할 주문을 찾을 수 없습니다' }
  }

  // 취소하면 재고가 복구된다. 여러 번 눌려도 한 번만 복구되는 것은 RPC 가 보장한다 (ADR-017).
  const result = await cancelOrderGroup(groupId)
  if (!result.ok) return result

  revalidateOrderViews()
  return { ok: true }
}
