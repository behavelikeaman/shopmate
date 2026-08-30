// ══════════════════════════════════════════════════════════════
// [부품] 주문 상태 딱지
// '발송 준비중 / 발송 완료 / 취소됨' 을 글자로 보여준다.
// 색은 거들 뿐이다. 색만으로 구분하면 색을 구별하기 어려운 사람에게 아무 정보가 아니다.
// ══════════════════════════════════════════════════════════════

// 주문 상태 뱃지. 색은 보조 수단이고, 표기 텍스트가 정보를 다 담는다 (UI_GUIDE).
// 알약(pill) 모양으로 만들지 않는다 — 상태는 라벨이지 태그가 아니다.
import { statusLabel } from '@/lib/order-status'
import type { GroupStatus } from '@/types'

const BADGE_BASE = 'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium'

const BADGE_STYLE: Record<GroupStatus, string> = {
  paid: 'bg-neutral-100 text-neutral-700',
  shipped: 'bg-[#eaf3ec] text-[#15803d]',
  cancelled: 'bg-neutral-100 text-neutral-400',
}

export function OrderStatusBadge({ status }: { status: GroupStatus }) {
  return <span className={`${BADGE_BASE} ${BADGE_STYLE[status]}`}>{statusLabel(status)}</span>
}
