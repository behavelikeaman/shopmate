'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 상품 등록·수정 폼
// 잘못 입력한 칸 바로 아래에 이유를 적어준다.
// ★ '누가 파는지'를 담는 숨은 칸이 없다. 있으면 남의 이름으로 상품을 올릴 수 있다.
// ══════════════════════════════════════════════════════════════

// 상품 등록·수정 폼. 등록과 수정이 같은 필드를 쓰므로 한 컴포넌트로 둔다.
//
// Client Component 인 이유는 서버가 돌려준 필드 에러를 입력 아래에 남기고
// 제출 중 버튼을 잠그기 위해서다. 검증 규칙은 lib/product-form.ts 에만 있다.
//
// seller_id 를 담는 hidden 필드는 없다. 있으면 남의 이름으로 상품을 올릴 수 있다.
import Link from 'next/link'
import { useActionState } from 'react'

import type { ProductFormState } from '@/app/seller/products/actions'
import type { Product } from '@/types'

const INPUT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none'
const LABEL_CLASS = 'block text-sm text-neutral-700'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-[#b91c1c]">{message}</p>
}

export function ProductForm({
  action,
  product,
  submitLabel,
}: {
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>
  /** 수정일 때만 들어온다. 없으면 등록 폼이다. */
  product?: Product
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, null)
  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="name">
          상품명
        </label>
        <input
          className={INPUT_CLASS}
          defaultValue={product?.name}
          id="name"
          name="name"
          placeholder="무선 이어폰"
          type="text"
        />
        <FieldError message={fieldErrors.name} />
      </div>

      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="category">
          카테고리
        </label>
        <input
          className={INPUT_CLASS}
          defaultValue={product?.category}
          id="category"
          name="category"
          placeholder="전자기기"
          type="text"
        />
        <FieldError message={fieldErrors.category} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={LABEL_CLASS} htmlFor="price">
            가격 (원)
          </label>
          {/* type=number 로 두되 검증은 서버가 한다. 브라우저 검사는 우회된다. */}
          <input
            className={`${INPUT_CLASS} tabular-nums`}
            defaultValue={product?.price}
            id="price"
            inputMode="numeric"
            name="price"
            placeholder="49000"
            type="text"
          />
          <FieldError message={fieldErrors.price} />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS} htmlFor="stock">
            재고 (개)
          </label>
          <input
            className={`${INPUT_CLASS} tabular-nums`}
            defaultValue={product?.stock}
            id="stock"
            inputMode="numeric"
            name="stock"
            placeholder="10"
            type="text"
          />
          <FieldError message={fieldErrors.stock} />
        </div>
      </div>

      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="imageUrl">
          이미지 주소 (선택)
        </label>
        <input
          className={INPUT_CLASS}
          defaultValue={product?.imageUrl ?? ''}
          id="imageUrl"
          name="imageUrl"
          placeholder="https://example.com/photo.jpg"
          type="url"
        />
        <FieldError message={fieldErrors.imageUrl} />
        {/* 이미지 업로드는 MVP 범위 밖이다 (PRD). 외부 주소만 받는다. */}
        <p className="text-xs text-neutral-500">
          이미지 파일 업로드는 아직 지원하지 않습니다. 인터넷에 올라온 사진 주소를 붙여 넣어 주세요.
        </p>
      </div>

      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="description">
          상품 설명 (선택)
        </label>
        <textarea
          className={INPUT_CLASS}
          defaultValue={product?.description ?? ''}
          id="description"
          name="description"
          rows={5}
        />
        <FieldError message={fieldErrors.description} />
      </div>

      {state?.error && <p className="text-sm text-[#b91c1c]">{state.error}</p>}

      <div className="flex items-center gap-4">
        <button
          className="rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#115e59] disabled:bg-neutral-300"
          disabled={pending}
          type="submit"
        >
          {pending ? '저장 중…' : submitLabel}
        </button>
        <Link
          className="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
          href="/seller/products"
        >
          취소하고 목록으로
        </Link>
      </div>
    </form>
  )
}
