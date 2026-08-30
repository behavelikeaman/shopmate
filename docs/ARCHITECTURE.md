# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── page.tsx              # 상품 목록
│   ├── products/[id]/        # 상품 상세
│   ├── cart/                 # 장바구니
│   ├── checkout/             # 체크아웃
│   ├── orders/               # 주문 내역
│   ├── login/, signup/       # 인증
│   ├── admin/                # 관리자 (products, orders)
│   └── api/                  # 라우트 핸들러 (auth 콜백 등 꼭 필요한 것만)
├── components/               # UI 컴포넌트
├── types/                    # TypeScript 타입 정의 (DB row 타입 포함)
├── lib/                      # 순수 함수 + 헬퍼 (TDD 대상)
└── services/                 # Supabase 래퍼 (평범한 async 함수)

supabase/
└── migrations/               # 스키마 + RLS 정책 SQL (버전 관리)
```

## 패턴
- **Server Components 기본.** 데이터 조회는 Server Component가 `services/` 함수를 직접 `await` 한다. 조회용 API 라우트를 만들지 않는다.
- **변경은 Server Action.** 장바구니 담기, 주문 생성, 상품 CRUD는 `"use server"` 액션에서 처리하고 `revalidatePath`로 갱신한다.
- **API 라우트는 예외적으로만.** Supabase Auth 콜백처럼 HTTP 엔드포인트가 반드시 필요한 경우에만 `app/api/`에 둔다.
- **Client Component는 인터랙션이 있는 곳만.** 수량 스테퍼, 검색 입력, 비로그인 장바구니 등.

## Supabase 클라이언트 3종
| 이름 | 키 | RLS | 쓰는 곳 |
|------|-----|-----|---------|
| 브라우저 클라이언트 | anon | 적용됨 | Client Component (세션 읽기 정도) |
| 서버 클라이언트 | anon + 쿠키 세션 | 적용됨 (사용자 권한) | Server Component, Server Action 기본값 |
| 관리자 클라이언트 | service_role | **우회** | 재고 차감처럼 RLS로 표현 못 하는 서버 전용 작업만 |

관리자 클라이언트는 `services/` 안에서만 생성한다. 클라이언트 번들에 들어가면 DB 전체가 열린다.

## 데이터 흐름
```
[조회]
사용자 → Server Component → services/products.ts → Supabase(anon+세션, RLS) → 렌더

[변경]
사용자 → Client Component → Server Action → services/*.ts → Supabase → revalidatePath → 재렌더

[주문 생성]
Server Action
  → 서버가 DB에서 현재 가격·재고를 다시 읽음   ← 클라이언트가 보낸 금액은 버린다
  → lib/pricing.ts 로 합계 재계산
  → 재고 확인 → orders + order_items INSERT (가격 스냅샷) → 재고 차감
  → 실패 시 전체 실패 (부분 주문 금지)
```

## 데이터 모델
```
profiles(id → auth.users, role: 'customer'|'admin', created_at)
products(id, name, description, price, image_url, category, stock, created_at)
carts(id, user_id → auth.users UNIQUE, created_at)
cart_items(id, cart_id → carts, product_id → products, quantity)   -- UNIQUE(cart_id, product_id)
orders(id, user_id → auth.users, status, subtotal, shipping_fee, total_amount,
       shipping_name, shipping_phone, shipping_address, created_at)
order_items(id, order_id → orders, product_id, name_snapshot, unit_price, quantity)
```
- 통화는 KRW 하나뿐이다. 금액은 **원 단위 정수(`integer`)** 로만 저장한다 (`price`, `unit_price`, `subtotal`, `shipping_fee`, `total_amount`). 소수점·부동소수 금액 금지 (ADR-005).
- `orders.status`: `'paid' | 'shipped' | 'cancelled'` (결제는 모의이므로 생성 즉시 `paid`).
- `order_items`는 상품명·단가를 스냅샷으로 갖는다. 상품이 나중에 바뀌거나 삭제돼도 주문 내역은 그대로 남는다.
- 배송비 규칙: 소계 50,000원 이상이면 0원, 미만이면 3,000원. 규칙 자체는 `lib/pricing.ts`에 있고 주문에는 계산 결과를 저장한다.

## 상태 관리
- 서버 상태는 Server Component + `revalidatePath`. React Query 같은 클라이언트 캐시 계층을 두지 않는다.
- 클라이언트 상태는 `useState` / `useReducer`.
- 비로그인 장바구니만 `localStorage`에 둔다. 로그인 시 서버 장바구니와 병합하고 로컬은 비운다.
