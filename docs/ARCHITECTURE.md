# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── page.tsx              # 상품 목록
│   ├── products/[id]/        # 상품 상세
│   ├── cart/                 # 장바구니
│   ├── checkout/             # 체크아웃
│   ├── orders/               # 주문 목록
│   │   └── [id]/             # 주문 상세 (그룹별 상태·취소)
│   ├── login/, signup/       # 인증
│   ├── seller/               # 판매자 콘솔 (products, orders)
│   └── api/                  # 라우트 핸들러 (auth 콜백 등 꼭 필요한 것만)
├── components/               # UI 컴포넌트
├── types/                    # TypeScript 타입 정의
├── lib/                      # 순수 함수 + 헬퍼 (TDD 대상)
└── services/                 # Supabase 래퍼 (평범한 async 함수)

supabase/
└── migrations/               # 스키마 + RLS 정책 + RPC SQL (버전 관리)
```

## 패턴
- **Server Components 기본.** 데이터 조회는 Server Component가 `services/` 함수를 직접 `await` 한다. 조회용 API 라우트를 만들지 않는다.
- **변경은 Server Action.** 장바구니 담기, 주문 생성, 취소, 발송, 상품 CRUD는 `"use server"` 액션에서 처리하고 `revalidatePath`로 갱신한다.
- **API 라우트는 예외적으로만.** Supabase Auth 콜백처럼 HTTP 엔드포인트가 반드시 필요한 경우에만 `app/api/`에 둔다.
- **Client Component는 인터랙션이 있는 곳만.** 수량 스테퍼, 검색 입력, 비로그인 장바구니 등.
- **여러 행을 한 덩어리로 바꾸는 작업은 Postgres 함수(RPC)로 내린다.** 주문 생성과 취소가 여기 해당한다. 애플리케이션 코드에서 쿼리를 여러 번 날리면 중간에 실패했을 때 재고와 주문이 어긋난다.

## Supabase 클라이언트 3종
| 이름 | 키 | RLS | 쓰는 곳 |
|------|-----|-----|---------|
| 브라우저 클라이언트 | anon | 적용됨 | Client Component (세션 읽기 정도) |
| 서버 클라이언트 | anon + 쿠키 세션 | 적용됨 (사용자 권한) | Server Component, Server Action **기본값** |
| 관리자 클라이언트 | service_role | **우회** | RLS로 표현할 수 없는 서버 전용 작업만 |

관리자 클라이언트는 `services/` 안에서만 생성한다. 클라이언트 번들에 들어가면 DB 전체가 열린다.

> 이 프로젝트에서 관리자 클라이언트가 필요한 곳은 사실상 없다. 재고 차감·복구는 RPC(`security definer`) 안에서 일어나므로 호출자는 서버 클라이언트면 충분하다. 관리자 클라이언트를 꺼내 쓰고 싶어지면, 대개 RLS 정책이 틀렸다는 신호다.

## 데이터 모델
```
profiles(id → auth.users, role: 'customer'|'seller'|'admin', created_at)
seller_profiles(id → auth.users, store_name, created_at)

products(id, seller_id → auth.users, name, description, price, image_url,
         category, stock, created_at)

carts(id, user_id → auth.users UNIQUE, created_at)
cart_items(id, cart_id → carts, product_id → products, quantity)  -- UNIQUE(cart_id, product_id)

orders(id, user_id → auth.users,
       shipping_name, shipping_phone, shipping_address, created_at)
order_groups(id, order_id → orders, seller_id → auth.users,
             status: 'paid'|'shipped'|'cancelled',
             subtotal, shipping_fee, created_at, shipped_at, cancelled_at)
order_items(id, group_id → order_groups, product_id → products (on delete set null),
            name_snapshot, unit_price, quantity)
