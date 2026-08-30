import { describe, expect, it } from 'vitest'
import type { CartLine } from '@/types'
import { clampQuantity, mergeCartLines } from '@/lib/cart'

const stock: Record<string, number> = { p1: 10, p2: 5, p3: 0 }

describe('mergeCartLines', () => {
  it('양쪽이 비어 있으면 결과도 비어 있다', () => {
    expect(mergeCartLines([], [], stock)).toEqual([])
  })

  it('로컬만 있으면 로컬을 그대로 돌려준다', () => {
    expect(mergeCartLines([{ productId: 'p1', quantity: 2 }], [], stock)).toEqual([
      { productId: 'p1', quantity: 2 },
    ])
  })

  it('서버만 있으면 서버를 그대로 돌려준다', () => {
    expect(mergeCartLines([], [{ productId: 'p2', quantity: 3 }], stock)).toEqual([
      { productId: 'p2', quantity: 3 },
    ])
  })

  it('같은 상품은 수량을 합산한다 (ADR-007)', () => {
    expect(
      mergeCartLines([{ productId: 'p1', quantity: 2 }], [{ productId: 'p1', quantity: 3 }], stock),
    ).toEqual([{ productId: 'p1', quantity: 5 }])
  })

  it('합산 결과가 재고를 넘으면 재고로 클램프한다', () => {
    expect(
      mergeCartLines([{ productId: 'p2', quantity: 4 }], [{ productId: 'p2', quantity: 4 }], stock),
    ).toEqual([{ productId: 'p2', quantity: 5 }])
  })

  it('재고가 0인 상품(품절)은 제외한다', () => {
    expect(mergeCartLines([{ productId: 'p3', quantity: 1 }], [], stock)).toEqual([])
  })

  it('재고 목록에 없는 상품(삭제됨)은 제외한다', () => {
    expect(mergeCartLines([{ productId: 'gone', quantity: 1 }], [], stock)).toEqual([])
  })

  it('수량이 0 이하인 줄은 제외한다', () => {
    expect(
      mergeCartLines([{ productId: 'p1', quantity: 0 }], [{ productId: 'p2', quantity: -1 }], stock),
    ).toEqual([])
  })

  it('여러 상품이 섞여도 productId 기준으로 정확히 묶는다', () => {
    const merged = mergeCartLines(
      [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 },
        { productId: 'p3', quantity: 9 },
      ],
      [
        { productId: 'p1', quantity: 4 },
        { productId: 'gone', quantity: 2 },
      ],
      stock,
    )

    expect(merged).toEqual([
      { productId: 'p1', quantity: 5 },
      { productId: 'p2', quantity: 1 },
    ])
  })

  it('결과 순서는 로컬 → 서버 등장 순으로 결정적이다', () => {
    const merged = mergeCartLines(
      [{ productId: 'p2', quantity: 1 }],
      [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 },
      ],
      stock,
    )

    expect(merged.map((l) => l.productId)).toEqual(['p2', 'p1'])
  })

  it('입력 배열과 원소를 변형하지 않는다', () => {
    const local: CartLine[] = [{ productId: 'p1', quantity: 2 }]
    const server: CartLine[] = [{ productId: 'p1', quantity: 3 }]
    const localSnapshot = JSON.parse(JSON.stringify(local))
    const serverSnapshot = JSON.parse(JSON.stringify(server))

    mergeCartLines(local, server, stock)

    expect(local).toEqual(localSnapshot)
    expect(server).toEqual(serverSnapshot)
  })
})

describe('clampQuantity', () => {
  it('범위 안이면 그대로 돌려준다', () => {
    expect(clampQuantity(3, 10)).toBe(3)
  })

  it('1 미만이면 0 (삭제 의도)', () => {
    expect(clampQuantity(0, 10)).toBe(0)
    expect(clampQuantity(-5, 10)).toBe(0)
  })

  it('재고를 넘으면 재고로 줄인다', () => {
    expect(clampQuantity(99, 4)).toBe(4)
  })

  it('재고가 0이면 0', () => {
    expect(clampQuantity(3, 0)).toBe(0)
  })

  it('정수가 아니면 내림한다', () => {
    expect(clampQuantity(2.9, 10)).toBe(2)
    expect(clampQuantity(1.5, 10)).toBe(1)
    expect(clampQuantity(0.9, 10)).toBe(0)
  })

  it('재고가 정수가 아니어도 내림해서 상한으로 쓴다', () => {
    expect(clampQuantity(10, 3.7)).toBe(3)
  })

  it('숫자가 아닌 값이 들어오면 0', () => {
    expect(clampQuantity(Number.NaN, 10)).toBe(0)
  })
})
