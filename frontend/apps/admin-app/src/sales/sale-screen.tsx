import type {
  ModelsPaymentMethodResponse,
  ModelsSaleResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  Card,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { readCustomer } from '../customers/customers-api'
import {
  bookingHrefOf,
  paymentEntryHrefOf,
  receiptHrefOf,
  salesHrefOf,
} from '../navigation'
import { unreadMessageOf, whyUnread } from '../reading'
import { readStaffProfiles, staffProfilesKeyOf } from '../salons/salons-api'
import { WithSalon } from '../salons/with-salon'
import { PaymentTable } from './components/payment-table/payment-table'
import { SaleRecord } from './components/sale-record/sale-record'
import { whyNoPayment, whyNoReceipt } from './sale-format'
import { ledgerQueryOf } from './sales-ledger'
import { WithPaymentMethods, WithSale } from './with-sale'

const TITLE = '売上の内容'

const UNREAD = P.union('tooManyRequests', 'failed')

/** A sale names no customer when none was recorded: nothing is read for it */
const NO_CUSTOMER: { type: 'none' } = { type: 'none' }

type SaleDetailsProps = {
  salon: ModelsSalonResponse
  sale: ModelsSaleResponse
  methods: readonly ModelsPaymentMethodResponse[]
}

/**
 * A sale, with its customer and its members of the staff by name, its
 * payments, and what can be done next: record a payment while something is
 * left to pay, and hand over the receipt once the total was received.
 * What cannot be done is said, with why.
 */
const SaleDetails = ({ salon, sale, methods }: SaleDetailsProps) => {
  const { customerId } = sale
  const customer = useQuery({
    queryKey: ['customers', customerId],
    queryFn: () => readCustomer(customerId ?? ''),
    enabled: customerId !== null,
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })
  const noPayment = whyNoPayment(sale)
  const noReceipt = whyNoReceipt(sale)

  return match([customerId === null ? NO_CUSTOMER : customer.data, staff.data])
    .with([undefined, P._], [P._, undefined], () => (
      <LoadingIndicator label='売上の内容を読み込んでいます' />
    ))
    .with(
      [{ type: P.union('found', 'notFound', 'none') }, { type: 'found' }],
      ([ofCustomer, ofStaff]) => (
        <>
          <SaleRecord
            sale={sale}
            customer={ofCustomer.type === 'found' ? ofCustomer.customer : null}
            staff={ofStaff.items}
            timezone={salon.timezone}
            currency={salon.currency}
            bookingHref={
              sale.bookingId === null
                ? undefined
                : bookingHrefOf(salon.id, sale.bookingId)
            }
          />
          <Card
            title='支払い'
            actions={
              noPayment === undefined && (
                <ButtonLink
                  href={paymentEntryHrefOf(salon.id, sale.id)}
                  variant='primary'
                >
                  支払いを記録する
                </ButtonLink>
              )
            }
          >
            <PaymentTable
              payments={sale.payments}
              methods={methods}
              timezone={salon.timezone}
              currency={salon.currency}
            />
            {noPayment !== undefined && <p>{noPayment}</p>}
          </Card>
          <Card
            title='レシート'
            actions={
              noReceipt === undefined && (
                <ButtonLink
                  href={receiptHrefOf(salon.id, sale.id)}
                  variant='secondary'
                >
                  レシートを出す
                </ButtonLink>
              )
            }
          >
            <p>
              {noReceipt ??
                'レシートは、印刷してお客様に渡せます。何度でも出し直せます。'}
            </p>
          </Card>
        </>
      ),
    )
    .with([{ type: UNREAD }, P._], [P._, { type: UNREAD }], (reads) => (
      <UnreadNotice
        message={unreadMessageOf('売上の内容', whyUnread(reads))}
        onRetry={() => {
          void customer.refetch()
          void staff.refetch()
        }}
        retrying={customer.isFetching || staff.isFetching}
      />
    ))
    .exhaustive()
}

/** A sale of the salon of the address, its payments and its receipt. */
export const SaleScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithSale key={salon.id} salon={salon} title={TITLE} fresh={false}>
          {(sale) => (
            <>
              <WithPaymentMethods salonId={salon.id}>
                {(methods) => (
                  <SaleDetails salon={salon} sale={sale} methods={methods} />
                )}
              </WithPaymentMethods>
              <p>
                <ButtonLink
                  href={`${salesHrefOf(salon.id)}?${ledgerQueryOf({
                    from: sale.saleDate,
                    to: sale.saleDate,
                  }).toString()}`}
                  variant='secondary'
                >
                  この日の売上へ
                </ButtonLink>
              </p>
            </>
          )}
        </WithSale>
      )}
    </WithSalon>
  )
}
