'use server'

// 회원가입 / 로그인 / 로그아웃 Server Action.
//
// 브라우저가 부르는 함수이므로 넘어온 값은 하나도 믿지 않는다. 클라이언트에서 이미 막았더라도
// 여기서 다시 검증한다.
//
// profiles / seller_profiles 행은 여기서 만들지 않는다. auth.users INSERT 트리거
// handle_new_user 가 raw_user_meta_data 를 읽어 만든다 (Step 1). 두 곳에서 만들면 어긋난다.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { safeNextPath } from '@/lib/redirect'
import { createServerSupabaseClient } from '@/services/supabase'

/** Supabase 최소 요구치와 맞춘다. 값이 어긋나면 사용자가 이유를 모른 채 거절당한다. */
const MIN_PASSWORD_LENGTH = 6

function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Supabase 의 영문 에러를 한국어 한 줄로 바꾼다.
 * 로그인 실패는 사유를 나누지 않는다 — 계정이 있는지 없는지를 알려주면 계정 열거에 쓰인다.
 */
function toSignUpMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return '이미 가입된 이메일입니다.'
  }
  if (lower.includes('password')) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  }
  if (lower.includes('email')) {
    return '이메일 형식이 올바르지 않습니다.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  }
  return '가입에 실패했습니다. 잠시 후 다시 시도해 주세요.'
}

export async function signUp(formData: FormData): Promise<{ error: string } | void> {
  const email = readString(formData, 'email')
  const password = readString(formData, 'password')
  const isSeller = formData.get('isSeller') === 'on' || formData.get('isSeller') === 'true'
  const storeName = readString(formData, 'storeName')
  const next = safeNextPath(readString(formData, 'next'))

  if (!email) return { error: '이메일을 입력해 주세요.' }
  if (!password) return { error: '비밀번호를 입력해 주세요.' }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` }
  }
  // 스토어명 없이 판매자가 될 수 없다. 상품 상세에 표시되어야 하는 값이다.
  if (isSeller && !storeName) return { error: '스토어명을 입력해 주세요.' }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // 이 값이 raw_user_meta_data 로 들어가고, 트리거가 읽어 role 과 seller_profiles 를 만든다.
      // role 을 직접 담지 않는다 — admin 으로 가는 경로를 만들지 않기 위해서다 (ADR-008).
      data: isSeller ? { is_seller: true, store_name: storeName } : { is_seller: false },
    },
  })

  if (error) return { error: toSignUpMessage(error.message) }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function signIn(formData: FormData): Promise<{ error: string } | void> {
  const email = readString(formData, 'email')
  const password = readString(formData, 'password')
  const next = safeNextPath(readString(formData, 'next'))

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // 사유를 세분화하지 않는다 (계정 존재 여부 노출 방지).
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/')
}
