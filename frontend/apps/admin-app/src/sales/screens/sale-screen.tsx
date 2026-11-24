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
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customerKeyOf, readCustomer } from '../../customers/api/customers-api'
import {
  bookingHrefOf,
  paymentEntryHrefOf,
  pointEntryHrefOf,
  receiptHrefOf,
  refundHrefOf,
  saleChangeHrefOf,
  salesHrefOf,
} from '../../navigation'
import {
  readStaffProfiles,
  staffProfilesKeyOf,
} from '../../salons/api/salons-api'
import {
  attemptVoid,
  forgetListsOf,
  type SaleRead,
  saleKeyOf,
} from '../api/sales-api'
import { PaymentTable } from '../components/payment-table/payment-table'
import { SalePoints } from '../components/sale-points/sale-points'
import { SaleRecord } from '../components/sale-record/sale-record'
import { SaleVoid } from '../components/sale-void/sale-void'
import { whyNoRefund } from '../utils/refunds'
import {
  afterVoid,
  mayUndoSales,
  readVoid,
  whyNoVoid,
  whyUnchangeable,
} from '../utils/sale-changes'
import { whyNoPayment, whyNoReceipt } from '../utils/sale-format'
import { ledgerQueryOf } from '../utils/sales-ledger'
import { WithPaymentMethods, WithSale } from './with-sale'

const { ledger, loading, names, record, titles, undoneByOthers, words } =
  adminSaleMessages
const { void: voidTexts } = adminSaleMessages.changes

/** A sale names no customer when none was recorded: nothing is read for it */
const NO_CUSTOMER: { type: 'none' } = { type: 'none' }

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
  const say = useSay()
  const queryClient = useQueryClient()
  const session = useSession()
  const { notify } = useNotifications()
  const [voiding, setVoiding] = useState(false)
  const [voidSaid, setVoidSaid] =
    useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
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
    forgetListsOf(queryClient, now)
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
                ? voidTexts.done
                : voidTexts.doneOfBooking,
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
    queryFn: customerId === null ? skipToken : () => readCustomer(customerId),
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })
  const noPayment = whyNoPayment(sale)
  const noReceipt = whyNoReceipt(sale)

  return match([customerId === null ? NO_CUSTOMER : customer.data, staff.data])
    .with([undefined, P._], [P._, undefined], () => (
      <LoadingIndicator label={say(loading.details)} />
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
            title={say(words.payments)}
            actions={
              noPayment === undefined && (
                <ButtonLink
                  href={paymentEntryHrefOf(salon.id, sale.id)}
                  variant='primary'
                >
                  {say(record.recordPayment)}
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
            {noPayment !== undefined && <p>{say(noPayment)}</p>}
          </Card>
          <Card
            title={say(record.receiptTitle)}
            actions={
              noReceipt === undefined && (
                <ButtonLink href={receiptHrefOf(salon.id, sale.id)}>
                  {say(record.issueReceipt)}
                </ButtonLink>
              )
            }
          >
            <p>{say(noReceipt ?? record.receiptExplanation)}</p>
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
            <Card title={say(voidTexts.title)} headingRef={voidHeading}>
              <SaleVoid
                why={mayUndo ? whyNoVoid(sale) : undoneByOthers}
                subject={adminSaleMessages.saleNamed(sale.saleNumber)}
                open={voiding}
                onOpen={() => {
                  setVoidSaid(NOTHING_TO_SAY)
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
                  setVoidSaid(NOTHING_TO_SAY)
                  voidance.mutate(read.value)
                }}
              />
            </Card>
          )}
        </>
      ),
    )
    .with(
      [{ type: P.union(...UNREAD_TYPES) }, P._],
      [P._, { type: P.union(...UNREAD_TYPES) }],
      (reads) => (
        <UnreadNotice
          message={say(unreadMessageOf(names.details, whyUnread(reads)))}
          onRetry={() => {
            void customer.refetch()
            void staff.refetch()
          }}
          pending={customer.isFetching || staff.isFetching}
        />
      ),
    )
    .exhaustive()
}

/** A sale of the salon of the address, its payments and its receipt. */
export const SaleScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const title = say(titles.sale)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithSale key={salon.id} salon={salon} title={title} fresh={false}>
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
                {say(ledger.toDay)}
              </ButtonLink>
            </>
          )}
        </WithSale>
      )}
    </WithSalon>
  )
}
