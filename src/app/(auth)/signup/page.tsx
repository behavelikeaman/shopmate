import Link from 'next/link'

import { AuthForm } from '@/components/AuthForm'
import { safeNextPath } from '@/lib/redirect'

export const metadata = { title: '회원가입 · ShopMate' }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="mx-auto max-w-sm px-4 py-16 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">회원가입</h1>
        <p className="text-sm text-neutral-500">이메일과 비밀번호만 있으면 됩니다.</p>
      </div>

      <AuthForm mode="signup" next={safeNextPath(next)} />

      <p className="text-sm text-neutral-500">
        이미 계정이 있으신가요?{' '}
        <Link
          className="text-neutral-900 underline-offset-4 hover:underline"
          href={`/login?next=${encodeURIComponent(safeNextPath(next))}`}
        >
          로그인
        </Link>
      </p>
    </main>
  )
}
