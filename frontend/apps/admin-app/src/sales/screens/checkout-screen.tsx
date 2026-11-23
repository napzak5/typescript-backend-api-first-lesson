import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsSaleCreateRequest,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  ButtonLink,
  type FormSays,
  inJapanese,
  LoadingIndicator,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  Unchangeable,
  WithBooking,
  WithStaffAndServices,
} from '../../bookings/screens/with-booking'
import { bookingHrefOf, saleHrefOf } from '../../navigation'
import { servicesKeyOf } from '../../salons/api/salons-api'
import {
  attemptSale,
  calculateSale,
  readSalesOfBooking,
  type SaleRead,
  saleKeyOf,
  saleListsKeyOf,
  salesOfBookingKeyOf,
} from '../api/sales-api'
import { CheckoutForm } from '../components/checkout-form/checkout-form'
import {
  afterCheckout,
  agreesWith,
  type Bill,
  billLinesOf,
  NO_CASHIER,
  readCheckout,
  saleDetailsOf,
  saleOfBooking,
  saleRequestOf,
  whyNoCheckout,
  whyNotCalculated,
} from '../utils/checkout'

const TITLE = '会計を入れる'

/** What is said of a calculation whose prices are not those of the menu the screen read */
const OTHER_PRICES =
  'メニューの料金が、この画面を開いたあとで変わりました。計算し直すと、いまの料金で数えます。'

type CheckoutProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
  staff: readonly ModelsStaffProfileResponse[]
  services: readonly ModelsServiceResponse[]
}

/**
 * The checkout of a booking whose visit took place. The lines are those of
 * the booking and the services added at the counter; the API calculates
 * the amounts whenever they change, and the tax it calculated is shared
 * among the lines of the sale. After the sale is entered, its page shows it.
 *
 * A booking is billed once: when it was billed meanwhile, the sale that
 * bills it is shown.
 */
