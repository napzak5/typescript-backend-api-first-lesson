import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  unreadMessageOf,
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
import {
  paymentMethodEntryHrefOf,
  paymentMethodHrefOf,
  settingsHrefOf,
} from '../navigation'
import { paymentMethodsKeyOf, readPaymentMethods } from '../sales/sales-api'
import { PaymentMethodTable } from './components/payment-method-table/payment-method-table'
import { useKeepsPaymentMethods } from './keeps-payment-methods'

const TITLE = '支払い方法'

type PaymentMethodsPartProps = { salon: ModelsSalonResponse }

/**
 * The payment methods of the salon, read anew whenever the screen opens,
 * those it uses no more among them. An account that keeps them is offered
 * to add one.
 */
const PaymentMethodsPart = ({ salon }: PaymentMethodsPartProps) => {
  const keeps = useKeepsPaymentMethods()
  const methods = useQuery({
    queryKey: paymentMethodsKeyOf(salon.id),
    queryFn: () => readPaymentMethods(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title={TITLE}
        description={salon.name}
        actions={
          keeps ? (
            <ButtonLink
              href={paymentMethodEntryHrefOf(salon.id)}
              variant='primary'
            >
              支払い方法を足す
            </ButtonLink>
          ) : undefined
        }
      />
      {match(methods.isFetchedAfterMount ? methods.data : undefined)
        .with(undefined, () => (
          <LoadingIndicator label='支払い方法を読み込んでいます' />
        ))
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what='支払い方法' />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={unreadMessageOf('支払い方法', reason)}
              onRetry={() => void methods.refetch()}
              pending={methods.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, ({ items }) => (
          <>
            <p>
              売上の画面で支払いを記録するときに選ぶ手段です。使っていない支払い方法は、新しい支払いには選べません。
            </p>
            <PaymentMethodTable
              methods={items}
              currency={salon.currency}
              methodHref={(id) => paymentMethodHrefOf(salon.id, id)}
            />
          </>
        ))
        .exhaustive()}
      <p>
        <ButtonLink href={settingsHrefOf(salon.id)}>設定へ</ButtonLink>
      </p>
    </>
  )
}

/** The payment methods of the salon of the address, for everybody who works there and an administrator. */
export const PaymentMethodsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <PaymentMethodsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
