// ══════════════════════════════════════════════════════════════
// [화면] 판매자 — 내게 들어온 주문
// 내 상품이 포함된 주문만 보여준다. 같은 주문에 있는 다른 판매자 몫은 아예 안 넘어온다.
// 발송하려면 배송지가 필요하므로, 줄을 누르면 주소와 연락처가 펼쳐진다.
// ══════════════════════════════════════════════════════════════

// 판매자 — 내게 들어온 주문 그룹.
//
// 그룹 하나가 "내가 보낼 건" 하나다. 같은 주문의 다른 판매자 그룹은 여기 나오지 않는다.
// 그 격리는 화면이 아니라 RLS 가 보장한다 (ADR-008).
import { SellerOrderRow } from '@/components/SellerOrderRow'
import { listSellerOrderGroups } from '@/services/orders'

const TH_CLASS =
  'text-left text-xs font-medium text-neutral-500 uppercase tracking-wide border-b border-neutral-200 pb-2'

export default async function SellerOrdersPage() {
  const groups = await listSellerOrderGroups()

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        들어온 주문 {groups.length}건
      </h2>

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-700">아직 들어온 주문이 없습니다.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            품목을 누르면 배송지와 연락처가 펼쳐집니다. 발송 처리한 주문은 취소할 수 없습니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={TH_CLASS}>주문일</th>
                  <th className={TH_CLASS}>받는 분</th>
                  <th className={TH_CLASS}>품목</th>
                  <th className={`${TH_CLASS} text-right`}>금액</th>
                  <th className={TH_CLASS}>상태</th>
                  <th className={TH_CLASS}>동작</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <SellerOrderRow group={group} key={group.id} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
