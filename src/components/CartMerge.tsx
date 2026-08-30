'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 로그인 직후 장바구니 합치기
// 화면에 아무것도 그리지 않는다. 뒤에서 일만 한다.
// ★ 반드시 한 번만 실행되어야 한다. 두 번 돌면 같은 상품 수량이 계속 늘어난다.
// ══════════════════════════════════════════════════════════════

// 로그인 직후 로컬 장바구니를 서버로 옮긴다 (ADR-007).
//
// 이 컴포넌트는 로그인 상태에서만 렌더된다. 화면에 아무것도 그리지 않는다.
// 병합은 반드시 1회여야 한다 — 매 렌더마다 부르면 같은 상품 수량이 계속 더해진다.
// 개발 모드의 StrictMode 는 effect 를 두 번 실행하므로 ref 로 잠근다.
import { useEffect, useRef } from 'react'

import { mergeLocalCartAction } from '@/app/cart/actions'
import { clearLocalCart, readLocalCart } from '@/lib/local-cart'

export function CartMerge() {
  const merged = useRef(false)

  useEffect(() => {
    if (merged.current) return
    merged.current = true

    const local = readLocalCart()
    if (local.length === 0) return

    void mergeLocalCartAction(local).then(() => {
      // 성공한 뒤에만 지운다. 실패했는데 지우면 담아둔 것이 사라진다.
      clearLocalCart()
    })
  }, [])

  return null
}
