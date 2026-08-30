// 로딩 자리표시자. 스피너를 쓰지 않는다 (UI_GUIDE) —
// 회색 블록이 실제로 들어올 내용의 자리를 잡아주므로 화면이 튀지 않는다.
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-neutral-100 ${className}`} />
}
