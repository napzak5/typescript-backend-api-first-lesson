import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { purchaseOrdersHrefOf } from '../navigation'

/** The way back to the orders of the salon */
export const ToTheOrders = ({ salonId }: { salonId: string }) => (
  <p>
    <ButtonLink href={purchaseOrdersHrefOf(salonId)} variant='secondary'>
      発注へ
    </ButtonLink>
  </p>
)

/** What a screen of a purchase order says when there is none to show: none at the address, or one of another salon. */
export const OrderNotFound = ({ salonId }: { salonId: string }) => (
  <>
    <PageHeader
      title='発注が見つかりません'
      description='アドレスが正しいか、お確かめください。'
    />
    <ToTheOrders salonId={salonId} />
  </>
)