const Checkout = ({ salon, booking, staff, services }: CheckoutProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [added, setAdded] = useState<readonly string[]>([])
  const [changed, setChanged] = useState('')
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const calculation = useQuery({
    queryKey: ['sales', 'calculation', salon.id, booking.id, ...added],
    queryFn: () =>
      calculateSale({
        salonId: salon.id,
        bookingId: booking.id,
        services: [...added],
      }),
    staleTime: 0,
    refetchOnReconnect: false,
  })
  const lines = billLinesOf(booking, added, services)
  const bill = match(calculation.data)
    .returnType<Bill>()
    .with(undefined, () => ({ type: 'calculating' }))
    .with({ type: 'calculated' }, (calculated) =>
      agreesWith(lines, calculated.calculation.breakdown)
        ? calculated
        : { type: 'uncalculated', message: OTHER_PRICES },
    )
    .with({ type: 'invalid' }, ({ values }) => ({
      type: 'uncalculated',
      message: whyNotCalculated(values, added, services),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'uncalculated',
      message: 'このサロンの会計は、入れられません。',
    }))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => ({
      type: 'unread',
      message: inJapanese(unreadMessageOf(writtenInJapanese('金額'), reason)),
    }))
    .exhaustive()

  const checkout = useMutation({
    mutationFn: (request: ModelsSaleCreateRequest) => attemptSale(request),
    onSuccess: (outcome) =>
      match(afterCheckout(outcome))
        .with({ type: P.union('done', 'billed') }, ({ type, sale }) => {
          const read: SaleRead = { type: 'found', sale }
          queryClient.setQueryData(saleKeyOf(sale.id), read)
          queryClient.removeQueries({ queryKey: saleListsKeyOf(salon.id) })
          queryClient.removeQueries({
            queryKey: salesOfBookingKeyOf(booking.id),
          })
          notify(
            type === 'done'
              ? { tone: 'success', message: '会計を入れました。' }
              : {
                  tone: 'warning',
                  message:
                    'この予約には、その間に会計が入っていました。その売上を表示します。',
                },
          )
          void navigate(saleHrefOf(salon.id, sale.id))
        })
        .with({ type: 'again' }, ({ message, errors }) =>
          setSaid({ message, errors }),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void => {
    if (bill.type !== 'calculated') {
      setSaid(aboutTheAttempt('金額が出てから、会計を入れてください。'))
      return
    }
    setSaid(NOTHING_TO_SAY)
    checkout.mutate(
      saleRequestOf(
        booking,
        readCheckout(values),
        saleDetailsOf(lines, bill.calculation.breakdown.taxAmount),
        new Date(),
      ),
    )
  }

  const nameOf = (serviceId: string): string =>
    services.find(({ id }) => id === serviceId)?.name ?? ''

  return (
    <CheckoutForm
      booked={lines.slice(0, booking.services.length)}
      added={lines.slice(booking.services.length)}
      offered={services.filter(({ isActive }) => isActive)}
      staff={staff}
      cashier={
        staff.some(({ id }) => id === booking.staffId)
          ? booking.staffId
          : NO_CASHIER
      }
      currency={salon.currency}
      bill={bill}
      changed={changed}
      onAdd={(serviceId) => {
        setAdded([...added, serviceId])
        setChanged(`${nameOf(serviceId)}を足しました。`)
      }}
      onRemove={(index) => {
        setAdded(added.filter((_id, at) => at !== index))
        setChanged(`${nameOf(added[index] ?? '')}を外しました。`)
      }}
      onRecalculate={() => {
        // A price that changed is read anew with the menu
        void queryClient.invalidateQueries({
          queryKey: servicesKeyOf(salon.id),
        })
        void calculation.refetch()
      }}
      recalculating={calculation.isFetching}
      message={said.message}
      errors={said.errors}
      pending={checkout.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={bookingHrefOf(salon.id, booking.id)} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type CheckoutOfBookingProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
}

/**
 * The checkout, once it is known that the booking has no sale: the sales
 * of the booking are read whenever the screen opens. A booking that has
 * one leads to it.
 */
const CheckoutOfBooking = ({ salon, booking }: CheckoutOfBookingProps) => {
  const sales = useQuery({
    queryKey: salesOfBookingKeyOf(booking.id),
    queryFn: () => readSalesOfBooking(salon.id, booking.id),
    staleTime: 0,
    refetchOnReconnect: false,
  })
  const shown = sales.isFetchedAfterMount ? sales.data : undefined

  return match(shown)
    .with(undefined, () => <LoadingIndicator label='会計を読み込んでいます' />)
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={inJapanese(unreadMessageOf(writtenInJapanese('会計'), reason))}
        onRetry={() => void sales.refetch()}
        pending={sales.isFetching}
      />
    ))
    .with({ type: 'forbidden' }, () => (
      <OtherSalonNotice what={writtenInJapanese('会計')} />
    ))
    .with({ type: 'found' }, ({ sales: found }) => {
      const sale = saleOfBooking(found)

      return sale === undefined ? (
        <WithStaffAndServices salonId={salon.id} label='スタッフとメニュー'>
          {(staff, services) => (
            <Checkout
              salon={salon}
              booking={booking}
              staff={staff}
              services={services}
            />
          )}
        </WithStaffAndServices>
      ) : (
        <>
          <p>
            この予約には、会計が入っています。1 件の予約に入れる会計は、1
            件です。
          </p>
          <ButtonLink href={saleHrefOf(salon.id, sale.id)}>
            売上の内容へ
          </ButtonLink>
        </>
      )
    })
    .exhaustive()
}

/** Enters the sale of a booking of the salon of the address. */
export const CheckoutScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithBooking key={salon.id} salon={salon} title={TITLE}>
          {(booking) =>
            match(whyNoCheckout(booking))
              .with(P.string, (why) => (
                <Unchangeable
                  why={why}
                  back={bookingHrefOf(salon.id, booking.id)}
                />
              ))
              .with(undefined, () => (
                <CheckoutOfBooking salon={salon} booking={booking} />
              ))
              .exhaustive()
          }
        </WithBooking>
      )}
    </WithSalon>
  )
}
