// ══════════════════════════════════════════════════════════════
// [계산기] 상품 등록 입력 검사
// 판매자가 입력한 상품명·가격·재고를 검사한다.
// 가격에 '1000.5'나 'abc'가 들어오면 막는다. 금액은 반드시 정수여야 오차가 안 생긴다.
// ══════════════════════════════════════════════════════════════

// 상품 등록·수정 폼 입력 검증. 순수 함수이므로 TDD 대상이다 (ADR-004).
//
// 폼에서 오는 값은 전부 문자열이다. 여기서 정수로 바꾸고, 바꾸지 못하면 실패시킨다.
// 금액과 재고는 원 단위 정수만 허용한다 — 소수·지수 표기·부동소수가 들어오면
// 합계가 1원씩 어긋나거나 DB 의 integer 컬럼에서 그대로 터진다 (ADR-005).

export type ProductInput = {
  name: string
  price: number
  category: string
  stock: number
  imageUrl: string | null
  description: string | null
}

export type ProductFormField = 'name' | 'price' | 'category' | 'stock' | 'imageUrl' | 'description'

export type ProductFormResult = {
  ok: boolean
  value?: ProductInput
  errors: Partial<Record<ProductFormField, string>>
}

export type ProductFormRawInput = {
  name?: string
  price?: string | number
  category?: string
  stock?: string | number
  imageUrl?: string
  description?: string
}

/** Postgres integer 의 상한. 이걸 넘기면 DB 가 영문 에러를 던지므로 여기서 먼저 막는다. */
const MAX_INT = 2147483647

/** 앞뒤 공백만 허용하고 그 외에는 숫자만. '1e3', '1,000', '1000.5', '-1' 은 전부 걸린다. */
const DIGITS_ONLY = /^[0-9]+$/

/**
 * 정수로 바꾸거나 null. Number() 를 그냥 쓰면 '1e3'·'0x10'·' ' 가 통과해 버리므로
 * 문자열은 숫자 표기만 허용하는 정규식으로 먼저 거른다.
 */
function toNonNegativeInteger(raw: string | number | undefined): number | null {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0 || raw > MAX_INT) return null
    return raw
  }

  const text = (raw ?? '').trim()
  if (!DIGITS_ONLY.test(text)) return null

  const parsed = Number(text)
  if (!Number.isSafeInteger(parsed) || parsed > MAX_INT) return null
  return parsed
}

export function validateProductInput(input: ProductFormRawInput): ProductFormResult {
  const errors: Partial<Record<ProductFormField, string>> = {}

  const name = (input.name ?? '').trim()
  if (name.length < 1) {
    errors.name = '상품명을 입력해 주세요.'
  }

  const category = (input.category ?? '').trim()
  if (category.length < 1) {
    errors.category = '카테고리를 입력해 주세요.'
  }

  const price = toNonNegativeInteger(input.price)
  if (price === null) {
    errors.price = `가격은 0 이상 ${MAX_INT} 이하의 정수(원)로 입력해 주세요.`
  }

  const stock = toNonNegativeInteger(input.stock)
  if (stock === null) {
    errors.stock = `재고는 0 이상 ${MAX_INT} 이하의 정수로 입력해 주세요.`
  }

  // 이미지는 외부 URL 문자열만 받는다 (PRD — 업로드는 MVP 제외).
  // http/https 로 좁히는 것은 javascript: 같은 스킴이 그대로 src 에 들어가는 것을 막기 위해서다.
  const imageUrlText = (input.imageUrl ?? '').trim()
  let imageUrl: string | null = null
  if (imageUrlText.length > 0) {
    if (!/^https?:\/\/\S+$/.test(imageUrlText)) {
      errors.imageUrl = '이미지 주소는 http:// 또는 https:// 로 시작해야 합니다.'
    } else {
      imageUrl = imageUrlText
    }
  }

  const descriptionText = (input.description ?? '').trim()
  const description = descriptionText.length > 0 ? descriptionText : null

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    errors: {},
    value: { name, price: price as number, category, stock: stock as number, imageUrl, description },
  }
}
