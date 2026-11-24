import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
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
  LoadingIndicator,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminMenuMessages,
  adminSaleMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
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
  forgetListsOf,
  readSalesOfBooking,
  type SaleRead,
  saleKeyOf,
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
  type SaleOfBookingRequest,
  saleDetailsOf,
  saleOfBooking,
  saleRequestOf,
  whyNoCheckout,
  whyNotCalculated,
} from '../utils/checkout'

const { loading, names, titles, words } = adminSaleMessages
const {
  again,
  bill: whyUnbilled,
  notices,
  ...texts
} = adminSaleMessages.checkout

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
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [added, setAdded] = useState<readonly string[]>([])
  const [changed, setChanged] = useState<LocalizedText>()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  // The services added, as the menu has them: one that is no longer on it
  // when the menu is read again falls off the bill, as the form shows no
  // line of it to take off
  const billed = added.flatMap((id) => services.filter((one) => one.id === id))
  const billedIds = billed.map(({ id }) => id)
  const calculation = useQuery({
    queryKey: ['sales', 'calculation', salon.id, booking.id, ...billedIds],
    queryFn: () =>
      calculateSale({
        salonId: salon.id,
        bookingId: booking.id,
        services: billedIds,
      }),
    staleTime: 0,
    refetchOnReconnect: false,
  })
  const lines = billLinesOf(booking, billed, services)
  const bill = match(calculation.data)
    .returnType<Bill>()
    .with(undefined, () => ({ type: 'calculating' }))
    .with({ type: 'calculated' }, (calculated) =>
      agreesWith(lines, calculated.calculation.breakdown)
        ? calculated
        : { type: 'uncalculated', message: whyUnbilled.otherPrices },
    )
    .with({ type: 'invalid' }, ({ values }) => ({
      type: 'uncalculated',
      message: whyNotCalculated(values, billedIds, services),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'uncalculated',
      message: whyUnbilled.forbidden,
    }))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => ({
      type: 'unread',
      message: unreadMessageOf(names.amounts, reason),
    }))
    .exhaustive()

  const checkout = useMutation({
    mutationFn: (request: SaleOfBookingRequest) => attemptSale(request),
    onSuccess: (outcome) =>
      match(afterCheckout(outcome))
        .with({ type: P.union('done', 'billed') }, ({ type, sale }) => {
          const read: SaleRead = { type: 'found', sale }
          queryClient.setQueryData(saleKeyOf(sale.id), read)
          forgetListsOf(queryClient, sale)
          notify(
            type === 'done'
              ? { tone: 'success', message: notices.done }
              : { tone: 'warning', message: notices.billed },
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
      setSaid(aboutTheAttempt(again.noBill))
      return
    }
    setSaid(NOTHING_TO_SAY)
    checkout.mutate(
      saleRequestOf(
        booking,
        readCheckout(values),
        saleDetailsOf(
          lines,
          bill.calculation.breakdown.taxAmount,
          say(adminMenuMessages.removedService),
        ),
        new Date(),
      ),
    )
  }

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
      onAdd={({ id, name }) => {
        setAdded([...billedIds, id])
        setChanged(notices.added(name))
      }}
      onRemove={(index, name) => {
        setAdded(billedIds.filter((_id, at) => at !== index))
        setChanged(notices.removed(name))
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
          {say(words.cancel)}
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
  const say = useSay()
  const sales = useQuery({
    queryKey: salesOfBookingKeyOf(booking.id),
    queryFn: () => readSalesOfBooking(salon.id, booking.id),
    staleTime: 0,
    refetchOnReconnect: false,
  })
  const shown = sales.isFetchedAfterMount ? sales.data : undefined

  return match(shown)
    .with(undefined, () => <LoadingIndicator label={say(loading.checkout)} />)
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={say(unreadMessageOf(names.checkout, reason))}
        onRetry={() => void sales.refetch()}
        pending={sales.isFetching}
      />
    ))
    .with({ type: 'forbidden' }, () => (
      <OtherSalonNotice what={names.checkoutsOfTheSalon} />
    ))
    .with({ type: 'found' }, ({ sales: found }) => {
      const sale = saleOfBooking(found)

      return sale === undefined ? (
        <WithStaffAndServices salonId={salon.id}>
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
          <p>{say(texts.billedAlready)}</p>
          <ButtonLink href={saleHrefOf(salon.id, sale.id)}>
            {say(texts.toSale)}
          </ButtonLink>
        </>
      )
    })
    .exhaustive()
}

/** Enters the sale of a booking of the salon of the address. */
export const CheckoutScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const title = say(titles.checkout)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithBooking key={salon.id} salon={salon} title={title}>
          {(booking) =>
            match(whyNoCheckout(booking))
              .with(P.nonNullable, (why) => (
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
