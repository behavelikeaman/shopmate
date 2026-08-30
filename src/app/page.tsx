// 상품 목록. Server Component 다 — 카테고리·검색어를 URL 에서 받아 서버가 필터링한다 (ADR-001).
// 정렬은 등록순 그대로이고, 품절 상품도 목록에 남긴다 (PRD 재고 규칙).
import Link from 'next/link'

import { CategoryFilter } from '@/components/CategoryFilter'
import { ProductCard } from '@/components/ProductCard'
import { SearchForm } from '@/components/SearchForm'
import { listCategories, listProducts } from '@/services/products'

/** URL 쿼리는 문자열일 수도, 같은 키가 여러 번일 수도 있다. 첫 값만 쓴다. */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const category = firstValue(params.category).trim()
  const query = firstValue(params.q).trim()

  const [products, categories] = await Promise.all([
    listProducts({ category: category || undefined, query: query || undefined }),
    listCategories(),
  ])

  const filtered = Boolean(category || query)

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-900">상품</h1>
        <CategoryFilter categories={categories} query={query} selected={category} />
        <SearchForm category={category} query={query} />
      </div>

      {products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-neutral-700">조건에 맞는 상품이 없습니다.</p>
          {filtered && (
            <Link
              className="mt-4 inline-block rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm hover:bg-neutral-50"
              href="/"
            >
              필터 초기화
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  )
}
