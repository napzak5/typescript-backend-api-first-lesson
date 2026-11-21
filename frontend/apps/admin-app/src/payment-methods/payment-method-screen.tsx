import { unreadMessageOf } from '@beauty-salon-frontend/answers'
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
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { paymentMethodChangeHrefOf, paymentMethodsHrefOf } from '../navigation'
import { PaymentMethodRecord } from './components/payment-method-record/payment-method-record'
import {
  PaymentMethodNotFound,
  useKeepsPaymentMethods,
} from './keeps-payment-methods'
import { paymentMethodKeyOf, readPaymentMethod } from './payment-methods-api'

const TITLE = '支払い方法の内容'

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
  const keeps = useKeepsPaymentMethods()
  const method = useQuery({
    queryKey: paymentMethodKeyOf(paymentMethodId),
    queryFn: () => readPaymentMethod(salon.id, paymentMethodId),
    staleTime: 0,
  })
  const header = <PageHeader title={TITLE} description={salon.name} />

  return match(method.data)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label='支払い方法を読み込んでいます' />
      </>
    ))
    .with({ type: 'notFound' }, () => <PaymentMethodNotFound salon={salon} />)
    .with({ type: 'forbidden' }, () => (
      <>
        {header}
        <OtherSalonNotice what='支払い方法' />
      </>
    ))
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={unreadMessageOf('支払い方法', reason)}
          onRetry={() => void method.refetch()}
          pending={method.isFetching}
        />
      </>
    ))
    .with({ type: 'found' }, (found) => (
      <>
        <PageHeader
          title={TITLE}
          description={salon.name}
          actions={
            keeps ? (
              <ButtonLink
                href={paymentMethodChangeHrefOf(salon.id, found.method.id)}
                variant='primary'
              >
                支払い方法を直す
              </ButtonLink>
            ) : undefined
          }
        />
        <PaymentMethodRecord method={found.method} currency={salon.currency} />
        <ButtonLink href={paymentMethodsHrefOf(salon.id)}>
          支払い方法へ
        </ButtonLink>
      </>
    ))
    .exhaustive()
}

/** A payment method of the salon of the address, for everybody who works there and an administrator. */
export const PaymentMethodScreen = () => {
  const { salonId = '', paymentMethodId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
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
