# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md` (디렉토리 구조 절)
- `/docs/ADR.md`
- `/CLAUDE.md`
- `/.env.example` (필요한 환경 변수 확인)
- `/.gitignore` (이미 `.env*.local` 무시 규칙이 들어 있음 — 절대 덮어쓰지 마라)

## 작업

이 저장소(프로젝트 루트)에 **Next.js 15 (App Router) + TypeScript(strict) + Tailwind CSS** 프로젝트를 초기화하라.

요구사항:

1. `ARCHITECTURE.md`의 디렉토리 구조대로 `src/` 디렉토리 기반(`--src-dir`)으로 구성한다. import alias는 `@/*`를 사용한다.
2. 산출물:
   - `package.json` (scripts: `dev`, `build`, `start`, `lint`. `test`는 Step 2에서 추가하므로 지금은 없어도 된다)
   - `tsconfig.json` (`"strict": true`)
   - `next.config`, `postcss.config`, `eslint` 설정 (Tailwind v4는 별도 `tailwind.config`가 없어도 된다)
   - `src/app/layout.tsx`, `src/app/globals.css` (Tailwind 지시문 포함)
   - `src/app/page.tsx` — 지금은 "ShopMate" 제목만 띄우는 최소 플레이스홀더 (실제 상품 목록 UI는 Step 7)
3. `src/` 하위에 빈 디렉토리를 미리 만들 필요는 없다. 이후 step에서 파일 생성 시 만들면 된다.

**기존 파일 보존 (CRITICAL)**: 이 디렉토리에는 이미 `docs/`, `scripts/`, `.claude/`, `supabase/`, `phases/`, `CLAUDE.md`, `README.md`, `docs/GLOSSARY.md`, `.gitignore`, `.env.example`, `.nvmrc`가 존재한다. `create-next-app`은 비어 있지 않은 디렉토리에서 충돌하거나 기존 파일을 덮어쓸 수 있다. 따라서:

- 비대화형으로 실행하라 (프롬프트가 뜨면 실행이 멈춘다). 예: `npx create-next-app@latest <임시경로> --typescript --tailwind --app --src-dir --eslint --use-npm --import-alias "@/*" --no-turbopack` 후 생성된 설정/소스 파일만 루트로 옮기는 방식, 또는 동등한 수동 구성.
- 위 기존 파일들을 **덮어쓰거나 삭제하지 마라.** 특히 `.gitignore`는 `.env*.local` 무시 규칙을 반드시 보존해야 한다 (덮어쓰면 키 유출). `create-next-app`이 생성한 `.gitignore`와 병합이 필요하면 기존 규칙을 유지한 채 합쳐라. `README.md`도 덮어쓰지 마라.

## Acceptance Criteria

```bash
npm install
npm run build   # 컴파일·빌드 에러 없음
npm run lint    # lint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/app/` 구조가 ARCHITECTURE.md와 일치하는가?
   - TypeScript strict mode가 켜져 있는가?
   - 기존 `docs/`, `scripts/`, `.claude/`, `supabase/`, `phases/`, `README.md`, `.env.example`, `.gitignore`가 그대로 보존되었는가?
   - `.gitignore`에 `.env*.local`이 여전히 들어 있는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약 (생성된 설정·진입 파일 경로 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `.gitignore`의 `.env*.local` 규칙을 제거하지 마라. 이유: `.env.local`의 실제 Supabase service_role 키가 커밋되어 DB 전체가 열린다.
- `docs/`, `scripts/`, `.claude/`, `supabase/`, `phases/`, `CLAUDE.md`, `README.md`, `.env.example`을 덮어쓰거나 삭제하지 마라. 이유: 프로젝트 기획·실행 인프라가 사라진다.
- 인터랙티브(대화형) 명령을 쓰지 마라. 이유: execute.py 자동 실행 환경에서 입력 프롬프트가 뜨면 멈춘다.
- Supabase 패키지를 설치하지 마라. 이유: Step 3의 범위다.
- 실제 UI·컴포넌트·서비스·Server Action을 만들지 마라. 이유: 각각 Step 2~8의 범위다. 이 step은 부팅 가능한 빈 골격까지만.
