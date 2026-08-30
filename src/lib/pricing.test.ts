// ══════════════════════════════════════════════════════════════
// [시험] 금액 계산 시험
// '5만원어치 담으면 배송비 0원' 같은 규칙이 실제로 지켜지는지 자동으로 확인한다.
// 가장 중요한 시험: 전체로는 5만원이 넘어도 판매자별로 미달이면 배송비가 각각 붙어야 한다.
// ══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import type { CartLineView, Product, Seller, SellerGroup } from '@/types'
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  calculateOrderTotals,
  formatPrice,
  groupBySeller,
  remainingForFreeShipping,
} from '@/lib/pricing'

const sellerA: Seller = { id: 'sa', storeName: '가나상회' }
const sellerB: Seller = { id: 'sb', storeName: '나다상회' }
const sellerC: Seller = { id: 'sc', storeName: '다라상회' }

function product(id: string, price: number, seller: Seller, stock = 99): Product {
  return {
    id,
    name: `상품 ${id}`,
    description: null,
    price,
    imageUrl: null,
    category: '기타',
    stock,
    createdAt: '2026-01-01T00:00:00Z',
    seller,
  }
}

function line(id: string, price: number, seller: Seller, quantity: number): CartLineView {
  return { productId: id, quantity, product: product(id, price, seller) }
}

describe('formatPrice', () => {
  it('천 단위 구분 기호와 원 단위를 붙인다', () => {
    expect(formatPrice(12000)).toBe('12,000원')
    expect(formatPrice(1234567)).toBe('1,234,567원')
  })

  it('0은 "0원"', () => {
    expect(formatPrice(0)).toBe('0원')
  })

  it('세 자리 미만은 구분 기호가 없다', () => {
    expect(formatPrice(999)).toBe('999원')
  })

  it('음수는 호출자 버그지만 그대로 포맷한다', () => {
    expect(formatPrice(-3000)).toBe('-3,000원')
  })
})

