// ══════════════════════════════════════════════════════════════
// [부품] 사이트 맨 아래 꼬리말
// 저작권 한 줄뿐이다. 링크 목록을 만들지 않는다.
// ══════════════════════════════════════════════════════════════

// 푸터. 한 줄 저작권 표기뿐이다 — 링크 목록을 만들지 않는다 (UI_GUIDE, 지시서 5).
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-xs text-neutral-500">© {new Date().getFullYear()} ShopMate</p>
      </div>
    </footer>
  )
}
