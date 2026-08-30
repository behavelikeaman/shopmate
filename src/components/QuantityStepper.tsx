'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 수량 +/- 버튼
// 누를 때마다 수량이 바뀐다. 재고를 넘지 않게 막는다.
// ══════════════════════════════════════════════════════════════

// 수량 스테퍼. 모양은 docs/UI_GUIDE.md "수량 스테퍼" 그대로다.
// 상한을 여기서 막지만 이건 편의일 뿐이다 — 진짜 판정은 Server Action 과 DB 가 한다.

export function QuantityStepper({
  quantity,
  max,
  disabled = false,
  onChange,
}: {
  quantity: number
  max: number
  disabled?: boolean
  onChange: (quantity: number) => void
}) {
  const buttonClass = 'h-8 w-8 text-neutral-600 hover:bg-neutral-50 disabled:text-neutral-300'

  return (
    <div className="inline-flex items-center rounded-md border border-neutral-300">
      <button
        aria-label="수량 줄이기"
        className={buttonClass}
        disabled={disabled || quantity <= 1}
        onClick={() => onChange(quantity - 1)}
        type="button"
      >
        −
      </button>
      <span className="w-10 text-center text-sm tabular-nums">{quantity}</span>
      <button
        aria-label="수량 늘리기"
        className={buttonClass}
        disabled={disabled || quantity >= max}
        onClick={() => onChange(quantity + 1)}
        type="button"
      >
        +
      </button>
    </div>
  )
}
