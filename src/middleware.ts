// 세션 갱신 미들웨어.
//
// Supabase 의 로그인 토큰은 수명이 짧고, 요청이 올 때마다 갱신해 줘야 한다.
// 이게 없으면 조용히 만료되어 사용자가 갑자기 로그아웃된다.
//
// 경로 검사(/seller, /checkout, /orders)는 로그인 화면으로 안내하는 UI 편의일 뿐이다.
// 진짜 방어선은 DB 의 RLS 다 (ADR-008) — Server Action 은 이 미들웨어를 거치지 않고도
// 호출될 수 있으므로, 여기의 검사만 믿으면 안 된다.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { safeNextPath } from '@/lib/redirect'

/** 비로그인 사용자를 로그인 화면으로 안내할 경로들. */
const PROTECTED_PREFIXES = ['/seller', '/checkout', '/orders']

export async function middleware(request: NextRequest) {
  // 이 응답 객체를 끝까지 들고 간다. 중간에 NextResponse.next() 를 새로 만들면
  // Supabase 가 심어둔 갱신된 세션 쿠키가 통째로 사라진다.
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 환경 변수가 아직 없으면(설치 직후) 미들웨어가 전 페이지를 500 으로 만들지 않도록 그냥 통과시킨다.
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser() 를 호출해야 토큰 갱신이 실제로 일어난다. getSession() 은 쿠키를 그대로 믿으므로 쓰지 않는다.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', safeNextPath(`${pathname}${search}`))

    // 리다이렉트 응답에도 갱신된 쿠키를 옮겨 실어야 한다.
    const redirectResponse = NextResponse.redirect(loginUrl)
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: [
    // 정적 자산은 세션 갱신이 필요 없다. 매 이미지마다 Supabase 를 부르면 느리기만 하다.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
