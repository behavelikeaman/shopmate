'use client'

// ══════════════════════════════════════════════════════════════
// [화면] 오류 화면
// 화면을 그리다 문제가 생기면 이게 대신 뜬다. 한 줄 안내와 '다시 시도' 버튼만 있다.
// ══════════════════════════════════════════════════════════════

// 렌더가 실패했을 때의 화면. 빨간 배경 박스가 아니라 한 줄 + 재시도 수단이다 (UI_GUIDE).
// 원본 에러 메시지는 보여주지 않는다 — DB 사정이 손님에게 갈 이유가 없다.
import Link from 'next/link'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center">
      <p className="text-sm text-[#b91c1c]">화면을 불러오지 못했습니다.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
          onClick={reset}
          type="button"
        >
          다시 시도
        </button>
        <Link
          className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
          href="/"
        >
          홈으로
        </Link>
      </div>
    </main>
  )
}
