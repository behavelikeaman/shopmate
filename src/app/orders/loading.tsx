// 주문 내역 로딩. 주문 카드 자리를 잡아둔다.
import { SkeletonBlock } from '@/components/Skeleton'

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <SkeletonBlock className="h-8 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonBlock className="h-32 w-full" key={index} />
        ))}
      </div>
    </main>
  )
}
