// ══════════════════════════════════════════════════════════════
// [계산기] 금액 계산
// 장바구니를 판매자별로 묶고, 소계·배송비·총액을 계산한다.
// 배송비는 판매자마다 따로 붙는다 — 한 판매자에게서 5만원 넘게 사면 그 판매자 몫만 무료.
// 여기 있는 함수는 데이터베이스를 모른다. 숫자를 넣으면 숫자가 나올 뿐이라 시험하기 쉽다.
// ══════════════════════════════════════════════════════════════

import type { CartLineView, CartTotals, SellerGroup } from '@/types'

/**
 * 배송비 규칙. 이 두 상수는 create_order RPC(SQL) 쪽에도 같은 값이 존재한다 (ADR-015).
 * 한쪽만 고치면 화면에 보인 금액과 실제 청구액이 달라진다.
 */
export const FREE_SHIPPING_THRESHOLD = 50000
export const SHIPPING_FEE = 3000

const priceFormatter = new Intl.NumberFormat('ko-KR')

/** 원 단위 정수를 "12,000원" 형태로 만든다. */
export function formatPrice(amount: number): string {
  return `${priceFormatter.format(amount)}원`
}

function shippingFeeFor(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
}

/**
 * 장바구니 줄을 판매자별로 묶고, 그룹마다 소계와 배송비를 채운다.
 *
 * 배송비는 주문 전체가 아니라 **그룹 소계**로 판정한다 (ADR-012).
 * 실제로 물건을 부치는 주체가 판매자이기 때문이다.
 *
 * 그룹 순서는 스토어명 → 판매자 id 오름차순으로 고정한다.
 * 순서가 흔들리면 같은 장바구니가 새로고침마다 다르게 보인다.
 */
export function groupBySeller(lines: CartLineView[]): SellerGroup[] {
  const bySellerId = new Map<string, SellerGroup>()

  for (const line of lines) {
    const { seller } = line.product
    let group = bySellerId.get(seller.id)

    if (!group) {
      group = { seller, lines: [], subtotal: 0, shippingFee: 0 }
      bySellerId.set(seller.id, group)
    }

    // 입력 원소를 그대로 담되 새 배열에 넣는다. 입력 배열은 건드리지 않는다.
    group.lines.push(line)
    group.subtotal += line.product.price * line.quantity // 전부 정수 연산 (ADR-005)
  }

  const groups = [...bySellerId.values()]

  for (const group of groups) {
    group.shippingFee = shippingFeeFor(group.subtotal)
  }

  return groups.sort(
    (a, b) =>
      a.seller.storeName.localeCompare(b.seller.storeName, 'ko') ||
      a.seller.id.localeCompare(b.seller.id),
  )
}

/**
 * 그룹들의 합계. 총액은 저장하지 않고 언제나 여기서 계산한다 (ADR-010).
 *
 * 인자를 금액 두 개만으로 좁게 받는다. 장바구니의 SellerGroup 과 주문의 OrderGroup 이
 * 둘 다 그대로 들어올 수 있어야 하고, 합계에 필요한 것은 이 두 값뿐이기 때문이다.
 */
export function calculateOrderTotals(
  groups: readonly { subtotal: number; shippingFee: number }[],
): CartTotals {
  let subtotal = 0
  let shippingTotal = 0

  for (const group of groups) {
    subtotal += group.subtotal
    shippingTotal += group.shippingFee
  }

  return { subtotal, shippingTotal, total: subtotal + shippingTotal }
}

/** 이 판매자에게서 얼마를 더 담으면 배송비가 무료가 되는지. 이미 무료면 0. */
export function remainingForFreeShipping(group: SellerGroup): number {
  const remaining = FREE_SHIPPING_THRESHOLD - group.subtotal
  return remaining > 0 ? remaining : 0
}
