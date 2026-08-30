# Step 4: auth

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — 패턴, 클라이언트 3종, 권한(RLS) 표
- `/docs/ADR.md` — ADR-008(역할 3종·판매자 격리), ADR-011(profiles 분리), ADR-016(운영자 화면 제외)
- `/docs/PRD.md` — 사용자 절, "로그인 전환" 규칙
- `/docs/UI_GUIDE.md` — 입력 필드·버튼 클래스
- `/CLAUDE.md`
- `/src/services/supabase.ts`, `/src/types/index.ts`
- `/supabase/migrations/0001_schema.sql` (가입 트리거가 `raw_user_meta_data`를 어떻게 읽는지)
- `/supabase/migrations/0002_rls.sql`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Supabase Auth 기반 이메일+비밀번호 인증을 붙인다. 역할은 `customer` / `seller` / `admin` 세 가지다.

### 1. `src/middleware.ts` — 세션 갱신

`@supabase/ssr`의 `createServerClient`로 요청/응답 쿠키를 이어받아 `supabase.auth.getUser()`를 호출해 세션을 갱신한다. 이게 없으면 만료된 토큰이 갱신되지 않아 사용자가 임의로 로그아웃된다.

- `matcher`에서 정적 자산(`_next/static`, `_next/image`, 파비콘, 이미지 확장자)을 제외한다.
- **응답 객체를 새로 만들어 쿠키를 잃어버리지 마라.** `createServerClient`에 넘긴 응답 객체를 그대로 반환해야 갱신된 세션 쿠키가 브라우저에 도달한다.
- `/seller`·`/checkout`·`/orders` 접근 시 비로그인 사용자를 `/login?next=<원래경로>`로 보낸다. **이건 UI 편의일 뿐이다. 권한의 실제 방어선은 RLS다** (ADR-008).

### 2. `src/services/auth.ts`

```ts
export async function getCurrentUser(): Promise<{ id: string; email: string } | null>
export async function getCurrentProfile(): Promise<{ id: string; email: string; role: Role; storeName: string | null } | null>
export async function requireUser(next?: string): Promise<{ id: string; email: string }>   // 없으면 /login?next= 로 redirect
export async function requireSeller(): Promise<{ id: string; email: string; storeName: string }>  // seller 또는 admin 아니면 redirect/notFound
```

- `requireSeller`는 `profiles.role`을 **서버에서 실제로 조회해** 판정한다. 클라이언트가 보낸 값이나 커스텀 클레임을 믿지 마라.
- `admin`은 판매자 화면을 그대로 쓴다 (ADR-016). 그래서 `requireSeller`는 `seller`와 `admin` 둘 다 통과시킨다.
- 스토어명은 `seller_profiles`에서 읽는다 (ADR-011).

### 3. Server Actions — `src/app/(auth)/actions.ts` 또는 동등한 위치

```ts
export async function signUp(formData: FormData): Promise<{ error: string } | void>
export async function signIn(formData: FormData): Promise<{ error: string } | void>
export async function signOut(): Promise<void>
```

- `signUp`은 "판매자로 가입" 체크와 스토어명을 받아 `options.data`(→ `raw_user_meta_data`)에 실어 보낸다. 트리거가 이걸 읽어 `profiles.role = 'seller'`와 `seller_profiles` 행을 만든다 (Step 1). **애플리케이션 코드로 `profiles`/`seller_profiles`를 INSERT하지 마라.**
- 판매자를 선택했으면 스토어명이 비어 있으면 안 된다. 서버에서 검증한다.
- 성공 시 `revalidatePath('/', 'layout')` 후 `next` 파라미터가 있으면 그 경로로, 없으면 `/`로 `redirect` (PRD "로그인 전환" 규칙).
  - **`next`는 반드시 검증한다.** `/`로 시작하고 `//`로 시작하지 않는 내부 경로만 허용한다. 아니면 `/`로 보낸다. 검증 없이 쓰면 외부 사이트로 튕기는 오픈 리다이렉트가 된다.
