// ══════════════════════════════════════════════════════════════
// [시험] 돌아갈 주소 검사 시험
// 외부 사이트 주소를 넣었을 때 차단되는지 확인한다.
// ══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { safeNextPath } from './redirect'

describe('safeNextPath', () => {
  it('내부 절대 경로는 그대로 통과시킨다', () => {
    expect(safeNextPath('/checkout')).toBe('/checkout')
    expect(safeNextPath('/seller/products')).toBe('/seller/products')
    expect(safeNextPath('/orders?page=2')).toBe('/orders?page=2')
  })

  it('값이 없으면 홈으로 보낸다', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
    expect(safeNextPath('   ')).toBe('/')
  })

  it('프로토콜 상대 경로(//)를 막는다 — 외부 사이트로 나간다', () => {
    expect(safeNextPath('//example.com')).toBe('/')
    expect(safeNextPath('//example.com/path')).toBe('/')
  })

  it('백슬래시로 시작하는 경로를 막는다 — 일부 브라우저가 //로 해석한다', () => {
    expect(safeNextPath('/\\example.com')).toBe('/')
    expect(safeNextPath('\\\\example.com')).toBe('/')
  })

  it('절대 URL을 막는다', () => {
    expect(safeNextPath('https://example.com')).toBe('/')
    expect(safeNextPath('http://example.com/x')).toBe('/')
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })

  it('/로 시작하지 않는 상대 경로를 막는다', () => {
    expect(safeNextPath('checkout')).toBe('/')
    expect(safeNextPath('../admin')).toBe('/')
  })

  it('앞뒤 공백은 잘라내고 판정한다', () => {
    expect(safeNextPath('  /cart  ')).toBe('/cart')
    expect(safeNextPath('  //evil.com  ')).toBe('/')
  })

  it('개행·제어문자가 섞인 값을 막는다 — 헤더 인젝션 방지', () => {
    expect(safeNextPath('/cart\nLocation: https://example.com')).toBe('/')
    expect(safeNextPath('/cart\r\nSet-Cookie: a=b')).toBe('/')
    // 끝에 붙은 개행은 trim 이 걷어내므로 경로 자체는 멀쩡하다.
    expect(safeNextPath('/cart\r\n')).toBe('/cart')
  })
})
