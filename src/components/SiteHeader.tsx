// 사이트 헤더. Server Component 라서 로그인 상태를 서버에서 직접 읽는다.
import Link from 'next/link'

import { signOut } from '@/app/(auth)/actions'
import { CartMerge } from '@/components/CartMerge'
import { getCurrentProfile } from '@/services/auth'
import { getCartCount } from '@/services/cart'

const NAV_LINK_CLASS = 'text-sm text-neutral-500 hover:text-neutral-900'

function CartIcon() {
  // 아이콘 라이브러리를 새로 설치하지 않는다 (UI_GUIDE). 필요한 것만 직접 그린다.
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        d="M2.25 3h1.5l1.9 10.2a1.5 1.5 0 0 0 1.48 1.23h8.9a1.5 1.5 0 0 0 1.47-1.19L19.5 6H5.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="19" r="1.25" />
      <circle cx="16.5" cy="19" r="1.25" />
    </svg>
  )
}

export async function SiteHeader() {
  const profile = await getCurrentProfile()
  const isSeller = profile?.role === 'seller' || profile?.role === 'admin'

  // 비로그인 장바구니는 브라우저에만 있으므로 서버가 개수를 셀 수 없다. 그때는 뱃지를 감춘다.
  const cartCount = profile ? await getCartCount(profile.id) : 0

  return (
    <header className="border-b border-neutral-200">
      {/* 로그인 상태로 어느 화면을 열든, 브라우저에 남아 있던 장바구니를 한 번 서버로 합친다. */}
      {profile && <CartMerge />}

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link className="text-lg font-semibold text-neutral-900" href="/">
          ShopMate
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            className="relative inline-flex items-center text-neutral-700 hover:text-neutral-900"
            href="/cart"
          >
            <CartIcon />
            <span className="sr-only">장바구니</span>
            {cartCount > 0 && (
              <span className="ml-1 text-xs tabular-nums text-neutral-700">{cartCount}</span>
            )}
          </Link>

          {isSeller && (
            <Link className={NAV_LINK_CLASS} href="/seller/products">
              판매자 콘솔
            </Link>
          )}

          {profile ? (
            <>
              <Link className={NAV_LINK_CLASS} href="/orders">
                주문내역
              </Link>
              <form action={signOut}>
                <button className={NAV_LINK_CLASS} type="submit">
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link className={NAV_LINK_CLASS} href="/login">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