describe('groupBySeller', () => {
  it('빈 배열이면 그룹이 없다', () => {
    expect(groupBySeller([])).toEqual([])
  })

  it('판매자 1명이면 그룹 1개이고 소계는 단가 × 수량의 합이다', () => {
    const groups = groupBySeller([line('p1', 10000, sellerA, 2), line('p2', 3000, sellerA, 1)])

    expect(groups).toHaveLength(1)
    expect(groups[0].seller).toEqual(sellerA)
    expect(groups[0].lines).toHaveLength(2)
    expect(groups[0].subtotal).toBe(23000)
    expect(groups[0].shippingFee).toBe(SHIPPING_FEE)
  })

  it('판매자가 여러 명이면 판매자 수만큼 그룹이 생긴다', () => {
    const groups = groupBySeller([
      line('p1', 10000, sellerA, 1),
      line('p2', 20000, sellerB, 1),
      line('p3', 5000, sellerA, 1),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.seller.id).sort()).toEqual(['sa', 'sb'])
    expect(groups.find((g) => g.seller.id === 'sa')!.subtotal).toBe(15000)
    expect(groups.find((g) => g.seller.id === 'sb')!.subtotal).toBe(20000)
  })

  it('그룹 소계가 정확히 50,000원이면 배송비가 0원이다', () => {
    const groups = groupBySeller([line('p1', 25000, sellerA, 2)])

    expect(groups[0].subtotal).toBe(FREE_SHIPPING_THRESHOLD)
    expect(groups[0].shippingFee).toBe(0)
  })

  it('그룹 소계가 49,999원이면 배송비가 3,000원이다', () => {
    const groups = groupBySeller([line('p1', 49999, sellerA, 1)])

    expect(groups[0].subtotal).toBe(49999)
    expect(groups[0].shippingFee).toBe(SHIPPING_FEE)
  })

  it('한 그룹은 무료, 다른 그룹은 유료인 혼합 케이스', () => {
    const groups = groupBySeller([line('p1', 60000, sellerA, 1), line('p2', 10000, sellerB, 1)])

    expect(groups.find((g) => g.seller.id === 'sa')!.shippingFee).toBe(0)
    expect(groups.find((g) => g.seller.id === 'sb')!.shippingFee).toBe(SHIPPING_FEE)
  })

  it('주문 전체 합은 5만원을 넘어도 각 그룹이 미달이면 두 그룹 모두 배송비가 붙는다 (ADR-012)', () => {
    const groups = groupBySeller([line('p1', 30000, sellerA, 1), line('p2', 30000, sellerB, 1)])

    expect(groups.every((g) => g.shippingFee === SHIPPING_FEE)).toBe(true)

    const totals = calculateOrderTotals(groups)
    expect(totals.subtotal).toBe(60000)
    expect(totals.shippingTotal).toBe(SHIPPING_FEE * 2)
  })

  it('그룹 순서는 스토어명 오름차순으로 결정적이다', () => {
    const input = [line('p1', 1000, sellerC, 1), line('p2', 1000, sellerA, 1), line('p3', 1000, sellerB, 1)]

    expect(groupBySeller(input).map((g) => g.seller.storeName)).toEqual(['가나상회', '나다상회', '다라상회'])
    // 입력 순서를 뒤집어도 결과 순서는 같다.
    expect(groupBySeller([...input].reverse()).map((g) => g.seller.storeName)).toEqual([
      '가나상회',
      '나다상회',
      '다라상회',
    ])
  })

  it('스토어명이 같으면 판매자 id 로 순서를 고정한다', () => {
    const dupA: Seller = { id: 'z', storeName: '같은이름' }
    const dupB: Seller = { id: 'a', storeName: '같은이름' }
    const groups = groupBySeller([line('p1', 1000, dupA, 1), line('p2', 1000, dupB, 1)])

    expect(groups.map((g) => g.seller.id)).toEqual(['a', 'z'])
  })

  it('입력 배열과 원소를 변형하지 않는다', () => {
    const input = [line('p1', 10000, sellerA, 2), line('p2', 20000, sellerB, 1)]
    const snapshot = JSON.parse(JSON.stringify(input))

    groupBySeller(input)

    expect(input).toHaveLength(2)
    expect(input).toEqual(snapshot)
  })

  it('금액은 항상 정수다', () => {
    const groups = groupBySeller([line('p1', 3333, sellerA, 3)])

    expect(Number.isInteger(groups[0].subtotal)).toBe(true)
    expect(Number.isInteger(groups[0].shippingFee)).toBe(true)
    expect(groups[0].subtotal).toBe(9999)
  })
})

describe('calculateOrderTotals', () => {
  it('빈 그룹이면 전부 0', () => {
    expect(calculateOrderTotals([])).toEqual({ subtotal: 0, shippingTotal: 0, total: 0 })
  })

  it('그룹들의 소계·배송비를 각각 더하고 합계를 낸다', () => {
    const groups = groupBySeller([line('p1', 60000, sellerA, 1), line('p2', 10000, sellerB, 2)])

    expect(calculateOrderTotals(groups)).toEqual({
      subtotal: 80000,
      shippingTotal: SHIPPING_FEE,
      total: 83000,
    })
  })
})

describe('remainingForFreeShipping', () => {
  function group(subtotal: number): SellerGroup {
    return {
      seller: sellerA,
      lines: [],
      subtotal,
      shippingFee: subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE,
    }
  }

  it('무료배송까지 남은 금액을 알려준다', () => {
    expect(remainingForFreeShipping(group(42000))).toBe(8000)
    expect(remainingForFreeShipping(group(1))).toBe(49999)
  })

  it('임계값에 도달했거나 넘겼으면 0', () => {
    expect(remainingForFreeShipping(group(FREE_SHIPPING_THRESHOLD))).toBe(0)
    expect(remainingForFreeShipping(group(120000))).toBe(0)
  })

  it('빈 그룹이면 임계값 전액이 남는다', () => {
    expect(remainingForFreeShipping(group(0))).toBe(FREE_SHIPPING_THRESHOLD)
  })
})
