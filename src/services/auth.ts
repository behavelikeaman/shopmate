// ══════════════════════════════════════════════════════════════
// [창구] 로그인 정보 확인
// 지금 접속한 사람이 누구인지, 판매자인지 데이터베이스에 물어본다.
// 판매자 여부는 반드시 DB에 다시 물어본다. 브라우저가 보낸 말을 믿지 않는다.
// ══════════════════════════════════════════════════════════════

// 인증·권한 조회. 전부 서버 클라이언트(anon + 쿠키 세션)를 쓰므로 RLS 가 그대로 적용된다.
//
// 역할 판정은 반드시 여기서, DB 의 profiles.role 을 실제로 읽어서 한다 (ADR-008).
// 클라이언트가 보낸 값이나 JWT 의 커스텀 클레임을 믿으면 안 된다.
import 'server-only'

import { redirect } from 'next/navigation'

import { safeNextPath } from '@/lib/redirect'
import type { Role } from '@/types'

import { createServerSupabaseClient } from './supabase'

export type CurrentUser = {
  id: string
  email: string
}

export type CurrentProfile = CurrentUser & {
  role: Role
  /** 판매자가 아니면 null. 스토어명은 seller_profiles 에 있다 (ADR-011). */
  storeName: string | null
}

/** 로그인한 사용자. 없으면 null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabaseClient()

  // getSession() 이 아니라 getUser() 를 쓴다 — 토큰을 서버에서 검증해야 신뢰할 수 있다.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return { id: user.id, email: user.email ?? '' }
}

/** 로그인한 사용자 + DB 에서 읽은 역할·스토어명. 없으면 null. */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // profiles 는 본인 행만 SELECT 된다 (RLS). 없을 수도 있으므로 maybeSingle.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(`프로필을 불러오지 못했습니다: ${error.message}`)

  const role = (profile?.role as Role | undefined) ?? 'customer'

  let storeName: string | null = null
  if (role === 'seller' || role === 'admin') {
    const { data: sellerProfile, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('store_name')
      .eq('id', user.id)
      .maybeSingle()

    if (sellerError) {
      throw new Error(`스토어 정보를 불러오지 못했습니다: ${sellerError.message}`)
    }
    storeName = (sellerProfile?.store_name as string | undefined) ?? null
  }

  return { id: user.id, email: user.email ?? '', role, storeName }
}

/** 로그인이 필요한 화면에서 쓴다. 비로그인이면 /login?next=... 으로 보낸다. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (user) return user

  const target = safeNextPath(next)
  redirect(target === '/' ? '/login' : `/login?next=${encodeURIComponent(target)}`)
}

/**
 * 판매자 화면 가드. seller 와 admin 둘 다 통과한다 —
 * admin 전용 화면을 만들지 않고 판매자 콘솔을 그대로 재사용하기 때문이다 (ADR-016).
 *
 * 화면 가드일 뿐이고, 데이터 격리는 RLS 가 보장한다 (ADR-008).
 */
export async function requireSeller(
  next = '/seller/products',
): Promise<{ id: string; email: string; storeName: string }> {
  const profile = await getCurrentProfile()

  if (!profile) {
    const target = safeNextPath(next)
    redirect(target === '/' ? '/login' : `/login?next=${encodeURIComponent(target)}`)
  }

  if (profile.role !== 'seller' && profile.role !== 'admin') {
    // 존재를 알려줄 이유가 없다. 판매자가 아니면 그냥 없는 화면이다.
    redirect('/')
  }

  return {
    id: profile.id,
    email: profile.email,
    // admin 은 seller_profiles 행이 없을 수 있다. 화면 표기용 기본값을 준다.
    storeName: profile.storeName ?? (profile.role === 'admin' ? '운영자' : ''),
  }
}
