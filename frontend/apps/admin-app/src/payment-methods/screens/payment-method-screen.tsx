import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  paymentMethodChangeHrefOf,
  paymentMethodsHrefOf,
} from '../../navigation'
import {
  paymentMethodKeyOf,
  readPaymentMethod,
} from '../api/payment-methods-api'
import { PaymentMethodRecord } from '../components/payment-method-record/payment-method-record'
import {
  PaymentMethodNotFound,
  useKeepsPaymentMethods,
} from './keeps-payment-methods'

const { loading, names, titles, words } = adminPaymentMethodMessages

type PaymentMethodPartProps = {
  salon: ModelsSalonResponse
  paymentMethodId: string
}

/**
 * A payment method of the salon, read whenever the screen opens. An
 * account that keeps the payment methods is offered to change it.
 */
const PaymentMethodPart = ({
  salon,
  paymentMethodId,
}: PaymentMethodPartProps) => {
  const say = useSay()
  const keeps = useKeepsPaymentMethods()
  const method = useQuery({
    queryKey: paymentMethodKeyOf(paymentMethodId),
    queryFn: () => readPaymentMethod(salon.id, paymentMethodId),
    staleTime: 0,
  })
  const header = (
    <PageHeader title={say(titles.method)} description={salon.name} />
  )

  return match(method.data)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label={say(loading.method)} />
      </>
    ))
    .with({ type: 'notFound' }, () => <PaymentMethodNotFound salon={salon} />)
    .with({ type: 'forbidden' }, () => (
      <>
        {header}
        <OtherSalonNotice what={names.methodsOfTheSalon} />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={say(unreadMessageOf(names.method, reason))}
          onRetry={() => void method.refetch()}
          pending={method.isFetching}
        />
      </>
    ))
    .with({ type: 'found' }, (found) => (
      <>
        <PageHeader
          title={say(titles.method)}
          description={salon.name}
          actions={
            keeps ? (
              <ButtonLink
                href={paymentMethodChangeHrefOf(salon.id, found.method.id)}
                variant='primary'
              >
                {say(titles.change)}
              </ButtonLink>
            ) : undefined
          }
        />
        <PaymentMethodRecord method={found.method} currency={salon.currency} />
        <ButtonLink href={paymentMethodsHrefOf(salon.id)}>
          {say(words.toMethods)}
        </ButtonLink>
      </>
    ))
    .exhaustive()
}

/** A payment method of the salon of the address, for everybody who works there and an administrator. */
export const PaymentMethodScreen = () => {
  const say = useSay()
  const { salonId = '', paymentMethodId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.method)}>
      {(salon) => (
        <PaymentMethodPart
          key={paymentMethodId}
          salon={salon}
          paymentMethodId={paymentMethodId}
        />
      )}
    </WithSalon>
  )
}
