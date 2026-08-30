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

## 사용자와 대화하는 방식
프로젝트 소유자는 비개발자다. 사용자에게 보내는 설명(터미널 회신, step summary, 문서)은 아래를 따른다.
코드 주석이나 커밋 메시지에는 적용하지 않는다.

- **전문용어는 쓰기 전에 한 줄로 풀어준다.** "RLS" 대신 "RLS(데이터베이스가 스스로 권한을 검사하는 기능)". 이미 `docs/GLOSSARY.md`에 있는 용어는 그 문서를 가리켜도 된다.
- **표와 짧은 문장으로 쓴다.** 긴 문단을 늘어놓지 않는다. 스캔해서 읽을 수 있어야 한다.
- **결론을 먼저, 이유를 뒤에.** "무엇을 하면 되는지"가 맨 위에 온다.
- **선택지를 줄 때는 추천을 함께 준다.** 나열만 하고 끝내지 않는다.
- **사람이 직접 해야 하는 일은 눈에 띄게 표시한다.** 어디서(웹/터미널) 하는지도 적는다.
- 문제를 보고할 때는 "무엇이 잘못됐나 → 그래서 무슨 일이 생기나 → 어떻게 할까" 순서로 적는다.

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (vitest)
