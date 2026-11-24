import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { paymentMethodsHrefOf } from '../../navigation'
import { mayKeepPaymentMethods } from '../api/payment-methods-api'

const { keepers, notFound, words } = adminPaymentMethodMessages

/** Whether the signed-in account has a role that keeps the payment methods: the owner, a manager and an administrator. */
export const useKeepsPaymentMethods = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepPaymentMethods(session.user.role)
}

type PaymentMethodsForbiddenProps = {
  salon: ModelsSalonResponse
  title: LocalizedText
}

/** What a screen that changes the payment methods says to an account whose role does not change them. */
export const PaymentMethodsForbidden = ({
  salon,
  title,
}: PaymentMethodsForbiddenProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(title)} description={salon.name} />
      <p>{say(keepers.forbidden)}</p>
      <ButtonLink href={paymentMethodsHrefOf(salon.id)}>
        {say(keepers.back)}
      </ButtonLink>
    </>
  )
}

/** What a screen of a payment method says when there is none to show. */
export const PaymentMethodNotFound = ({
  salon,
}: {
  salon: ModelsSalonResponse
}) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ButtonLink href={paymentMethodsHrefOf(salon.id)}>
        {say(words.toMethods)}
      </ButtonLink>
    </>
  )
}
