import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodResponse,
  ModelsSaleResponse,
  ModelsSaleVoidRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Card,
  LoadingIndicator,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { customerKeyOf, readCustomer } from '../customers/customers-api'
import {
  bookingHrefOf,
  paymentEntryHrefOf,
  pointEntryHrefOf,
  receiptHrefOf,
  refundHrefOf,
  saleChangeHrefOf,
  salesHrefOf,
} from '../navigation'
import { readStaffProfiles, staffProfilesKeyOf } from '../salons/salons-api'
import { PaymentTable } from './components/payment-table/payment-table'
import { SalePoints } from './components/sale-points/sale-points'
import { SaleRecord } from './components/sale-record/sale-record'
import { SaleVoid } from './components/sale-void/sale-void'
import { whyNoRefund } from './refunds'
import {
  afterVoid,
  mayUndoSales,
  readVoid,
  UNDONE_BY_OTHERS,
  whyNoVoid,
  whyUnchangeable,
} from './sale-changes'
import { whyNoPayment, whyNoReceipt } from './sale-format'
import {
  attemptVoid,
  type SaleRead,
  saleKeyOf,
  saleListsKeyOf,
  salesOfBookingKeyOf,
} from './sales-api'
import { ledgerQueryOf } from './sales-ledger'
import { WithPaymentMethods, WithSale } from './with-sale'

const TITLE = '売上の内容'

const UNREAD = P.union(...UNREAD_TYPES)

/** A sale names no customer when none was recorded: nothing is read for it */
const NO_CUSTOMER: { type: 'none' } = { type: 'none' }

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type SaleDetailsProps = {
  salon: ModelsSalonResponse
  sale: ModelsSaleResponse
  methods: readonly ModelsPaymentMethodResponse[]
}

/**
 * A sale, with its customer and its members of the staff by name, its
 * payments, and what can be done next: change what it records, record a
 * payment while something is left to pay, hand over the receipt once the
 * total was received, give a payment back, and void the sale. What cannot
 * be done, or not by this account, is said, with why.
 *
 * After a voiding the sale is shown as the API answered it, the lists that
 * were read are dropped, and the focus goes to the heading of the sale:
 * the part that voided it is gone. A voiding refused because the sale
 * changed meanwhile shows it as it is now, with the focus on the heading
 * of the part that says why.
 */
const SaleDetails = ({ salon, sale, methods }: SaleDetailsProps) => {
  const queryClient = useQueryClient()
  const session = useSession()
  const { notify } = useNotifications()
  const [voiding, setVoiding] = useState(false)
  const [voidSaid, setVoidSaid] = useState<FormSays>(NOTHING_SAID)
  const recordHeading = useRef<HTMLHeadingElement>(null)
  const voidHeading = useRef<HTMLHeadingElement>(null)
  /**
   * The sale as the screen showed it when it was voided: the focus moves
   * in the commit that shows the sale the API answered instead
   */
  const changedFrom = useRef<ModelsSaleResponse>(undefined)
  const mayUndo = session.type === 'signedIn' && mayUndoSales(session.user.role)
  const key = saleKeyOf(sale.id)
  const { customerId } = sale

  useLayoutEffect(() => {
    if (changedFrom.current !== undefined && changedFrom.current !== sale) {
      changedFrom.current = undefined
      ;(sale.isVoid ? recordHeading : voidHeading).current?.focus()
    }
  }, [sale])

  const show = (now: ModelsSaleResponse): void => {
    changedFrom.current = sale
    const read: SaleRead = { type: 'found', sale: now }
    queryClient.setQueryData(key, read)
    queryClient.removeQueries({ queryKey: saleListsKeyOf(salon.id) })
    if (now.bookingId !== null) {
      queryClient.removeQueries({
        queryKey: salesOfBookingKeyOf(now.bookingId),
      })
    }
  }
  const voidance = useMutation({
    mutationFn: (request: ModelsSaleVoidRequest) =>
      attemptVoid(sale.id, request),
    onSuccess: (outcome) =>
      match(afterVoid(outcome))
        // The part that voided it, and its dialog, are gone with the voiding
        .with({ type: 'done' }, ({ sale: voided }) => {
          show(voided)
          notify({
            tone: 'success',
            message:
              voided.bookingId === null
                ? '売上を取り消しました。'
                : '売上を取り消しました。予約の会計を、入れ直せます。',
          })
        })
        .with({ type: 'again' }, ({ message, errors }) =>
          setVoidSaid({ message, errors }),
        )
        // The sale changed meanwhile: the screen shows it as it is now, and why
        .with({ type: 'refused' }, ({ sale: now, message }) => {
          setVoiding(false)
          show(now)
          notify({ tone: 'warning', message })
        })
        // The sale was removed meanwhile, or is no longer this account's to see
        .with({ type: 'gone' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .exhaustive(),
  })
  const customer = useQuery({
    queryKey: customerKeyOf(customerId ?? ''),
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
            changeHref={
              whyUnchangeable(sale) === undefined
                ? saleChangeHrefOf(salon.id, sale.id)
                : undefined
            }
            headingRef={recordHeading}
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
              refundHrefOf={(payment) =>
                mayUndo && whyNoRefund(payment) === undefined
                  ? refundHrefOf(salon.id, sale.id, payment.id)
                  : undefined
              }
            />
            {noPayment !== undefined && <p>{noPayment}</p>}
          </Card>
          <Card
            title='レシート'
            actions={
              noReceipt === undefined && (
                <ButtonLink href={receiptHrefOf(salon.id, sale.id)}>
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
          {ofCustomer.type === 'found' && !sale.isVoid && (
            <SalePoints
              usedHref={pointEntryHrefOf(salon.id, ofCustomer.customer.id, {
                saleId: sale.id,
                kind: 'used',
              })}
              earnedHref={pointEntryHrefOf(salon.id, ofCustomer.customer.id, {
                saleId: sale.id,
                kind: 'earned',
              })}
            />
          )}
          {!sale.isVoid && (
            <Card title='取り消し' headingRef={voidHeading}>
              <SaleVoid
                why={mayUndo ? whyNoVoid(sale) : UNDONE_BY_OTHERS}
                subject={`売上番号 ${sale.saleNumber}`}
                open={voiding}
                onOpen={() => {
                  setVoidSaid(NOTHING_SAID)
                  setVoiding(true)
                }}
                onClose={() => setVoiding(false)}
                message={voidSaid.message}
                errors={voidSaid.errors}
                pending={voidance.isPending}
                onVoid={(values) => {
                  const read = readVoid(values)
                  if (read.type === 'invalid') {
                    setVoidSaid({ message: undefined, errors: read.errors })
                    return
                  }
                  setVoidSaid(NOTHING_SAID)
                  voidance.mutate(read.request)
                }}
              />
            </Card>
          )}
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
        pending={customer.isFetching || staff.isFetching}
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
              <ButtonLink
                href={`${salesHrefOf(salon.id)}?${ledgerQueryOf({
                  from: sale.saleDate,
                  to: sale.saleDate,
                }).toString()}`}
              >
                この日の売上へ
              </ButtonLink>
            </>
          )}
        </WithSale>
      )}
    </WithSalon>
  )
}
