// 이름 검색. 제출하면 URL 쿼리가 바뀌는 평범한 GET 폼이다.
// 입력할 때마다 클라이언트에서 거르지 않는다 — 필터링은 서버가 한다 (ADR-001).
function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="6.25" />
      <path d="M15.5 15.5 21 21" strokeLinecap="round" />
    </svg>
  )
}

export function SearchForm({ query, category }: { query: string; category: string }) {
  return (
    <form action="/" className="flex gap-2" method="get">
      {/* 검색해도 보고 있던 카테고리는 유지된다. */}
      {category && <input name="category" type="hidden" value={category} />}

      <label className="sr-only" htmlFor="q">
        상품 이름 검색
      </label>
      <input
        className="w-full max-w-xs rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
        defaultValue={query}
        id="q"
        name="q"
        placeholder="상품 이름 검색"
        type="search"
      />
      <button
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
        type="submit"
      >
        <SearchIcon />
        검색
      </button>
    </form>
  )
}
