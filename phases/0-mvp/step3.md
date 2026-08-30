# Step 3: supabase-clients

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (Supabase 클라이언트 3종 표, 데이터 흐름)
- `/docs/ADR.md` (ADR-002)
- `/CLAUDE.md` (service_role 키 CRITICAL 규칙)
- `/.env.example`
- `/supabase/migrations/0001_schema.sql`
- `/src/types/index.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Supabase 접근 계층을 만든다.

### 1. 패키지

`@supabase/supabase-js`와 `@supabase/ssr`을 설치한다. (`@supabase/auth-helpers-nextjs`는 deprecated이므로 쓰지 마라.)

### 2. `src/services/supabase.ts` — 클라이언트 팩토리 3종

```ts
export function createBrowserSupabaseClient()       // anon 키, Client Component 전용
export async function createServerSupabaseClient()  // anon 키 + Next cookies() 세션, Server Component/Action 기본값
export function createAdminSupabaseClient()         // service_role 키, RLS 우회
```

규칙:
- 세 함수 모두 환경 변수가 없으면 명확한 메시지와 함께 `throw` 한다. 조용히 `undefined`를 넘기면 나중에 엉뚱한 곳에서 터진다.
- `createAdminSupabaseClient`는 파일 상단에 `import 'server-only'`를 두어 클라이언트 번들 유입을 빌드 타임에 막는다. 만약 `server-only` 패키지를 쓰지 않기로 했다면, 최소한 `process.env.SUPABASE_SERVICE_ROLE_KEY` 접근부가 클라이언트 컴포넌트에서 import될 수 없도록 파일을 분리하라.
- `createServerSupabaseClient`는 `@supabase/ssr`의 `createServerClient`에 Next.js `cookies()` 어댑터를 물린다. Server Component에서는 쿠키 쓰기가 불가능하므로 `setAll`에서 발생하는 예외를 삼켜야 한다 (미들웨어가 갱신을 담당한다).

### 3. `src/services/products.ts` — 상품 조회

```ts
export async function listProducts(opts?: { category?: string; query?: string }): Promise<Product[]>
export async function getProduct(id: string): Promise<Product | null>
export async function listCategories(): Promise<string[]>
export async function getStockMap(productIds: string[]): Promise<Record<string, number>>
```

규칙:
- 전부 `createServerSupabaseClient()`를 쓴다. 상품 읽기는 익명도 허용되므로 admin 클라이언트가 필요 없다.
- snake_case → camelCase 변환은 이 파일 안의 작은 매핑 함수 하나로 처리한다. 컴포넌트에 `price_krw` 같은 DB 컬럼명이 새어 나가지 않게 하라.
- `query`는 상품명 부분 일치(`ilike`)로 처리한다.
- Supabase 에러는 삼키지 말고 `throw new Error(...)`로 올린다. 빈 배열로 뭉개면 "상품이 없음"과 "조회 실패"가 구분되지 않는다.
- `getProduct`는 없는 id에 대해 `null`을 반환한다 (에러 아님).

`services/`는 클래스나 팩토리 객체가 아니라 평범한 `async` 함수의 모음이다 (CLAUDE.md).

### 4. 임시 확인용 페이지

`src/app/page.tsx`를 Server Component로 두고 `listProducts()` 결과의 개수와 이름만 목록으로 찍는다. 스타일링은 하지 않는다 — 실제 UI는 Step 7이다. 이 step에서는 "DB에서 데이터가 온다"만 확인한다.

## Acceptance Criteria

```bash
npm run build   # 타입·빌드 에러 없음
npm run lint    # lint 통과
npm run test    # 기존 테스트 유지
```

수동 검증 (사람이 수행):
```bash
npm run dev   # http://localhost:3000 에서 시드 상품 이름이 나열되는지 확인
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `SUPABASE_SERVICE_ROLE_KEY`가 클라이언트 컴포넌트나 `NEXT_PUBLIC_*`에 노출되지 않았는가? (CLAUDE.md CRITICAL)
   - `grep -rn "SERVICE_ROLE" src/` 결과가 `services/` 안에만 있는가?
   - `grep -rn '"use client"' src/services/` 결과가 비어 있는가?
   - Supabase 호출이 전부 `services/` 안에 있는가? (컴포넌트·페이지에서 직접 호출하지 않았는가)
3. 결과에 따라 `phases/0-mvp/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 서비스 파일과 export 함수 시그니처"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (Supabase 프로젝트 미생성, 키 미설정, 마이그레이션 미적용 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `service_role` 키를 `NEXT_PUBLIC_` 접두사로 노출하거나 클라이언트 컴포넌트에서 import하지 마라. 이유: 브라우저 번들에 들어가는 순간 누구나 DB 전체를 읽고 쓸 수 있다.
- 조회를 위해 `app/api/` 라우트를 만들지 마라. 이유: ADR-001에서 Server Component 직접 호출을 선택했다.
- 상품 조회에 admin 클라이언트를 쓰지 마라. 이유: RLS를 우회하면 정책이 맞는지 영영 확인되지 않는다.
- Supabase 응답 에러를 `catch {}`로 삼키지 마라. 이유: "데이터 없음"과 "연결 실패"가 구분되지 않아 디버깅이 불가능해진다.
- `services/`를 클래스로 만들지 마라. 이유: CLAUDE.md에서 평범한 async 함수로 못 박았다.
- 인증·장바구니·주문 로직을 만들지 마라. 이유: Step 4~6의 범위다.
- 기존 테스트를 깨뜨리지 마라.
