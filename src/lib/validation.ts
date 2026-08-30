// ══════════════════════════════════════════════════════════════
// [계산기] 배송지 입력 검사
// 이름·전화번호·주소가 제대로 채워졌는지 본다. 틀리면 한국어 안내 문구를 돌려준다.
// ══════════════════════════════════════════════════════════════

import type { ShippingInfo } from '@/types'

export type ShippingValidationResult = {
  ok: boolean
  errors: Partial<Record<keyof ShippingInfo, string>>
}

const PHONE_ALLOWED = /^[0-9-]+$/

/** 배송지 입력 검증. Server Action 은 이 결과와 무관하게 서버에서도 다시 검사한다. */
export function validateShipping(input: Partial<ShippingInfo>): ShippingValidationResult {
  const errors: Partial<Record<keyof ShippingInfo, string>> = {}

  const name = (input.name ?? '').trim()
  if (name.length < 1) {
    errors.name = '받는 분 이름을 입력해 주세요.'
  }

  const phone = (input.phone ?? '').trim()
  const digits = phone.replace(/-/g, '')
  if (!PHONE_ALLOWED.test(phone)) {
    errors.phone = '연락처는 숫자와 하이픈(-)만 입력할 수 있습니다.'
  } else if (digits.length < 9 || digits.length > 11) {
    errors.phone = '연락처는 숫자 9~11자리로 입력해 주세요.'
  }

  const address = (input.address ?? '').trim()
  if (address.length < 5) {
    errors.address = '주소를 5자 이상 입력해 주세요.'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}
