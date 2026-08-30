'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 장바구니 담기 버튼
// 로그인했으면 서버 장바구니에, 안 했으면 브라우저 저장소에 담는다.
// 담아도 화면이 넘어가지 않는다. '담았습니다' 안내만 그 자리에 뜬다.
// ══════════════════════════════════════════════════════════════

// 상품 상세의 "장바구니 담기".
//
// 로그인 상태면 Server Action 으로, 아니면 localStorage 로 담는다 (ADR-007).
// 담기 액션은 "이 수량으로 맞춰라"는 뜻이므로, 이미 담긴 수량에 더한 값을 넘긴다.
//
// 담은 뒤 화면을 옮기지 않는다. 토스트 라이브러리를 설치하지도 않는다 —
// 버튼 아래 한 줄로 결과와 장바구니 링크를 남긴다 (UI_GUIDE).
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { addToCartAction } from '@/app/cart/actions'
import { clampQuantity } from '@/lib/cart'
import { readLocalCart, writeLocalCart } from '@/lib/local-cart'

import { QuantityStepper } from './QuantityStepper'

export function AddToCartForm({
  productId,
  stock,
  isLoggedIn,
  quantityInCart,
}: {
  productId: string
  stock: number
  isLoggedIn: boolean
  /** 서버 장바구니에 이미 담겨 있는 수량. 비로그인은 0 으로 들어오고 브라우저에서 다시 읽는다. */
  quantityInCart: number
}) {
  const [quantity, setQuantity] = useState(1)
  const [inCart, setInCart] = useState(quantityInCart)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (stock === 0) {
    return (
      <div className="space-y-2">
        <button
          className="w-full rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white disabled:bg-neutral-300"
          disabled
          type="button"
        >
          장바구니 담기
        </button>
        {/* 왜 못 담는지를 숨기지 않는다 (UI_GUIDE 원칙 2). */}
        <p className="text-sm text-neutral-500">품절된 상품이라 장바구니에 담을 수 없습니다.</p>
      </div>
    )
  }

  function addLocally(): string | null {
    const lines = readLocalCart()
    const current = lines.find((line) => line.productId === productId)?.quantity ?? 0
    const next = clampQuantity(current + quantity, stock)

    if (next <= current) {
      return `재고가 부족합니다 (남은 수량: ${stock})`
    }

    writeLocalCart([
      ...lines.filter((line) => line.productId !== productId),
      { productId, quantity: next },
    ])
    setInCart(next)
    return null
  }

  function handleAdd() {
    setMessage(null)
    setError(null)

    if (!isLoggedIn) {
      const failed = addLocally()
      if (failed) setError(failed)
      else setMessage('장바구니에 담았습니다')
      return
    }

    const next = inCart + quantity
    startTransition(async () => {
      const result = await addToCartAction(productId, next)
      if (result?.error) {
        setError(result.error)
        return
      }
      setInCart(next)
      setMessage('장바구니에 담았습니다')
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-700">수량</span>
        <QuantityStepper
          disabled={pending}
          max={stock}
          onChange={setQuantity}
          quantity={quantity}
        />
      </div>

      <button
        className="w-full rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#115e59] disabled:bg-neutral-300"
        disabled={pending}
        onClick={handleAdd}
        type="button"
      >
        {pending ? '담는 중…' : '장바구니 담기'}
      </button>

      {message && (
        <p className="text-sm text-neutral-700">
          {message} ·{' '}
          <Link className="text-neutral-900 underline underline-offset-4" href="/cart">
            장바구니 보기
          </Link>
        </p>
      )}
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
    </div>
  )
}