- Supabase의 영문 에러를 그대로 노출하지 말고 한국어 한 줄로 매핑한다. 로그인 실패는 "이메일 또는 비밀번호가 올바르지 않습니다"로 통일한다(계정 존재 여부를 알려주지 않는다).
- 비밀번호 길이 등은 클라이언트에서 막더라도 **서버 액션에서 다시 검증한다.**

### 4. 화면

- `src/app/login/page.tsx`, `src/app/signup/page.tsx` — UI_GUIDE의 입력 필드·버튼 클래스를 쓴다. 폼은 Server Action에 `action={...}`으로 직접 연결하고, 에러 표시가 필요한 부분만 Client Component로 감싼다. `searchParams`의 `next`를 hidden 필드로 실어 보낸다.
- 가입 폼: 이메일 / 비밀번호 / **"판매자로 가입" 체크박스 → 체크 시 스토어명 입력 노출**.
- `src/components/`에 헤더를 만들어 `layout.tsx`에 넣는다: 로고(ShopMate), 장바구니 링크(담긴 개수), 로그인 상태에 따라 "로그인" 또는 "주문내역 / 로그아웃". 판매자(또는 admin)면 "판매자 콘솔" 링크 추가.

이메일 인증 메일·비밀번호 재설정·소셜 로그인은 MVP 제외다. Supabase 대시보드에서 이메일 확인(Confirm email)을 꺼야 가입 즉시 로그인되는데, 이건 사람이 하는 설정이므로 `blocked`로 멈추지 말고 **summary에 안내를 남겨라.**

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. /signup 에서 일반 가입 → 헤더가 로그인 상태로 바뀐다
# 2. profiles 테이블에 role='customer' 행이 자동 생성되어 있다 (Step 1 트리거)
# 3. "판매자로 가입" + 스토어명으로 가입 → role='seller' 이고 seller_profiles 행도 생겼다
# 4. 로그아웃 → 다시 로그인 → 세션 유지
# 5. 비로그인으로 /seller/products 접근 → /login?next=/seller/products 로 이동,
#    로그인하면 /seller/products 로 돌아온다      ← PRD "로그인 전환" 규칙
# 6. next=https://example.com 을 직접 붙여 로그인 → 외부로 나가지 않고 / 로 간다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `requireSeller`가 DB의 `profiles.role`을 실제로 조회하는가? (ADR-008)
   - 미들웨어가 응답 객체를 갈아치우지 않고 세션 쿠키를 보존하는가?
   - `next` 파라미터를 내부 경로로 검증하는가?
   - `profiles`/`seller_profiles`를 앱 코드에서 INSERT하지 않는가?
3. `phases/0-mvp/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 파일, 인증 함수·액션 시그니처, 사람이 해야 할 대시보드 설정"`
   - 실패 → `"status": "error"` + `error_message` / 개입 필요 → `"status": "blocked"` + `blocked_reason`

## 금지사항

- 관리자·판매자 권한 확인을 미들웨어의 경로 검사만으로 하지 마라. 이유: Server Action은 그 경로를 거치지 않고 호출될 수 있다 (ADR-008).
- `profiles`나 `seller_profiles` 행을 애플리케이션 코드에서 INSERT하지 마라. 이유: Step 1의 트리거가 담당한다. 두 곳에서 만들면 중복·누락이 생긴다.
- 사용자가 `role`을 스스로 바꿀 수 있는 경로(폼, 액션)를 만들지 마라. 특히 `admin`으로 가는 경로는 존재하면 안 된다.
- `next` 파라미터를 검증 없이 `redirect`에 넘기지 마라. 이유: 오픈 리다이렉트가 된다.
- 비밀번호를 직접 해싱하거나 자체 세션 쿠키를 만들지 마라. 이유: Supabase Auth에 위임했다 (ADR-002).
- 운영자 전용 화면을 만들지 마라. 이유: ADR-016에서 MVP 제외로 정했다.
- 장바구니·주문 기능을 만들지 마라. 이유: Step 5~7의 범위다.
- 기존 테스트를 깨뜨리지 마라.
