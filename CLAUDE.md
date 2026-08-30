# 프로젝트: ShopMate — 소규모 판매자용 온라인 쇼핑몰

## 기술 스택
- Next.js 15 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Supabase (Postgres + Auth + Row Level Security)

## 아키텍처 규칙
- CRITICAL: `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만(`services/`, Server Action, 라우트 핸들러) 사용한다. 클라이언트 컴포넌트에서 import하거나 `NEXT_PUBLIC_*` 변수로 노출하지 말 것.
- CRITICAL: 모든 테이블에 RLS를 켜고 정책을 명시한다. RLS 없는 테이블을 만들지 말 것. 브라우저에 나가는 anon 키는 공개값이므로 RLS가 유일한 신뢰 경계다.
- CRITICAL: 금액(단가·수량·합계)은 클라이언트가 보낸 값을 절대 신뢰하지 않는다. 주문 생성 시 서버가 DB의 현재 가격으로 다시 계산한다.
- Supabase 호출은 `services/`의 평범한 `async` 함수로만 감싼다. 클래스/팩토리를 만들지 말고, 한 번만 쓰이는 추상화를 만들지 말 것.
- 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 함수는 `src/lib/`, Supabase 래퍼는 `src/services/`에 둔다.
- 읽기는 Server Component에서, 쓰기는 Server Action에서 처리한다. 클라이언트 컴포넌트는 인터랙션이 필요한 곳에만 쓴다.

## 개발 프로세스
- CRITICAL: `lib/` 순수 함수는 테스트를 먼저 작성하고 통과시킨다 (TDD). `services/`·`components/`·라우트·Server Action은 유닛 테스트 대신 `npm run build` 통과 + 수동 검증으로 대체한다 (근거: docs/ADR.md ADR-004).
- DB 스키마 변경은 `supabase/migrations/`에 SQL 파일로 남긴다. 대시보드에서 직접 고치고 끝내지 말 것 — 다른 PC에서 재현이 불가능해진다.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:, chore:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (vitest)
