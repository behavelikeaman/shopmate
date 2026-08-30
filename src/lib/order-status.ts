import type { GroupStatus } from '@/types'

/** 아직 발송되지 않은 그룹만 취소할 수 있다 (ADR-017). 최종 판정은 RPC 의 조건부 UPDATE 가 한다. */
export function canCancelGroup(status: GroupStatus): boolean {
  return status === 'paid'
}

/** 이미 발송·취소된 그룹은 다시 발송 처리할 수 없다. */
export function canShipGroup(status: GroupStatus): boolean {
  return status === 'paid'
}

// 표기 문자열은 docs/UI_GUIDE.md 의 "주문 상태" 표와 일치해야 한다.
const LABELS: Record<GroupStatus, string> = {
  paid: '발송 준비중',
  shipped: '발송 완료',
  cancelled: '취소됨',
}

export function statusLabel(status: GroupStatus): string {
  return LABELS[status]
}
