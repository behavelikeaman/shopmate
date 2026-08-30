// ══════════════════════════════════════════════════════════════
// [시험] 주문 상태 시험
// 이미 보낸 주문을 취소하려 하면 막히는지 확인한다.
// ══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import type { GroupStatus } from '@/types'
import { canCancelGroup, canShipGroup, statusLabel } from '@/lib/order-status'

const all: GroupStatus[] = ['paid', 'shipped', 'cancelled']

describe('canCancelGroup', () => {
  it("'paid' 일 때만 취소할 수 있다", () => {
    expect(canCancelGroup('paid')).toBe(true)
    expect(canCancelGroup('shipped')).toBe(false)
    expect(canCancelGroup('cancelled')).toBe(false)
  })
})

describe('canShipGroup', () => {
  it("'paid' 일 때만 발송 처리할 수 있다", () => {
    expect(canShipGroup('paid')).toBe(true)
    expect(canShipGroup('shipped')).toBe(false)
    expect(canShipGroup('cancelled')).toBe(false)
  })
})

describe('statusLabel', () => {
  it('UI_GUIDE 의 주문 상태 표와 일치한다', () => {
    expect(statusLabel('paid')).toBe('발송 준비중')
    expect(statusLabel('shipped')).toBe('발송 완료')
    expect(statusLabel('cancelled')).toBe('취소됨')
  })

  it('모든 상태에 표기 문자열이 있다', () => {
    for (const status of all) {
      expect(statusLabel(status).length).toBeGreaterThan(0)
    }
  })
})
