'use client'

// 그룹 취소 버튼.
//
// 취소는 되돌릴 수 없으므로 Primary 가 아니라 Danger Text 버튼이고,
// window.confirm 으로 한 번 되묻되 "무엇이 사라지는지"를 문구에 적는다 (UI_GUIDE).
// 새 모달 컴포넌트를 만들지 않는다.
//
// 취소 가능 여부(paid 인가)는 화면이 판정하지 않는다 — canCancelGroup 이 버튼을 보일지 정하고,
// 실제 판정은 RPC 의 조건부 UPDATE 가 한다 (ADR-014).
import { useState, useTransition } from 'react'

import { cancelGroupAction } from '@/app/orders/actions'

export function CancelGroupButton({ groupId, storeName }: { groupId: string; storeName: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="text-right">
      <button
        className="text-sm text-[#b91c1c] hover:underline disabled:text-neutral-400"
        disabled={pending}
        onClick={() => {
          const ok = window.confirm(
            `${storeName} 주문을 취소합니다. 재고는 복구되며, 취소는 되돌릴 수 없습니다.`,
          )
          if (!ok) return

          startTransition(async () => {
            const result = await cancelGroupAction(groupId)
            setError(result.ok ? null : result.error)
          })
        }}
        type="button"
      >
        {pending ? '취소 처리중…' : '주문 취소'}
      </button>
      {error && <p className="mt-1 text-sm text-[#b91c1c]">{error}</p>}
    </div>
  )
}
