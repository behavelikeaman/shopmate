import Link from 'next/link'

import { AuthForm } from '@/components/AuthForm'
import { safeNextPath } from '@/lib/redirect'

export const metadata = { title: '로그인 · ShopMate' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // 로그인 후 원래 가려던 화면으로 돌려보낸다 (PRD "로그인 전환").
  // 값은 여기서 한 번, 서버 액션에서 한 번 더 검증한다.
  const { next } = await searchParams

  return (
    <main className="mx-auto max-w-sm px-4 py-16 space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-900">로그인</h1>

      <AuthForm mode="login" next={safeNextPath(next)} />

      <p className="text-sm text-neutral-500">
        계정이 없으신가요?{' '}
        <Link
          className="text-neutral-900 underline-offset-4 hover:underline"
          href={`/signup?next=${encodeURIComponent(safeNextPath(next))}`}
        >
          회원가입
        </Link>
      </p>
    </main>
  )
}
