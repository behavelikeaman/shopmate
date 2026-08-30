# Step 8: storefront-ui

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — **이 step의 주 사양이다. 원칙·색상·컴포넌트·안티패턴을 전부 따른다.**
- `/docs/PRD.md` — 화면 표, 재고 규칙, 디자인 절
- `/docs/ARCHITECTURE.md` — 패턴 (Server Component 기본)
- `/CLAUDE.md`
- `/src/lib/pricing.ts`, `/src/lib/order-status.ts`
- `/src/services/products.ts`, `/src/services/cart.ts`, `/src/services/orders.ts`
- `/src/app/` 하위의 이미 만들어진 페이지들 — **스타일만 입힌다**
- `/src/components/`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

기능 위주로 만든 고객 화면을 UI_GUIDE에 맞춰 완성한다. **동작을 바꾸지 말고 표현을 완성하는 step이다.**

### 1. 상품 목록 `src/app/page.tsx`

- Server Component. `searchParams`의 `category`·`q`를 `listProducts()`에 넘긴다.
- 카테고리 필터: `listCategories()` 결과를 칩으로. 선택된 칩은 `border-neutral-900`.
- 검색: 제출하면 URL 쿼리가 바뀌는 GET 폼. **클라이언트 상태로 필터링하지 마라** — 서버가 필터링한다.
- 그리드: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`.
- **순서는 등록순 그대로.** 품절을 뒤로 밀지 마라 (PRD).
- 결과가 없으면 빈 상태 문구 + 필터 초기화 링크.

### 2. `src/components/ProductCard.tsx`

- UI_GUIDE의 상품 카드 클래스를 쓴다.
- 이미지가 없거나 로드 실패면 `bg-neutral-100` 플레이스홀더. 깨진 이미지 아이콘이 보이면 안 된다.
- **스토어명을 카드에 보조 텍스트로 표시한다** (마켓플레이스이므로 누가 파는지가 정보다).
- `stock === 0`이면 "품절" 뱃지. 카드 전체를 흐리게 하지는 않는다(상세는 볼 수 있어야 한다).
- 가격은 `formatPrice()` + `tabular-nums`.

### 3. 상품 상세 `src/app/products/[id]/page.tsx`

- 좌: 이미지(`aspect-square`), 우: 카테고리 / 상품명 / **스토어명** / 가격 / 재고 상태 / 설명 / 수량 스테퍼 + 담기.
- 없는 id면 `notFound()`.
- 품절이면 담기 버튼 `disabled` + "품절" 문구. 이유를 숨기지 마라.
- 담기 성공 시 화면 이동 없이 "장바구니에 담았습니다 · 장바구니 보기" 인라인 피드백. **토스트 라이브러리를 설치하지 마라.**

### 4. 장바구니 · 체크아웃 · 주문내역 스타일 완성

**판매자 그룹 블록**(UI_GUIDE)을 공용 컴포넌트로 만들어 세 화면에서 함께 쓴다.

- `src/components/SellerGroupBlock.tsx` — 헤더(스토어명 + 선택적 상태 뱃지), 품목 슬롯, 푸터(소계 / 배송비 / 선택적 무료배송 안내).
- `src/components/OrderStatusBadge.tsx` — `statusLabel()`을 쓰고 UI_GUIDE "주문 상태" 표의 스타일을 그대로 적용. **알약 모양으로 만들지 말고, 색으로만 구분하지 마라.**
- 장바구니: 품목 행(썸네일·상품명·단가·수량 스테퍼·소계·삭제), 그룹 푸터에 무료배송까지 남은 금액. 전체 요약은 그룹 밖.
- 체크아웃: `max-w-3xl`, 그룹 요약 + 배송지 폼. 필드 에러는 필드 아래 `text-[#b91c1c]` 한 줄.
- 주문내역: 주문 카드 목록(날짜·총액·그룹별 스토어명과 상태 뱃지).
- 주문 상세: 그룹 블록 + 상태 뱃지 + 취소 버튼(Danger Text). 취소된 그룹은 남는다.
- 주문 완료 직후 화면: 주문번호와 총액을 크게, "주문내역 보기" / "쇼핑 계속하기" 두 액션.

**그룹이 하나뿐이어도 같은 구조로 그린다** (UI_GUIDE).

### 5. 레이아웃 · 헤더 · 푸터

- 헤더(Step 4에서 만든 것)를 UI_GUIDE에 맞춰 다듬는다. 장바구니 아이콘 옆에 담긴 개수를 숫자로.
- `layout.tsx`에 `metadata`(title "ShopMate", description)를 채운다.
- 푸터는 한 줄 저작권 표기 정도. 링크 목록을 만들지 마라.

### 6. 로딩 · 에러

- 상품 목록·상세·주문내역에 `loading.tsx`를 두고 UI_GUIDE의 스켈레톤(`bg-neutral-100` 블록)을 쓴다. **스피너 금지.**
- `error.tsx`로 렌더 실패 시 한 줄 메시지 + 재시도 버튼.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test
```

수동 검증 (사람이 수행):
```bash
npm run dev
# 1. 목록 → 필터 → 검색 → 상세 → 담기 → 장바구니 → 체크아웃 → 주문완료 → 주문내역 → 취소
#    전 경로를 클릭으로 통과할 수 있다
# 2. 브라우저 폭을 375px로 줄여도 레이아웃이 깨지지 않고, 가로 스크롤이 생기지 않는다
# 3. 품절 상품은 담을 수 없고 이유가 화면에 보인다
# 4. 판매자가 2명 이상인 장바구니에서 그룹 경계와 그룹별 배송비가 한눈에 보인다
# 5. 판매자가 1명뿐일 때도 같은 그룹 구조로 보인다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - UI_GUIDE "AI 슬롭 안티패턴" 표의 항목이 하나도 없는가?
     `grep -rn "backdrop-blur\|blur-3xl\|bg-gradient-to\|rounded-2xl" src/`
   - 이모지 아이콘 대신 SVG를 썼는가? 상태를 색으로만 구분하지 않는가?
   - 취소·삭제가 Primary 버튼이 아닌가?
   - 포인트 색이 구매 CTA에만 쓰였는가? 보라/인디고 계열이 없는가?
   - 금액 표시가 전부 `formatPrice()`를 거치는가? 컴포넌트에서 `toLocaleString()`을 직접 부르지 않는가?
   - 새 UI 라이브러리(shadcn, MUI, 아이콘 패키지, 토스트 등)를 설치하지 않았는가?
3. `phases/0-mvp/index.json`의 step 8을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "완성한 화면 목록과 새로 만든 공용 컴포넌트"`
   - 실패 → `"status": "error"` + `error_message` / 개입 필요 → `"status": "blocked"` + `blocked_reason`

## 금지사항

- UI_GUIDE 안티패턴 표에 있는 것을 쓰지 마라 (glass morphism, gradient text, 네온 글로우, 보라 브랜드색, blur-3xl orb, 일괄 rounded-2xl, 이모지 아이콘, 상태를 색으로만 구분, 취소를 Primary로, 그룹을 구분 없이 나열). 이유: 표에 각각 이유가 적혀 있다.
- UI 라이브러리·아이콘 패키지·토스트 라이브러리를 설치하지 마라. 이유: 외부 의존성 최소화가 이 프로젝트의 철학이고, 필요한 아이콘은 3~4개뿐이다.
- 필터링·정렬을 클라이언트 상태로 옮기지 마라. 이유: 서버가 필터링한다는 데이터 흐름이 깨지고, 공유 가능한 URL을 잃는다.
- 품절 상품을 목록에서 숨기거나 뒤로 밀지 마라. 이유: PRD에서 등록순 그대로 노출로 정했다.
- 비즈니스 로직(가격 계산, 그룹핑, 재고 판정, 상태 판정)을 컴포넌트에 새로 쓰지 마라. 이유: `lib/`에 이미 있고, 두 벌이 되면 화면과 청구액이 달라진다.
- Server Action이나 서비스 시그니처를 바꾸지 마라. 이유: 이 step은 표현 계층만 다룬다. 동작 변경이 필요해 보이면 summary에 남기고 넘어가라.
- 판매자 콘솔 화면을 만들지 마라. 이유: Step 9의 범위다.
- 기존 테스트를 깨뜨리지 마라.
