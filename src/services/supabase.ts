// Supabase 클라이언트 팩토리 3종 (docs/ARCHITECTURE.md "Supabase 클라이언트 3종").
//
// 이 파일은 service_role 키를 읽는 유일한 곳이다.
// 'server-only' 를 최상단에 두어, 클라이언트 컴포넌트가 이 파일을 import 하면
// 런타임이 아니라 빌드 타임에 실패하게 만든다.
import 'server-only'

import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * 환경 변수를 읽되, 없으면 조용히 undefined 를 넘기지 않고 즉시 던진다.
 * undefined 를 그대로 넘기면 한참 뒤 Supabase 내부에서 알아보기 힘든 에러가 난다.
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `환경 변수 ${name} 가 설정되지 않았습니다. .env.example 을 복사해 .env.local 을 만들고 값을 채워 주세요.`,
    )
  }
  return value
}

/** anon 키. Client Component 전용 (세션 읽기 정도). RLS 가 적용된다. */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}

/**
 * anon 키 + 쿠키 세션. Server Component / Server Action 의 기본값이다.
 * 호출자의 권한으로 동작하므로 RLS 가 그대로 적용된다.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component 에서는 쿠키를 쓸 수 없다. 세션 갱신은 미들웨어가 담당하므로
            // 여기서의 실패는 무시해도 안전하다.
          }
        },
      },
    },
  )
}

/**
 * service_role 키. RLS 를 우회한다.
 *
 * 이 프로젝트에서 실제로 필요한 곳은 사실상 없다 (재고 차감·복구는 security definer RPC 안에서
 * 일어난다). 이 함수를 꺼내 쓰고 싶어지면 대개 RLS 정책이 틀렸다는 신호다.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
