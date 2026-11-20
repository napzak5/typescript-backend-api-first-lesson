import type {
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  LoadingIndicator,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { customerPointsHrefOf } from '../navigation'
import { NOT_FOUND } from '../reading'
import { readSale, saleKeyOf } from '../sales/sales-api'
import { dayAt } from '../salon-time'
import { WithSalon } from '../salons/with-salon'
import { PointEntryForm } from './components/point-entry-form/point-entry-form'
import {
  CUSTOMER_LISTS,
  type CustomerRead,
  customerKeyOf,
} from './customers-api'
import {
  afterRecording,
  type OfferedSale,
  offeredSaleOf,
  type PointRecording,
  pointKindIn,
  pointKindsFor,
  readPointRecording,
  withBalance,
} from './points'
import {
  balanceKeyOf,
  pointsKeyOf,
  readBalance,
  recordPoints,
} from './points-api'
import { WithCustomer } from './with-customer'

const TITLE = 'ポイントを記録する'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type PointEntryProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  /** The balance of the customer; `undefined` when it could not be read */
  balance: number | undefined
  /** The sale the address names; `undefined` when it names none */
  sale: OfferedSale | undefined
}

/**
 * The form that records points of the customer, for the sale of the
 * address when there is one. After it, the points of the customer are read
 * anew: the screen goes back to the points, with the balance in the
 * notification. The record of the customer that was read is given the
 * balance the points left: the screens of the customer show it before
 * they have read the customer anew.
 */
const PointEntry = ({ salon, customer, balance, sale }: PointEntryProps) => {
  const session = useSession()
  const [search] = useSearchParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const kinds = pointKindsFor(
    session.type === 'signedIn' ? session.user.role : '',
  )
  const back = customerPointsHrefOf(salon.id, customer.id)
  const record = useMutation({
    mutationFn: (recording: PointRecording) => recordPoints(recording),
    onSuccess: (outcome) =>
      match(afterRecording(outcome))
        .with({ type: 'done' }, ({ message, balance }) => {
          queryClient.setQueryData<CustomerRead>(
            customerKeyOf(customer.id),
            (read) => (read === undefined ? read : withBalance(read, balance)),
          )
          queryClient.removeQueries({ queryKey: pointsKeyOf(customer.id) })
          notify({ tone: 'success', message })
          void navigate(back)
        })
        .with({ type: 'again' }, ({ message, errors }) =>
          setSaid({ message, errors }),
        )
        // The customer was removed from the ledger meanwhile
        .with({ type: 'gone' }, () => {
          queryClient.removeQueries({ queryKey: CUSTOMER_LISTS })
          queryClient.removeQueries({ queryKey: pointsKeyOf(customer.id) })
          queryClient.setQueryData(customerKeyOf(customer.id), NOT_FOUND)
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void => {
    const read = readPointRecording(values, {
      customerId: customer.id,
      kinds,
      today: dayAt(new Date(), salon.timezone),
      offeredSale: sale?.type === 'sale' ? sale.id : null,
    })
    if (read.type === 'invalid') {
      setSaid({ message: undefined, errors: read.errors })
      return
    }
    setSaid(NOTHING_SAID)
    record.mutate(read.request)
  }

  return (
    <PointEntryForm
      kinds={kinds}
      initialKind={pointKindIn(search)}
      balance={balance}
      today={dayAt(new Date(), salon.timezone)}
      sale={sale}
      message={said.message}
      errors={said.errors}
      pending={record.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type PointsToRecordProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The balance, which the form tells, and the sale of the address, which
 * the form offers to record the points for: both are read before the form
 * opens.
 */
const PointsToRecord = ({ salon, customer }: PointsToRecordProps) => {
  const [search] = useSearchParams()
  const saleId = search.get('saleId')
  const balance = useQuery({
    queryKey: balanceKeyOf(customer.id),
    queryFn: () => readBalance(customer.id),
    staleTime: 0,
  })
  const sale = useQuery({
    queryKey: saleKeyOf(saleId ?? ''),
    queryFn: () => readSale(saleId ?? ''),
    enabled: saleId !== null,
    staleTime: 0,
  })

  if (
    balance.data === undefined ||
    (saleId !== null && sale.data === undefined)
  ) {
    return <LoadingIndicator label='残高を読み込んでいます' />
  }

  return (
    <PointEntry
      salon={salon}
      customer={customer}
      balance={balance.data.type === 'found' ? balance.data.balance : undefined}
      sale={
        sale.data === undefined
          ? undefined
          : offeredSaleOf(sale.data, customer.id, salon)
      }
    />
  )
}

/**
 * Records points of a customer, below the salon of the address: points
 * given at the counter and points the customer used, by every member, and
 * an adjustment by an owner or a manager. The page of a sale leads here
 * with the sale, and with what it asks to record.
 */
export const PointEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh={false}>
          {(customer) => (
            <PointsToRecord
              key={customer.id}
              salon={salon}
              customer={customer}
            />
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
