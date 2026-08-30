// ══════════════════════════════════════════════════════════════
// [화면] 상품 목록 로딩 표시
// 데이터를 기다리는 동안 회색 네모로 자리를 잡아둔다. 빙글빙글 도는 표시는 쓰지 않는다.
// ══════════════════════════════════════════════════════════════

// 상품 목록 로딩. 카드 그리드와 같은 자리를 잡아둔다.
import { SkeletonBlock } from '@/components/Skeleton'

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="space-y-4">
        <SkeletonBlock className="h-8 w-24" />
        <SkeletonBlock className="h-9 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="space-y-2" key={index}>
            <SkeletonBlock className="aspect-square" />
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </main>
  )
}
