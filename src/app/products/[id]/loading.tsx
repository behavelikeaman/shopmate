// 상품 상세 로딩.
import { SkeletonBlock } from '@/components/Skeleton'

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <SkeletonBlock className="aspect-square" />
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-6 w-2/3" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-6 w-32" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-11 w-full" />
        </div>
      </div>
    </main>
  )
}
