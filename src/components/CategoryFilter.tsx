// 카테고리 칩. 링크다 — 클릭하면 URL 이 바뀌고 서버가 다시 필터링한다.
// 클라이언트 상태로 거르지 않는 이유: 그러면 필터 결과를 링크로 공유할 수 없다 (ADR-001).
import Link from 'next/link'

const CHIP_BASE = 'inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors'
const CHIP_ON = 'border-neutral-900 text-neutral-900'
const CHIP_OFF = 'border-neutral-200 text-neutral-500 hover:border-neutral-400'

/** 검색어(q)는 유지한 채 카테고리만 바꾼다. 두 조건은 함께 걸릴 수 있어야 한다. */
function hrefFor(category: string | null, query: string): string {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (query) params.set('q', query)
  const search = params.toString()
  return search ? `/?${search}` : '/'
}

export function CategoryFilter({
  categories,
  selected,
  query,
}: {
  categories: string[]
  selected: string
  query: string
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      <Link className={`${CHIP_BASE} ${selected ? CHIP_OFF : CHIP_ON}`} href={hrefFor(null, query)}>
        전체
      </Link>
      {categories.map((category) => (
        <Link
          className={`${CHIP_BASE} ${category === selected ? CHIP_ON : CHIP_OFF}`}
          href={hrefFor(category, query)}
          key={category}
        >
          {category}
        </Link>
      ))}
    </nav>
  )
}
