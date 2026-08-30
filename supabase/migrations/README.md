# 마이그레이션

Step 1(`phases/0-mvp/step1.md`)에서 아래 파일들이 생성된다:

- `0001_schema.sql` — 테이블 + 인덱스 + 가입 시 profiles 생성 트리거
- `0002_rls.sql` — RLS 활성화 + 정책
- `0003_seed.sql` — 실습용 시드 상품

## 다른 PC / 새 Supabase 프로젝트에 적용하는 법

Supabase 대시보드 → **SQL Editor** 에서 파일명 순서대로 붙여넣고 실행한다.
Supabase CLI를 쓴다면 `supabase db push`.

모든 마이그레이션은 재실행 가능하게 작성한다 (`create table if not exists`,
`drop policy if exists ...; create policy ...`, 시드는 고정 uuid + `on conflict do nothing`).
그래야 다른 PC에서 다시 붙여넣어도 깨지지 않는다.

DB 스키마를 대시보드에서 직접 고치고 끝내지 마라 — 여기에 SQL로 남기지 않으면 다른 PC에서 재현할 수 없다.
