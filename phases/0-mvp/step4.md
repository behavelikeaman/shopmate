# Step 4: auth

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (패턴, Supabase 클라이언트 3종)
- `/docs/ADR.md` (ADR-008 관리자 판별)
- `/docs/PRD.md` (화면 표)
- `/docs/UI_GUIDE.md` (입력 필드·버튼 클래스)
- `/CLAUDE.md`
- `/src/services/supabase.ts`
- `/supabase/migrations/0002_rls.sql` (정책이 `auth.uid()`를 어떻게 쓰는지)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Supabase Auth 기반 이메일+비밀번호 인증을 붙인다.

### 1. `src/middleware.ts` — 세션 갱신

`@supabase/ssr`의 `createServerClient`로 요청/응답 쿠키를 이어받아 `supabase.auth.getUser()`를 호출해 세션을 갱신하는 미들웨어를 만든다. 이게 없으면 만료된 토큰이 갱신되지 않아 사용자가 임의로 로그아웃된다.

- `matcher`에서 정적 자산(`_next/static`, `_next/image`, 파비콘, 이미지 확장자)을 제외한다.
- **미들웨어에서 응답 객체를 새로 만들어 쿠키를 잃어버리지 마라.** `createServerClient`에 넘긴 응답 객체를 그대로 반환해야 갱신된 세션 쿠키가 브라우저에 도달한다.
- 미들웨어는 `/admin` 접근 시 비로그인 사용자를 `/login`으로 보내는 정도의 UI 가드만 한다. **권한의 실제 방어선은 RLS다** (ADR-008). 미들웨어 검사만 믿고 서버 로직에서 권한 확인을 생략하지 마라.

### 2. `src/services/auth.ts`

```ts
export async function getCurrentUser(): Promise<{ id: string; email: string } | null>
export async function getCurrentProfile(): Promise<{ id: string; email: string; role: Role } | null>
export async function requireUser(): Promise<{ id: string; email: string }>   // 없으면 /login 으로 redirect
export async function requireAdmin(): Promise<{ id: string; email: string }>  // admin 아니면 notFound() 또는 redirect
```

`requireAdmin`은 `profiles.role`을 서버에서 실제로 조회해 판정한다. 클라이언트가 보낸 값이나 쿠키의 커스텀 클레임을 믿지 마라.

### 3. Server Actions — `src/app/(auth)/actions.ts` 또는 동등한 위치

```ts
export async function signUp(formData: FormData): Promise<{ error: string } | void>
export async function signIn(formData: FormData): Promise<{ error: string } | void>
export async function signOut(): Promise<void>
```

- 성공 시 `revalidatePath('/', 'layout')` 후 `redirect`.
- Supabase의 원문 에러 메시지(영문)를 그대로 노출하지 말고 한국어 한 줄로 매핑한다. 단, "이메일이 이미 존재함"과 "비밀번호 틀림"을 구분해서 알려주지 않는 것이 안전하다면 로그인 실패는 "이메일 또는 비밀번호가 올바르지 않습니다"로 통일한다.
- 비밀번호 최소 길이 등 클라이언트 검증을 하더라도 **서버 액션에서 다시 검증한다.**

### 4. 화면

- `src/app/login/page.tsx`, `src/app/signup/page.tsx` — UI_GUIDE의 입력 필드·버튼 클래스를 사용한다. 폼은 Server Action에 직접 `action={...}`으로 연결하고, 에러 표시가 필요한 부분만 Client Component로 감싼다.
- `src/components/` 에 헤더를 만들어 `layout.tsx`에 넣는다: 로고(ShopMate), 장바구니 링크, 로그인 상태에 따라 "로그인" 또는 "주문내역 / 로그아웃". 관리자면 "관리자" 링크 추가.

이메일 인증 메일, 비밀번호 재설정, 소셜 로그인은 MVP 제외다 (PRD). Supabase 대시보드에서 이메일 확인(Confirm email)을 꺼야 가입 즉시 로그인되는데, 이건 사람이 해야 하는 설정이므로 README에 안내가 필요하면 `blocked`가 아니라 summary에 남겨라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. /signup 에서 가입 → 헤더가 로그인 상태로 바뀐다
# 2. Supabase 대시보드 profiles 테이블에 같은 id의 행이 자동 생성되어 있다 (Step 1 트리거)
# 3. 로그아웃 → 다시 로그인 → 세션 유지
# 4. 비로그인 상태로 /admin/products 접근 → /login 으로 이동
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `requireAdmin`이 DB의 `profiles.role`을 실제로 조회하는가? (ADR-008)
   - 미들웨어가 응답 객체를 갈아치우지 않고 세션 쿠키를 보존하는가?
   - `service_role` 키가 인증 경로에 쓰이지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 파일과 인증 함수·액션 시그니처, 사람이 해야 할 대시보드 설정이 있으면 함께"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 관리자 여부를 미들웨어의 경로 검사만으로 보호하지 마라. 이유: Server Action은 미들웨어를 거치지 않는 경로로 호출될 수 있고, 실제 방어선은 RLS와 서버측 role 조회다 (ADR-008).
- `profiles` 행을 애플리케이션 코드에서 INSERT하지 마라. 이유: Step 1의 트리거가 담당한다. 두 곳에서 만들면 중복·누락이 생긴다.
- 사용자에게 `role`을 스스로 바꿀 수 있는 경로(폼, 액션)를 만들지 마라. 이유: 누구나 관리자가 된다.
- 비밀번호를 직접 해싱하거나 자체 세션 쿠키를 만들지 마라. 이유: Supabase Auth에 위임하기로 했다 (ADR-002).
- 장바구니·주문 기능을 만들지 마라. 이유: Step 5~6의 범위다.
- 기존 테스트를 깨뜨리지 마라.
