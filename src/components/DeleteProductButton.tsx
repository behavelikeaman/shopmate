'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 상품 삭제 버튼
// 누르면 되묻는다. 지워도 과거 주문 내역의 상품명과 금액은 남는다.
// ══════════════════════════════════════════════════════════════

// 상품 삭제. 되돌릴 수 없으므로 Danger Text 버튼 + window.confirm 이고,
// 확인 문구에 무엇이 사라지는지 구체적으로 적는다 (UI_GUIDE).
// 모달 컴포넌트를 새로 만들지 않는다.
import { useState, useTransition } from 'react'

import { deleteProductAction } from '@/app/seller/products/actions'

export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <button
        className="text-sm text-[#b91c1c] hover:underline disabled:text-neutral-400"
        disabled={pending}
        onClick={() => {
          const ok = window.confirm(
            `'${name}' 상품을 삭제합니다. 목록과 장바구니에서 사라지며 되돌릴 수 없습니다. (이미 접수된 주문 내역의 상품명과 금액은 그대로 남습니다.)`,
          )
          if (!ok) return

          startTransition(async () => {
            const result = await deleteProductAction(productId)
            setError(result.ok ? null : result.error)
          })
        }}
        type="button"
      >
        {pending ? '삭제 중…' : '삭제'}
      </button>
      {error && <p className="mt-1 text-sm text-[#b91c1c]">{error}</p>}
    </>
  )
}
