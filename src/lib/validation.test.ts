import { describe, expect, it } from 'vitest'
import { validateShipping } from '@/lib/validation'

const valid = { name: '홍길동', phone: '010-1234-5678', address: '서울시 강남구 테헤란로 1' }

describe('validateShipping', () => {
  it('올바른 입력이면 통과하고 에러가 없다', () => {
    expect(validateShipping(valid)).toEqual({ ok: true, errors: {} })
  })

  it('하이픈 없는 전화번호도 통과한다', () => {
    expect(validateShipping({ ...valid, phone: '01012345678' }).ok).toBe(true)
  })

  it('이름이 비었거나 공백뿐이면 실패한다', () => {
    for (const name of ['', '   ', undefined]) {
      const result = validateShipping({ ...valid, name })
      expect(result.ok).toBe(false)
      expect(result.errors.name).toBeTruthy()
    }
  })

  it('전화번호에 숫자·하이픈 외 문자가 있으면 실패한다', () => {
    const result = validateShipping({ ...valid, phone: '010-1234-오이오이' })
    expect(result.ok).toBe(false)
    expect(result.errors.phone).toBeTruthy()
  })

  it('전화번호 숫자가 9자리 미만이거나 11자리 초과면 실패한다', () => {
    expect(validateShipping({ ...valid, phone: '12345678' }).ok).toBe(false)
    expect(validateShipping({ ...valid, phone: '012345678901' }).ok).toBe(false)
  })

  it('전화번호 숫자가 9자리·11자리면 통과한다 (경계값)', () => {
    expect(validateShipping({ ...valid, phone: '02-123-4567' }).ok).toBe(true)
    expect(validateShipping({ ...valid, phone: '010-1234-5678' }).ok).toBe(true)
  })

  it('주소가 공백 제거 후 5자 미만이면 실패한다', () => {
    const result = validateShipping({ ...valid, address: '서울시' })
    expect(result.ok).toBe(false)
    expect(result.errors.address).toBeTruthy()
  })

  it('주소가 정확히 5자면 통과한다 (경계값)', () => {
    expect(validateShipping({ ...valid, address: '서울중구1가' }).ok).toBe(true)
  })

  it('여러 필드가 잘못되면 에러를 모두 모아 돌려준다', () => {
    const result = validateShipping({})
    expect(result.ok).toBe(false)
    expect(Object.keys(result.errors).sort()).toEqual(['address', 'name', 'phone'])
  })

  it('에러 메시지는 한국어 한 줄이다', () => {
    const result = validateShipping({})
    for (const message of Object.values(result.errors)) {
      expect(message).toMatch(/[가-힣]/)
      expect(message).not.toContain('\n')
    }
  })
})
