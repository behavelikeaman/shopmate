# Step 3: supabase-clients

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — Supabase 클라이언트 3종 표, 데이터 흐름
- `/docs/ADR.md` — ADR-001, ADR-002, ADR-011(profiles 분리)
- `/CLAUDE.md` — service_role 키 CRITICAL 규칙
- `/.env.example`
- `/supabase/migrations/0001_schema.sql`, `/supabase/migrations/0002_rls.sql`
- `/src/types/index.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Supabase 접근 계층을 만든다.

### 1. 패키지

`@supabase/supabase-js`와 `@supabase/ssr`을 설치한다. (`@supabase/auth-helpers-nextjs`는 deprecated이므로 쓰지 마라.)

### 2. `src/services/supabase.ts` — 클라이언트 팩토리 3종

```ts
export function createBrowserSupabaseClient()       // anon, Client Component 전용
export async function createServerSupabaseClient()  // anon + Next cookies() 세션, 기본값
export function createAdminSupabaseClient()         // service_role, RLS 우회
```

- 세 함수 모두 환경 변수가 없으면 명확한 메시지와 함께 `throw`. 조용히 `undefined`를 넘기면 나중에 엉뚱한 곳에서 터진다.
- `createAdminSupabaseClient`가 있는 파일 상단에 `import 'server-only'`를 둔다. 클라이언트 번들 유입을 빌드 타임에 막는다.
- `createServerSupabaseClient`는 `@supabase/ssr`의 `createServerClient`에 Next.js `cookies()` 어댑터를 물린다. Server Component에서는 쿠키 쓰기가 불가능하므로 `setAll`의 예외를 삼켜야 한다 (갱신은 미들웨어가 담당).

> ARCHITECTURE에 적힌 대로, 이 프로젝트에서 admin 클라이언트가 실제로 필요한 곳은 사실상 없다. 만들어는 두되 쓰지 마라. 쓰고 싶어지면 대개 RLS 정책이 틀렸다는 신호다.

### 3. `src/services/products.ts` — 상품 조회

```ts
export async function listProducts(opts?: { category?: string; query?: string }): Promise<Product[]>
export async function getProduct(id: string): Promise<Product | null>
export async function listCategories(): Promise<string[]>
export async function getStockMap(productIds: string[]): Promise<Record<string, number>>
export async function getProductsByIds(ids: string[]): Promise<Product[]>
```

규칙:
- 전부 `createServerSupabaseClient()`를 쓴다. 상품 읽기는 익명도 허용되므로 admin 클라이언트가 필요 없다.
- **`Product`에는 판매자 정보(`seller: { id, storeName }`)가 들어간다.** `seller_profiles`를 조인해서 채운다. `profiles`를 조인하지 마라 — 본인 행만 읽히므로 남의 스토어명이 안 나온다 (ADR-011).
- snake_case → camelCase 변환은 이 파일 안의 작은 매핑 함수 하나로. 컴포넌트에 `image_url` 같은 DB 컬럼명이 새어 나가지 않게 하라.
- `query`는 상품명 부분 일치(`ilike`).
- **목록 순서는 등록순(`created_at`)이다.** 품절 상품을 뒤로 밀지 마라 (PRD 규칙).
- Supabase 에러는 삼키지 말고 `throw new Error(...)`로 올린다. 빈 배열로 뭉개면 "상품 없음"과 "조회 실패"가 구분되지 않는다.
- `getProduct`는 없는 id에 대해 `null`을 반환한다(에러 아님).

`services/`는 클래스나 팩토리 객체가 아니라 평범한 `async` 함수의 모음이다 (CLAUDE.md).

### 4. 임시 확인용 페이지

`src/app/page.tsx`를 Server Component로 두고 `listProducts()` 결과를 "상품명 — 스토어명 — 가격 — 재고"로 나열한다. 스타일링은 하지 않는다. 이 step에서는 **판매자 정보까지 붙어서 온다**는 것만 확인한다.

## Acceptance Criteria

```bash
npm run build   # 타입·빌드 에러 없음
npm run lint
npm run test    # 기존 테스트 유지
```

수동 검증 (사람이 수행):
```bash
npm run dev   # http://localhost:3000 에서 시드 상품이 스토어명과 함께 나열되는지 확인
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `grep -rn "SERVICE_ROLE" src/` 결과가 `services/supabase.ts` 한 곳뿐인가?
   - `grep -rn '"use client"' src/services/` 결과가 비어 있는가?
   - Supabase 호출이 전부 `services/` 안에 있는가?
   - 판매자명을 `seller_profiles`에서 가져오는가? (`profiles` 조인이 아닌가)
3. `phases/0-mvp/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성한 서비스 파일과 export 함수 시그니처"`
   - 실패 → `"status": "error"` + `error_message`
   - 사용자 개입 필요 (Supabase 프로젝트 미생성, 키 미설정, 마이그레이션 미적용, 시드의 판매자 uuid 미기입 등) → `"status": "blocked"` + `blocked_reason` 후 즉시 중단

## 금지사항

- `service_role` 키를 `NEXT_PUBLIC_` 접두사로 노출하거나 클라이언트 컴포넌트에서 import하지 마라. 이유: 브라우저 번들에 들어가는 순간 누구나 DB 전체를 읽고 쓸 수 있다.
- 상품 조회에 admin 클라이언트를 쓰지 마라. 이유: RLS를 우회하면 정책이 맞는지 영영 확인되지 않는다.
- 판매자명을 `profiles`에서 조회하지 마라. 이유: `profiles`는 본인 행만 읽히므로 남의 스토어명이 나오지 않는다 (ADR-011).
- 조회를 위해 `app/api/` 라우트를 만들지 마라. 이유: ADR-001에서 Server Component 직접 호출을 선택했다.
- Supabase 응답 에러를 `catch {}`로 삼키지 마라. 이유: "데이터 없음"과 "연결 실패"가 구분되지 않는다.
- `services/`를 클래스로 만들지 마라.
- 인증·장바구니·주문 로직을 만들지 마라. 이유: Step 4~7의 범위다.
- 기존 테스트를 깨뜨리지 마라.
