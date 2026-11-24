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
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  paymentMethodEntryHrefOf,
  paymentMethodHrefOf,
  settingsHrefOf,
} from '../../navigation'
import {
  paymentMethodsKeyOf,
  readPaymentMethods,
} from '../../sales/api/sales-api'
import { PaymentMethodTable } from '../components/payment-method-table/payment-method-table'
import { useKeepsPaymentMethods } from './keeps-payment-methods'

const { list, loading, names, titles } = adminPaymentMethodMessages

type PaymentMethodsPartProps = { salon: ModelsSalonResponse }

/**
 * The payment methods of the salon, read anew whenever the screen opens,
 * those it uses no more among them. An account that keeps them is offered
 * to add one.
 */
const PaymentMethodsPart = ({ salon }: PaymentMethodsPartProps) => {
  const say = useSay()
  const keeps = useKeepsPaymentMethods()
  const methods = useQuery({
    queryKey: paymentMethodsKeyOf(salon.id),
    queryFn: () => readPaymentMethods(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title={say(titles.methods)}
        description={salon.name}
        actions={
          keeps ? (
            <ButtonLink
              href={paymentMethodEntryHrefOf(salon.id)}
              variant='primary'
            >
              {say(titles.entry)}
            </ButtonLink>
          ) : undefined
        }
      />
      {match(methods.isFetchedAfterMount ? methods.data : undefined)
        .with(undefined, () => (
          <LoadingIndicator label={say(loading.methods)} />
        ))
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what={names.methodsOfTheSalon} />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.methods, reason))}
              onRetry={() => void methods.refetch()}
              pending={methods.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, ({ items }) => (
          <>
            <p>{say(list.description)}</p>
            <PaymentMethodTable
              methods={items}
              currency={salon.currency}
              methodHref={(id) => paymentMethodHrefOf(salon.id, id)}
            />
          </>
        ))
        .exhaustive()}
      <ButtonLink href={settingsHrefOf(salon.id)}>
        {say(list.toSettings)}
      </ButtonLink>
    </>
  )
}

/** The payment methods of the salon of the address, for everybody who works there and an administrator. */
export const PaymentMethodsScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.methods)}>
      {(salon) => <PaymentMethodsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