```

### 왜 `profiles`와 `seller_profiles`가 나뉘어 있나
상품 상세에 판매자명을 보여주려면 스토어명이 **누구에게나** 읽혀야 한다. 하지만 `role`은 아무나 읽을 이유가 없다(전체 사용자와 권한을 열거할 수 있게 된다). **RLS는 행 단위라 "이 컬럼만 공개"가 안 되므로**, 공개 컬럼을 별도 테이블로 뺀다.

- `profiles` — 본인만 SELECT.
- `seller_profiles` — 누구나 SELECT, 본인만 UPDATE.

### 왜 `orders`에 총액과 상태가 없나
판매자는 발송을 위해 **자기 그룹이 속한 주문의 배송지를 읽어야 한다.** 그래서 `orders` SELECT 권한이 판매자에게도 열린다. 이때 `orders`에 총액이 있으면 "이 손님이 다른 판매자에게서 얼마를 샀는지"가 새어 나간다.

그래서 `orders`에는 배송지와 주문 시각만 둔다. **주문 총액은 저장하지 않고 그룹들의 합으로 계산한다.** 그룹의 `subtotal`·`shipping_fee`가 이미 스냅샷이므로 합계는 결정적이고, 나중에 값이 흔들리지 않는다.

상태도 마찬가지다. A 판매자는 오늘 보내고 B는 모레 보내므로 주문 전체에 하나의 상태를 붙일 수 없다. `status`는 `order_groups`에만 있다.

### 그 밖의 규칙
- 통화는 KRW 하나뿐이다. 금액은 **원 단위 정수(`integer`)** 로만 저장한다 (`price`, `unit_price`, `subtotal`, `shipping_fee`). 소수점·부동소수 금액 금지 (ADR-005).
- `order_items`는 상품명·단가를 스냅샷으로 갖는다. 상품이 바뀌거나 삭제돼도 주문 내역은 그대로 남는다 (ADR-006). `product_id`는 `on delete set null` — 재고 복구 때만 쓰는 참조다.
- 배송비는 **판매자별**로 계산한다. 그룹 소계가 50,000원 이상이면 0원, 미만이면 3,000원. 규칙은 `lib/pricing.ts`에 있고 주문에는 계산 결과를 저장한다.
- 인덱스: `products(seller_id)`, `products(category)`, `orders(user_id)`, `order_groups(order_id)`, `order_groups(seller_id, status)`, `order_items(group_id)`, `cart_items(cart_id)`.

## 권한 (RLS)
권한은 애플리케이션 코드가 아니라 DB 정책으로 표현한다. 화면 가드는 UI 편의일 뿐이다.

| 테이블 | SELECT | INSERT / UPDATE / DELETE |
|--------|--------|--------------------------|
| `products` | 누구나 (익명 포함) | `seller_id = auth.uid()` 인 판매자, 또는 admin |
| `profiles` | 본인만 | 본인만 UPDATE. **`role` 컬럼은 스스로 바꿀 수 없다** |
| `seller_profiles` | 누구나 | 본인만 |
| `carts`·`cart_items` | 본인 소유만 | 본인 소유만 (`cart_items`는 상위 `carts`로 소유 판정) |
| `orders` | 주문자 본인, **자기 그룹이 속한 주문의 판매자**, admin | INSERT는 RPC 안에서만. UPDATE/DELETE 없음 |
| `order_groups` | 주문자 본인, 그룹의 `seller_id`, admin | `status` UPDATE만: 판매자는 `paid→shipped\|cancelled`, 구매자는 `paid→cancelled`. 그 외 전이 금지 |
| `order_items` | 상위 `order_groups` 권한을 따름 | INSERT는 RPC 안에서만. UPDATE/DELETE 없음 |

- 관리자 판정은 `public.is_admin()` 같은 `security definer` 헬퍼로 감싼다. `profiles` 정책 안에서 `profiles`를 다시 조회하면 무한 재귀가 난다.
- 판매자 격리(`seller_id = auth.uid()`)는 화면이 아니라 이 표가 보장한다. 판매자 콘솔의 쿼리에서 `where seller_id = ...`를 빠뜨려도 남의 데이터가 나오면 안 된다.

## 데이터 흐름
```
[조회]
사용자 → Server Component → services/*.ts → Supabase(anon+세션, RLS) → 렌더

[변경]
사용자 → Client Component → Server Action → services/*.ts → Supabase → revalidatePath → 재렌더
```

### 주문 생성 — `create_order(...)` RPC
```
Server Action (배송지 검증)
  → RPC 진입, 트랜잭션 시작
      1. 서버 장바구니를 읽는다                    ← 클라이언트가 보낸 품목·금액은 전부 버린다
      2. 상품의 현재 가격·재고·seller_id 를 DB에서 다시 읽는다
      3. 재고가 하나라도 부족하면 전체 실패 (부분 주문 금지)
      4. 판매자별로 묶어 그룹 소계·배송비를 계산한다
      5. orders 1행 + order_groups N행 + order_items M행 INSERT (이름·단가 스냅샷)
      6. 재고 차감:
         update products set stock = stock - $n where id = $id and stock >= $n
         영향 행이 0이면 예외 → 전체 롤백
      7. 장바구니를 비운다
  → 커밋. status 는 생성 시점에 'paid' (모의 결제, ADR-003)
```
4번의 그룹핑·배송비 계산 **규칙**은 `lib/pricing.ts`에도 있다(화면 표시용). SQL과 TypeScript 두 곳에 같은 규칙이 존재하므로, 임계값(50,000원)과 배송비(3,000원)는 양쪽에서 상수로 분리하고 값이 어긋나면 안 된다.

### 주문 취소 — `cancel_order_group(group_id)` RPC
```
Server Action (호출자 확인)
  → RPC 진입, 트랜잭션 시작
      1. update order_groups set status='cancelled', cancelled_at=now()
         where id = $1 and status = 'paid'                ← 조건부. 멱등성의 핵심
         영향 행이 0이면 → 이미 취소됐거나 발송됨. 아무것도 하지 않고 실패 반환
      2. 그 그룹의 order_items 수량만큼 products.stock 을 되돌린다
         product_id 가 NULL(삭제된 상품)이면 건너뛴다
  → 커밋
```
1번을 `select`로 상태를 확인한 뒤 `update`하면, 동시에 두 번 취소 요청이 들어왔을 때 재고가 두 배로 복구된다. **반드시 조건부 UPDATE의 영향 행 수로 판정한다.**

호출자 검증(구매자 본인인가, 그 그룹의 판매자인가)은 RLS가 하지만, Server Action에서도 한 번 더 확인해 사용자에게 의미 있는 메시지를 준다.

## 상태 관리
- 서버 상태는 Server Component + `revalidatePath`. React Query 같은 클라이언트 캐시 계층을 두지 않는다.
- 클라이언트 상태는 `useState` / `useReducer`.
- 비로그인 장바구니만 `localStorage`에 둔다. 로그인 시 서버 장바구니와 병합하고 로컬은 비운다 (ADR-007).
