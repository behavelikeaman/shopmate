'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 장바구니 — 로그인한 사람용
// 금액 계산은 서버가 이미 끝냈다. 여기서는 그리기와 버튼 누르기만 담당한다.
// ══════════════════════════════════════════════════════════════

// 로그인 사용자의 장바구니. 그룹·합계는 서버에서 이미 계산해 내려온 것을 그대로 그리고,
// 변경만 Server Action 으로 올린다. 액션이 돌려준 에러(품절·재고 부족)는 화면에 남긴다.
import { useTransition, useState } from 'react'

import { removeFromCartAction, updateQuantityAction } from '@/app/cart/actions'
import type { CartTotals, SellerGroup } from '@/types'

import { CartView } from './CartView'

export function ServerCart({ groups, totals }: { groups: SellerGroup[]; totals: CartTotals }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ error: string } | void>) {
    startTransition(async () => {
      const result = await action()
      setError(result?.error ?? null)
    })
  }

  return (
    <CartView
      checkoutHref="/checkout"
      error={error}
      groups={groups}
      onQuantityChange={(productId, quantity) =>
        run(() => updateQuantityAction(productId, quantity))
      }
      onRemove={(productId) => run(() => removeFromCartAction(productId))}
      pending={pending}
      totals={totals}
    />
  )
}
