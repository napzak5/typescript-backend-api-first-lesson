import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { purchaseOrdersHrefOf } from '../../navigation'

const { notFound, words } = adminPurchaseOrderMessages

/** The way back to the orders of the salon */
export const ToTheOrders = ({ salonId }: { salonId: string }) => {
  const say = useSay()

  return (
    <ButtonLink href={purchaseOrdersHrefOf(salonId)}>
      {say(words.toOrders)}
    </ButtonLink>
  )
}

/** What a screen of a purchase order says when there is none to show: none at the address, or one of another salon. */
export const OrderNotFound = ({ salonId }: { salonId: string }) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ToTheOrders salonId={salonId} />
    </>
  )
}
