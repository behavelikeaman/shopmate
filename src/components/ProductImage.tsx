'use client'

// ══════════════════════════════════════════════════════════════
// [부품] 상품 사진
// 사진 주소가 깨졌으면 회색 네모로 대신한다. 깨진 이미지 아이콘이 보이면 안 된다.
// 판매자가 아무 주소나 넣을 수 있어서, 미리 허용 목록을 만들 수 없다.
// ══════════════════════════════════════════════════════════════

// 상품 이미지. 이미지는 외부 URL 문자열이라(PRD: 직접 업로드 제외) 언제든 깨질 수 있다.
// 깨진 이미지 아이콘이 카탈로그에 보이면 안 되므로, 실패하면 플레이스홀더로 되돌린다.
// 그 판정은 브라우저에서만 할 수 있어서 Client Component 다.
//
// next/image 를 쓰지 않는 이유: 외부 도메인을 next.config 에 미리 등록해야 하는데,
// 판매자가 아무 URL 이나 넣을 수 있는 구조라 등록 목록을 만들 수 없다.
import { useState } from 'react'

export function ProductImage({
  src,
  alt,
  className = '',
}: {
  src: string | null
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const box = `w-full bg-neutral-100 ${className}`

  if (!src || failed) {
    // 빈 회색 박스. 아이콘이나 문구를 넣지 않는다 — 목록에서 반복되면 소음이 된다.
    return <div aria-hidden="true" className={box} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={`${box} object-cover`}
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
    />
  )
}
