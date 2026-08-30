'use client'

// 로그인 / 가입 폼. Client Component 인 이유는 두 가지뿐이다:
//   1) 서버가 돌려준 에러 문구를 화면에 남겨야 한다
//   2) "판매자로 가입" 체크에 따라 스토어명 입력을 보여줘야 한다
// 검증 자체는 여기서 하지 않는다. 서버 액션이 다시 검증한다.
import { useActionState, useState } from 'react'

import { signIn, signUp } from '@/app/(auth)/actions'

type AuthState = { error: string } | null

const INPUT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none'
const LABEL_CLASS = 'block text-sm text-neutral-700'
const PRIMARY_CLASS =
  'w-full rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#115e59] disabled:bg-neutral-300'

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next: string }) {
  const action = mode === 'login' ? signIn : signUp

  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    async (_prev, formData) => (await action(formData)) ?? null,
    null,
  )

  const [isSeller, setIsSeller] = useState(false)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="email">
          이메일
        </label>
        <input
          className={INPUT_CLASS}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor="password">
          비밀번호
        </label>
        <input
          className={INPUT_CLASS}
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'signup' ? 6 : undefined}
          placeholder={mode === 'signup' ? '6자 이상' : ''}
        />
      </div>

      {mode === 'signup' && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              className="h-4 w-4 rounded-sm border-neutral-300"
              name="isSeller"
              type="checkbox"
              checked={isSeller}
              onChange={(event) => setIsSeller(event.target.checked)}
            />
            판매자로 가입
          </label>

          {isSeller && (
            <div className="space-y-1">
              <label className={LABEL_CLASS} htmlFor="storeName">
                스토어명
              </label>
              <input
                className={INPUT_CLASS}
                id="storeName"
                name="storeName"
                type="text"
                required
                placeholder="상품 상세에 표시됩니다"
              />
            </div>
          )}
        </div>
      )}

      {state?.error && <p className="text-sm text-[#b91c1c]">{state.error}</p>}

      <button className={PRIMARY_CLASS} type="submit" disabled={pending}>
        {mode === 'login' ? '로그인' : '가입하기'}
      </button>
    </form>
  )
}
