'use client'

// 배송지 폼. Client Component 인 이유는 서버가 돌려준 에러를 화면에 남기고
// 제출 중 버튼을 잠그기 위해서다. 검증은 서버 액션이 다시 한다.
//
// 버튼 비활성화는 실수로 두 번 눌리는 것을 줄이는 편의일 뿐이다.
// 중복 주문을 실제로 막는 것은 두 번째 호출에서 장바구니가 비어 있어 거부하는 RPC 다.
import { useActionState } from 'react'

import { placeOrderAction, type PlaceOrderState } from '@/app/checkout/actions'

const INPUT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none'
const LABEL_CLASS = 'block text-sm text-neutral-700'

export function CheckoutForm({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState<PlaceOrderState, FormData>(
    async (_prev, formData) => (await placeOrderAction(formData)) ?? null,
    null,
  )

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="name">
          받는 분
        </label>
        <input
          autoComplete="name"
          className={INPUT_CLASS}
          id="name"
          name="name"
          placeholder="홍길동"
          required
          type="text"
        />
      </div>

      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="phone">
          연락처
        </label>
        <input
          autoComplete="tel"
          className={INPUT_CLASS}
          id="phone"
          name="phone"
          placeholder="010-1234-5678"
          required
          type="tel"
        />
      </div>

      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="address">
          주소
        </label>
        <input
          autoComplete="street-address"
          className={INPUT_CLASS}
          id="address"
          name="address"
          placeholder="서울시 ○○구 ○○로 12, 3층"
          required
          type="text"
        />
      </div>

      {state?.error && <p className="text-sm text-[#b91c1c]">{state.error}</p>}

      <button
        className="w-full rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#115e59] disabled:bg-neutral-300"
        disabled={pending || disabled}
        type="submit"
      >
        {pending ? '주문 처리중…' : '결제하고 주문하기'}
      </button>

      <p className="text-xs text-neutral-500">
        실제 결제는 일어나지 않습니다. 주문은 승인된 것으로 처리됩니다.
      </p>
    </form>
  )
}
