// Step 3 임시 확인용 화면. 스타일링하지 않는다 —
// 여기서 확인하려는 것은 "상품에 판매자 정보까지 붙어서 오는가" 하나뿐이다.
// 제대로 된 상품 목록 UI 는 Step 8(storefront-ui)에서 만든다.
import { listProducts } from '@/services/products'

export default async function Home() {
  const products = await listProducts()

  return (
    <main>
      <h1>ShopMate</h1>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            {product.name} — {product.seller.storeName} — {product.price}원 — 재고 {product.stock}
          </li>
        ))}
      </ul>
    </main>
  )
}
