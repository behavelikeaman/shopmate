import { describe, expect, it } from 'vitest'

import { validateProductInput } from '@/lib/product-form'

const valid = {
  name: '무선 이어폰',
  price: '49000',
  category: '전자기기',
  stock: '10',
  imageUrl: 'https://example.com/a.png',
  description: '가벼운 이어폰',
}

describe('validateProductInput', () => {
  it('올바른 입력이면 통과하고 문자열을 정수로 바꿔 돌려준다', () => {
    const result = validateProductInput(valid)

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.value).toEqual({
      name: '무선 이어폰',
      price: 49000,
      category: '전자기기',
      stock: 10,
      imageUrl: 'https://example.com/a.png',
      description: '가벼운 이어폰',
    })
  })

  it('실패하면 value 가 없다', () => {
    const result = validateProductInput({ ...valid, price: 'abc' })
    expect(result.ok).toBe(false)
    expect(result.value).toBeUndefined()
  })

  it('이름·카테고리는 공백을 제거하고 저장한다', () => {
    const result = validateProductInput({ ...valid, name: '  이어폰  ', category: ' 전자기기 ' })
    expect(result.value?.name).toBe('이어폰')
    expect(result.value?.category).toBe('전자기기')
  })

  it('이름이 비었거나 공백뿐이면 실패한다', () => {
    for (const name of ['', '   ', undefined]) {
      const result = validateProductInput({ ...valid, name })
      expect(result.ok).toBe(false)
      expect(result.errors.name).toBeTruthy()
    }
  })

  it('카테고리가 비었거나 공백뿐이면 실패한다', () => {
    for (const category of ['', '   ', undefined]) {
      const result = validateProductInput({ ...valid, category })
      expect(result.ok).toBe(false)
      expect(result.errors.category).toBeTruthy()
    }
  })

  it('가격이 정수 문자열이 아니면 실패한다', () => {
    for (const price of ['abc', '', '   ', '1000.5', '1e3', '1,000', '10 00', undefined]) {
      const result = validateProductInput({ ...valid, price })
      expect(result.ok, `price=${String(price)}`).toBe(false)
      expect(result.errors.price).toBeTruthy()
    }
  })

  it('가격이 음수면 실패한다', () => {
    for (const price of ['-1', -1, '-0']) {
      const result = validateProductInput({ ...valid, price })
      expect(result.ok, `price=${String(price)}`).toBe(false)
      expect(result.errors.price).toBeTruthy()
    }
  })

  it('가격 0 은 허용한다', () => {
    const result = validateProductInput({ ...valid, price: '0' })
    expect(result.ok).toBe(true)
    expect(result.value?.price).toBe(0)
  })

  it('재고도 가격과 같은 규칙으로 검증한다', () => {
    for (const stock of ['abc', '', '2.5', '-3', '1e2', undefined]) {
      const result = validateProductInput({ ...valid, stock })
      expect(result.ok, `stock=${String(stock)}`).toBe(false)
      expect(result.errors.stock).toBeTruthy()
    }
    expect(validateProductInput({ ...valid, stock: '0' }).value?.stock).toBe(0)
  })

  it('숫자 타입으로 들어와도 정수·0 이상이면 통과한다', () => {
    const result = validateProductInput({ ...valid, price: 1000, stock: 3 })
    expect(result.ok).toBe(true)
    expect(result.value?.price).toBe(1000)
    expect(result.value?.stock).toBe(3)
  })

  it('숫자 타입이라도 소수·NaN·Infinity 는 실패한다', () => {
    for (const price of [1000.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateProductInput({ ...valid, price }).ok, `price=${String(price)}`).toBe(false)
    }
  })

  it('integer 컬럼 범위를 넘는 금액·재고는 실패한다 (ADR-005: 원 단위 정수)', () => {
    expect(validateProductInput({ ...valid, price: '2147483648' }).ok).toBe(false)
    expect(validateProductInput({ ...valid, stock: '2147483648' }).ok).toBe(false)
    expect(validateProductInput({ ...valid, price: '2147483647' }).ok).toBe(true)
  })

  it('이미지 URL 이 비어 있으면 null 이다', () => {
    for (const imageUrl of ['', '   ', undefined]) {
      const result = validateProductInput({ ...valid, imageUrl })
      expect(result.ok, `imageUrl=${String(imageUrl)}`).toBe(true)
      expect(result.value?.imageUrl).toBeNull()
    }
  })

  it('이미지 URL 은 http:// 또는 https:// 로 시작해야 한다', () => {
    for (const imageUrl of ['example.com/a.png', 'ftp://example.com/a.png', 'javascript:alert(1)']) {
      const result = validateProductInput({ ...valid, imageUrl })
      expect(result.ok, `imageUrl=${imageUrl}`).toBe(false)
      expect(result.errors.imageUrl).toBeTruthy()
    }
    expect(validateProductInput({ ...valid, imageUrl: 'http://example.com/a.png' }).ok).toBe(true)
  })

  it('설명이 비어 있으면 null 이다', () => {
    for (const description of ['', '   ', undefined]) {
      const result = validateProductInput({ ...valid, description })
      expect(result.ok, `description=${String(description)}`).toBe(true)
      expect(result.value?.description).toBeNull()
    }
  })

  it('에러는 필드별로 모아서 한 번에 돌려준다', () => {
    const result = validateProductInput({ name: '', price: 'abc', category: '', stock: '-1' })
    expect(result.ok).toBe(false)
    expect(Object.keys(result.errors).sort()).toEqual(['category', 'name', 'price', 'stock'])
  })
})
