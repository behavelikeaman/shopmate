// 앱 전역에서 쓰는 공유 타입.
// DB는 snake_case, 여기 타입은 camelCase다. 변환은 services/ 가 담당한다.

export type Role = 'customer' | 'seller' | 'admin'
export type GroupStatus = 'paid' | 'shipped' | 'cancelled'

/** 공개 판매자 정보. role 은 여기 없다 (ADR-011). */
export type Seller = {
  id: string
  storeName: string
}

export type Product = {
  id: string
  name: string
  description: string | null
  /** 원 단위 정수 (ADR-005) */
  price: number
  imageUrl: string | null
  category: string
  stock: number
  createdAt: string
  seller: Seller
}

/** 저장·전송용 최소 단위. localStorage 와 서버 장바구니가 공유하는 모양이다. */
export type CartLine = {
  productId: string
  quantity: number
}

/** 화면에 그릴 때 쓰는, 상품 정보가 붙은 장바구니 줄. */
export type CartLineView = CartLine & {
  product: Product
}

/** 판매자별 묶음. 배송비는 이 단위로 계산한다 (ADR-012). */
export type SellerGroup = {
  seller: Seller
  lines: CartLineView[]
  subtotal: number
  shippingFee: number
}

export type CartTotals = {
  subtotal: number
  shippingTotal: number
  total: number
}

export type ShippingInfo = {
  name: string
  phone: string
  address: string
}

/** 주문 당시의 상품명·단가 스냅샷 (ADR-006). 상품이 삭제되면 productId 는 null 이 된다. */
export type OrderItem = {
  id: string
  productId: string | null
  nameSnapshot: string
  unitPrice: number
  quantity: number
}

export type OrderGroup = {
  id: string
  seller: Seller
  status: GroupStatus
  subtotal: number
  shippingFee: number
  items: OrderItem[]
  shippedAt: string | null
  cancelledAt: string | null
}

/**
 * 주문. totalAmount 필드를 두지 않는다 (ADR-010) —
 * 총액은 groups 의 subtotal + shippingFee 합으로 계산한다.
 */
export type Order = {
  id: string
  shipping: ShippingInfo
  createdAt: string
  groups: OrderGroup[]
}
