// 판매자 콘솔 공통 레이아웃.
//
// requireSeller() 를 여기 한 번 두어 하위 페이지가 반복하지 않게 한다.
// 다만 이건 화면 가드일 뿐이다 — Server Action 은 레이아웃을 거치지 않고 호출되므로
// 각 액션이 자기 안에서 requireSeller() 를 다시 부른다 (ADR-008).
// 진짜 방어선은 그것도 아니고 RLS 다.
import type { Metadata } from 'next'
import Link from 'next/link'

import { requireSeller } from '@/services/auth'

export const metadata: Metadata = {
  title: '판매자 콘솔 — ShopMate',
}

const TAB_CLASS = 'text-sm text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline'

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const seller = await requireSeller()

  return (
    // 테이블이 들어가므로 고객 화면보다 조금 넓게 잡는다 (UI_GUIDE 레이아웃).
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900">판매자 콘솔</h1>
          <p className="text-sm text-neutral-500">{seller.storeName}</p>
        </div>
        <nav className="flex gap-4 border-b border-neutral-200 pb-3">
          <Link className={TAB_CLASS} href="/seller/products">
            내 상품
          </Link>
          <Link className={TAB_CLASS} href="/seller/orders">
            들어온 주문
          </Link>
        </nav>
      </div>

      {children}
    </main>
  )
}
