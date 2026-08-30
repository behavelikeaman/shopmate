import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearLocalCart, LOCAL_CART_KEY, readLocalCart, writeLocalCart } from './local-cart'

/** node 환경에는 window 가 없다. localStorage 만 흉내 내는 최소 스텁을 세운다. */
function installFakeStorage() {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  ;(globalThis as { window?: unknown }).window = { localStorage: storage }
  return storage
}

describe('local-cart', () => {
  let storage: ReturnType<typeof installFakeStorage>

  beforeEach(() => {
    storage = installFakeStorage()
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('쓴 것을 그대로 읽는다', () => {
    writeLocalCart([{ productId: 'p1', quantity: 2 }])
    expect(readLocalCart()).toEqual([{ productId: 'p1', quantity: 2 }])
  })

  it('저장된 값이 없으면 빈 배열이다', () => {
    expect(readLocalCart()).toEqual([])
  })

  it('깨진 JSON 이면 던지지 않고 빈 배열로 복구한다', () => {
    storage.setItem(LOCAL_CART_KEY, '{not json')
    expect(readLocalCart()).toEqual([])
  })

  it('배열이 아닌 값도 빈 배열로 복구한다', () => {
    storage.setItem(LOCAL_CART_KEY, '{"productId":"p1"}')
    expect(readLocalCart()).toEqual([])
  })

  it('모양이 어긋난 줄만 골라 버린다', () => {
    storage.setItem(
      LOCAL_CART_KEY,
      JSON.stringify([
        { productId: 'p1', quantity: 1 },
        { productId: 'p2' },
        { productId: '', quantity: 3 },
        { productId: 'p3', quantity: 0 },
        { productId: 'p4', quantity: '2' },
        null,
        { productId: 'p5', quantity: 2.7 },
      ]),
    )
    expect(readLocalCart()).toEqual([
      { productId: 'p1', quantity: 1 },
      { productId: 'p5', quantity: 2 },
    ])
  })

  it('clearLocalCart 이후에는 빈 배열이다', () => {
    writeLocalCart([{ productId: 'p1', quantity: 2 }])
    clearLocalCart()
    expect(readLocalCart()).toEqual([])
  })

  it('window 가 없으면(SSR) 던지지 않고 빈 배열을 준다', () => {
    delete (globalThis as { window?: unknown }).window
    expect(() => writeLocalCart([{ productId: 'p1', quantity: 1 }])).not.toThrow()
    expect(readLocalCart()).toEqual([])
  })
})
