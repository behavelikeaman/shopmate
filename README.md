# ShopMate

Harness 프레임워크 기반 온라인 쇼핑몰 실습 프로젝트.
Next.js 15 (App Router) + TypeScript(strict) + Tailwind CSS + Supabase.

기획·설계 문서는 [`docs/`](docs/)에 있다 — [PRD](docs/PRD.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [ADR](docs/ADR.md) · [UI_GUIDE](docs/UI_GUIDE.md).
프로젝트 규칙은 [`CLAUDE.md`](CLAUDE.md), 하네스 워크플로우는 [`.claude/commands/harness.md`](.claude/commands/harness.md).

> **현재 상태**: 기획 문서와 하네스 실행 인프라만 있고 애플리케이션 코드는 아직 없다.
> `phases/0-mvp/step0.md`(project-setup)를 실행하면 Next.js 골격이 생긴다.

---

## 다른 PC에서 시작하기

### 1. 사전 준비물
| 필요 | 버전 | 확인 |
|------|------|------|
| Node.js | 22 LTS (`.nvmrc` 참고) | `node -v` |
| npm | Node에 포함 | `npm -v` |
| Python | 3.9+ (하네스 실행기용) | `python3 --version` |
| Git | 아무 최신 버전 | `git --version` |
| Claude Code CLI | 최신 | `claude --version` |

`scripts/execute.py`는 `claude` CLI를 서브프로세스로 호출한다. CLI가 없으면 하네스 자동 실행은 못 하지만, 앱 자체를 돌리는 데는 지장 없다.

### 2. 클론
```bash
git clone https://github.com/behavelikeaman/shopmate.git
cd shopmate
```

### 3. Supabase 프로젝트 연결
1. https://supabase.com 에서 프로젝트를 만든다 (기존 프로젝트가 있으면 재사용).
2. **Project Settings → API** 에서 세 값을 복사한다: Project URL, `anon` public key, `service_role` key.
3. 환경 변수 파일을 만든다:
   ```bash
   cp .env.example .env.local
   ```
   `.env.local`을 열어 복사한 값을 채운다. **이 파일은 `.gitignore`되어 커밋되지 않는다.**
4. 스키마를 적용한다. `supabase/migrations/`의 SQL 파일을 파일명 순서대로 Supabase 대시보드의 **SQL Editor**에 붙여넣고 실행한다.
   (Supabase CLI를 쓴다면 `supabase db push`.)

> 무료 티어 프로젝트는 일정 기간 미사용 시 일시정지된다. 오랜만에 다른 PC에서 열었는데 접속이 안 되면 대시보드에서 프로젝트를 다시 활성화한다.

### 4. 설치 & 실행
```bash
npm install
npm run dev     # http://localhost:3000
```
> `package.json`이 아직 없다면 step0을 먼저 실행해야 한다 (아래 참고).

### 5. 계정 준비
**판매자**는 가입 화면에서 "판매자로 가입"을 선택하면 된다 (스토어명 필요).
가입하면 바로 `/seller/products`(판매자 콘솔)에 들어갈 수 있다. 이미 일반 회원으로 가입했다면
가입 화면을 다시 쓰지 말고 SQL Editor에서 역할만 바꾼다 — 스스로 권한을 올리는 화면은 없다 (ADR-008):
```sql
update profiles set role = 'seller'
where id = (select id from auth.users where email = '내이메일@example.com');

-- 스토어명은 seller_profiles에 따로 있다 (ADR-011). 없으면 판매자명이 비어 보인다.
insert into seller_profiles (id, store_name)
select id, '내 스토어 이름' from auth.users where email = '내이메일@example.com'
on conflict (id) do update set store_name = excluded.store_name;
```

**운영자(admin)**는 회원가입 UI로 만들 수 없다 (ADR-008). 앱에서 이메일로 가입한 뒤 SQL Editor에서 승격한다:
```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = '내이메일@example.com');
```
운영자는 전용 화면 없이 판매자 콘솔에서 전체를 보게 된다 (ADR-016).

**시드 데이터**는 판매자 uuid가 필요하다. 판매자 계정을 먼저 가입시킨 뒤,
`supabase/migrations/0003_seed.sql` 상단의 uuid 상수를 실제 값으로 채우고 실행한다.

---

## 하네스 워크플로우

### 대화형
Claude Code 세션에서 `/harness`를 실행하면 탐색 → 논의 → step 설계 → 파일 생성 워크플로우로 들어간다.
변경 사항 리뷰는 `/review`.

### 자동 실행
```bash
python3 scripts/execute.py 0-mvp          # phases/0-mvp의 step들을 순차 실행
python3 scripts/execute.py 0-mvp --push   # 실행 후 push
```

`execute.py`가 자동으로 처리하는 것:
- `feat-{task-name}` 브랜치 생성/checkout
- 가드레일 주입 — `CLAUDE.md` + `docs/*.md`를 매 step 프롬프트에 포함
- 컨텍스트 누적 — 완료된 step의 `summary`를 다음 step에 전달
- 자가 교정 — 실패 시 최대 3회 재시도 (이전 에러 메시지를 피드백)
- 2단계 커밋 — 코드 변경(`feat`)과 메타데이터(`chore`) 분리
- 타임스탬프 자동 기록

### 하네스 실행기 자체 테스트 (선택)
```bash
pip install pytest
python3 -m pytest scripts/test_execute.py -q   # 51 passed
```
`execute.py`를 고칠 일이 있을 때만 필요하다. 앱 개발에는 쓰지 않는다.

### 진행 상황 확인
```bash
cat phases/index.json                     # 전체 task 현황
cat phases/0-mvp/index.json               # step별 status + summary
```

### 중단된 step 재개
- `status: "error"` → 해당 step의 `status`를 `"pending"`으로 바꾸고 `error_message`를 지운 뒤 재실행.
- `status: "blocked"` → `blocked_reason`을 해결한 뒤 동일하게 되돌리고 재실행.

**PC를 옮겨도 이어서 작업할 수 있다.** 진행 상태는 전부 `phases/**/index.json`에 커밋되어 있으므로, push 하고 다른 PC에서 pull 하면 그 다음 step부터 이어진다. 옮기기 전에 커밋·푸시하는 것만 잊지 말 것.

---

## 커밋되지 않는 것 (PC마다 다시 만들어야 함)
| 항목 | 복구 방법 |
|------|-----------|
| `.env.local` | `cp .env.example .env.local` 후 Supabase 키 입력 |
| `node_modules/` | `npm install` |
| `.next/` | 자동 생성 |
| Supabase 프로젝트의 실제 데이터 | 스키마는 `supabase/migrations/`로 재현. 시드 데이터는 seed SQL로 재현 |

---

## 명령어
```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (vitest)
```
