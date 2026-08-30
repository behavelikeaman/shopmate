// 비로그인 장바구니의 저장소 (ADR-007).
//
// localStorage 는 브라우저에만 있다. 서버 렌더 중에 건드리면 터지므로 모든 함수가 먼저 확인한다.
// 그리고 여기 들어 있는 값은 사용자가 직접 고칠 수 있는 데이터다 — 모양이 어긋나면
// 예외를 던지지 말고 조용히 버린다. 옛날 데이터 때문에 장바구니 화면이 죽으면 안 된다.
import type { CartLine } from '@/types'

/** 스키마가 바뀌면 v2 로 올린다. 옛 키는 읽지 않으므로 자연히 버려진다. */
export const LOCAL_CART_KEY = 'shopmate.cart.v1'

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // 사생활 보호 모드 등에서 접근 자체가 막힐 수 있다.
    return null
  }
}

/** CartLine 한 줄로 볼 수 있는 값만 통과시킨다. 수량은 1 이상의 정수여야 한다. */
function toCartLine(value: unknown): CartLine | null {
  if (typeof value !== 'object' || value === null) return null

  const { productId, quantity } = value as { productId?: unknown; quantity?: unknown }
  if (typeof productId !== 'string' || productId === '') return null
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return null

  const safeQuantity = Math.floor(quantity)
  if (safeQuantity < 1) return null

  return { productId, quantity: safeQuantity }
}

export function readLocalCart(): CartLine[] {
  const storage = getStorage()
  if (!storage) return []

  const raw = storage.getItem(LOCAL_CART_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const lines: CartLine[] = []
    for (const item of parsed) {
      const line = toCartLine(item)
      if (line) lines.push(line)
    }
    return lines
  } catch {
    return []
  }
}

export function writeLocalCart(lines: CartLine[]): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(LOCAL_CART_KEY, JSON.stringify(lines))
  } catch {
    // 용량 초과 등. 장바구니를 못 저장하는 것이 화면을 죽일 이유는 되지 않는다.
  }
}

export function clearLocalCart(): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(LOCAL_CART_KEY)
  } catch {
    // 위와 같다.
  }
}
