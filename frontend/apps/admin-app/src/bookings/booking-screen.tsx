import type {
  ModelsBookingCancelRequest,
  ModelsBookingCompleteRequest,
  ModelsBookingResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customerKeyOf, readCustomer } from '../customers/customers-api'
import {
  bookingHrefOf,
  bookingMoveHrefOf,
  bookingsHrefOf,
  checkoutHrefOf,
  customerHrefOf,
  lineEntryHrefOf,
  lineHrefOf,
  saleHrefOf,
  treatmentEntryHrefOf,
  treatmentHrefOf,
} from '../navigation'
import { NOT_FOUND, unreadMessageOf, whyUnread } from '../reading'
import { BookingSale } from '../sales/components/booking-sale/booking-sale'
import { readSalesOfBooking, salesOfBookingKeyOf } from '../sales/sales-api'
import { dayNameOf, momentNameAt } from '../salon-time'
import {
  readServices,
  readStaffProfiles,
  servicesKeyOf,
  staffProfilesKeyOf,
} from '../salons/salons-api'
import { OtherSalonNotice, WithSalon } from '../salons/with-salon'
import { BookingTreatment } from '../treatments/components/booking-treatment/booking-treatment'
import { isTreated } from '../treatments/treatment-format'
import {
  findTreatmentOfBooking,
  treatmentOfBookingKeyOf,
} from '../treatments/treatments-api'
import {
  actionsOf,
  afterChange,
  CHANGED_ELSEWHERE,
  readCancellation,
  readCompletion,
} from './booking-actions'
import { afterRemoval } from './booking-entry'
import { hoursOf } from './booking-format'
import { isMovable, mayAddLine } from './booking-moves'
import {
  type BookingRead,
  bookingKeyOf,
  bookingListsKeyOf,
  cancelBooking,
  completeBooking,
  confirmBooking,
  deleteBooking,
  readBooking,
  recordNoShow,
  type StatusChange,
  startBooking,
} from './bookings-api'
import { BookingChanges } from './components/booking-changes/booking-changes'
import { BookingRecord } from './components/booking-record/booking-record'
import {
  type AskedAction,
  StatusActions,
} from './components/status-actions/status-actions'

const TITLE = '予約の内容'

const UNREAD = P.union('tooManyRequests', 'failed')

/** An operation on the state of a booking, with what it sends. */
type Operation =
  | { type: 'confirm' }
  | { type: 'start' }
  | { type: 'noShow' }
  | { type: 'complete'; request: ModelsBookingCompleteRequest }
  | { type: 'cancel'; request: ModelsBookingCancelRequest }

const send = (id: string, operation: Operation): Promise<StatusChange> =>
  match(operation)
    .with({ type: 'confirm' }, () => confirmBooking(id))
    .with({ type: 'start' }, () => startBooking(id))
    .with({ type: 'noShow' }, () => recordNoShow(id))
    .with({ type: 'complete' }, ({ request }) => completeBooking(id, request))
    .with({ type: 'cancel' }, ({ request }) => cancelBooking(id, request))
    .exhaustive()

/** What is said about an attempt, and where: in the open dialog, or where the state is. */
type Said = { where: 'dialog' | 'page'; message: string }

/** Who may remove a booking from the ledger: a member of the staff cancels it instead */
const REMOVERS: readonly string[] = ['owner', 'manager', 'admin']

type BookingDetailsProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
}

/**
 * A booking, with its customer, its members of the staff and its services
 * by name, what can be done to its state, and the ways to change what the
 * salon wrote down on it and to remove it.
 *
 * After an operation the booking is shown as the API answered it, the
 * lists that were read are dropped (they would show the state before), and
 * the focus goes to the heading of the state: the button that was pressed
 * may be gone. A booking that was removed is gone from the ledger: the
 * screen leads to the bookings of its day.
 */
const BookingDetails = ({ salon, booking }: BookingDetailsProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const session = useSession()
  const { notify } = useNotifications()
  const customer = useQuery({
    queryKey: customerKeyOf(booking.customerId),
    queryFn: () => readCustomer(booking.customerId),
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })
  const services = useQuery({
    queryKey: servicesKeyOf(salon.id),
    queryFn: () => readServices(salon.id),
  })
  const sales = useQuery({
    queryKey: salesOfBookingKeyOf(booking.id),
    queryFn: () => readSalesOfBooking(salon.id, booking.id),
    // A sale is entered at the counter: whether there is one is read whenever the page opens
    staleTime: 0,
  })
  const treatment = useQuery({
    queryKey: treatmentOfBookingKeyOf(booking.id),
    queryFn: () =>
      findTreatmentOfBooking({
        salonId: salon.id,
        customerId: booking.customerId,
        bookingId: booking.id,
      }),
    // A record is written beside the chair: whether there is one is read whenever the page opens
    staleTime: 0,
    enabled: isTreated(booking),
  })
  const [asking, setAsking] = useState<AskedAction>()
  const [said, setSaid] = useState<Said>()
  const [removing, setRemoving] = useState(false)
  const [removalSaid, setRemovalSaid] = useState<string>()
  const [completionErrors, setCompletionErrors] = useState<
    Record<string, string>
  >({})
  const statusHeading = useRef<HTMLHeadingElement>(null)
  /**
   * When the booking was last changed, as the screen showed it when an
   * operation on it was done: the focus goes to the heading of the state in
   * the commit that shows it changed
   */
  const changedFrom = useRef<string>(undefined)
  const key = bookingKeyOf(booking.id)

  useLayoutEffect(() => {
    if (
      changedFrom.current !== undefined &&
      changedFrom.current !== booking.updatedAt
    ) {
      changedFrom.current = undefined
      statusHeading.current?.focus()
    }
  }, [booking.updatedAt])

  // The dialog that had the focus is gone, and what is said is said where
  // the state is: the focus goes there in the commit that says it
  useLayoutEffect(() => {
    if (said?.message === CHANGED_ELSEWHERE) {
      statusHeading.current?.focus()
    }
  }, [said])

  const change = useMutation({
    mutationFn: (operation: Operation) => send(booking.id, operation),
    onSuccess: (outcome, operation) => {
      const where = operation.type === 'confirm' || operation.type === 'start'
      match(afterChange(outcome, operation.type))
        .with({ type: 'done' }, ({ message }) => {
          if (outcome.type !== 'changed') {
            return
          }
          const read: BookingRead = { type: 'found', booking: outcome.booking }
          changedFrom.current = booking.updatedAt
          setAsking(undefined)
          setSaid(undefined)
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          notify({ tone: 'success', message })
        })
        .with({ type: 'again' }, ({ message }) =>
          setSaid({ where: where ? 'page' : 'dialog', message }),
        )
        .with({ type: 'changed' }, ({ message }) => {
          setAsking(undefined)
          setSaid({ where: 'page', message })
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .with({ type: 'gone' }, () => {
          setAsking(undefined)
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .exhaustive()
    },
  })

  const removal = useMutation({
    mutationFn: () => deleteBooking(booking.id),
    onSuccess: (outcome) =>
      match(afterRemoval(outcome))
        .with({ type: 'done' }, () => {
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          queryClient.setQueryData(key, NOT_FOUND)
          notify({ tone: 'success', message: '予約を削除しました。' })
          void navigate(
            `${bookingsHrefOf(salon.id)}?date=${booking.bookingDate}`,
          )
        })
        .with({ type: 'again' }, ({ message }) => setRemovalSaid(message))
        .with({ type: 'refused' }, ({ message }) => {
          setRemoving(false)
          setSaid({ where: 'page', message })
        })
        .with({ type: 'gone' }, () => {
          setRemoving(false)
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .exhaustive(),
  })

  const act = (operation: Operation): void => {
    setSaid(undefined)
    change.mutate(operation)
  }

  const ask = (action: AskedAction): void => {
    // What was said about an attempt before is said no longer
    setSaid(undefined)
    setCompletionErrors({})
    setAsking(action)
  }

  return match([customer.data, staff.data, services.data])
    .with(
      [undefined, P._, P._],
      [P._, undefined, P._],
      [P._, P._, undefined],
      () => <LoadingIndicator label='予約の内容を読み込んでいます' />,
    )
    .with(
      [
        { type: P.union('found', 'notFound') },
        { type: 'found' },
        { type: 'found' },
      ],
      ([ofCustomer, ofStaff, ofServices]) => (
        <>
          {said?.where === 'page' && (
            <Alert tone='danger'>{said.message}</Alert>
          )}
          <StatusActions
            status={booking.status}
            actions={actionsOf(booking, new Date())}
            when={`${dayNameOf(booking.bookingDate)} ${hoursOf(booking, salon.timezone)}`}
            headingRef={statusHeading}
            pending={change.isPending ? change.variables.type : undefined}
            asking={asking}
            message={said?.where === 'dialog' ? said.message : undefined}
            completionErrors={completionErrors}
            recordedStart={
              booking.actualStartTime === null
                ? undefined
                : momentNameAt(booking.actualStartTime, salon.timezone)
            }
            onAct={(action) => act({ type: action })}
            onAsk={ask}
            onClose={() => setAsking(undefined)}
            onComplete={(values) => {
              const completion = readCompletion(values, {
                timezone: salon.timezone,
                recordedStart: booking.actualStartTime,
              })
              if (completion.type === 'invalid') {
                setCompletionErrors(completion.errors)
                return
              }
              setCompletionErrors({})
              act({ type: 'complete', request: completion.request })
            }}
            onCancel={(values) =>
              act({ type: 'cancel', request: readCancellation(values) })
            }
            onNoShow={() => act({ type: 'noShow' })}
          />
          <BookingRecord
            booking={booking}
            customer={ofCustomer.type === 'found' ? ofCustomer.customer : null}
            customerHref={customerHrefOf(salon.id, booking.customerId)}
            staff={ofStaff.items}
            services={ofServices.items}
            timezone={salon.timezone}
            currency={salon.currency}
            lineHrefOf={(lineId) => lineHrefOf(salon.id, booking.id, lineId)}
          />
          <BookingSale
            booking={booking}
            sales={sales.data}
            currency={salon.currency}
            saleHref={(saleId) => saleHrefOf(salon.id, saleId)}
            checkoutHref={checkoutHrefOf(salon.id, booking.id)}
            onRetry={() => void sales.refetch()}
            retrying={sales.isFetching}
          />
          <BookingTreatment
            booking={booking}
            found={treatment.data}
            timezone={salon.timezone}
            treatmentHref={(treatmentId) =>
              treatmentHrefOf(salon.id, treatmentId)
            }
            entryHref={treatmentEntryHrefOf(salon.id, booking.id)}
            onRetry={() => void treatment.refetch()}
            retrying={treatment.isFetching}
          />
          <BookingChanges
            moveHref={
              isMovable(booking)
                ? bookingMoveHrefOf(salon.id, booking.id)
                : undefined
            }
            lineEntryHref={
              mayAddLine(booking)
                ? lineEntryHrefOf(salon.id, booking.id)
                : undefined
            }
            notesHref={`${bookingHrefOf(salon.id, booking.id)}/edit`}
            removable={
              session.type === 'signedIn' &&
              REMOVERS.includes(session.user.role)
            }
            when={`${dayNameOf(booking.bookingDate)} ${hoursOf(booking, salon.timezone)}`}
            open={removing}
            onOpen={() => {
              // What was said about an attempt before is said no longer
              setSaid(undefined)
              setRemovalSaid(undefined)
              setRemoving(true)
            }}
            onClose={() => setRemoving(false)}
            message={removalSaid}
            pending={removal.isPending}
            onRemove={() => {
              setRemovalSaid(undefined)
              removal.mutate()
            }}
          />
        </>
      ),
    )
    .with(
      [{ type: UNREAD }, P._, P._],
      [P._, { type: UNREAD }, P._],
      [P._, P._, { type: P.union(UNREAD, 'notFound') }],
      (reads) => (
        <UnreadNotice
          message={unreadMessageOf('予約の内容', whyUnread(reads))}
          onRetry={() => {
            void customer.refetch()
            void staff.refetch()
            void services.refetch()
          }}
          retrying={
            customer.isFetching || staff.isFetching || services.isFetching
          }
        />
      ),
    )
    .exhaustive()
}

type BookingOfSalonProps = {
  salon: ModelsSalonResponse
}

const BookingOfSalon = ({ salon }: BookingOfSalonProps) => {
  const { bookingId = '' } = useParams()
  const read = useQuery({
    queryKey: bookingKeyOf(bookingId),
    queryFn: () => readBooking(bookingId),
    // A booking is changed at the counter and by its customer: what is
    // shown is read whenever the screen opens
    staleTime: 0,
  })
  const bookings = bookingsHrefOf(salon.id)

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <LoadingIndicator label='予約を読み込んでいます' />
        </>
      ))
      .with(
        { type: 'found', booking: { salonId: salon.id } },
        ({ booking }) => (
          <>
            <PageHeader title={TITLE} description={salon.name} />
            <BookingDetails salon={salon} booking={booking} />
            <p>
              <ButtonLink
                href={`${bookings}?date=${booking.bookingDate}`}
                variant='secondary'
              >
                この日の予約へ
              </ButtonLink>
            </p>
          </>
        ),
      )
      // A booking of another salon is not one of this salon's
      .with({ type: P.union('found', 'notFound') }, () => (
        <>
          <PageHeader
            title='予約が見つかりません'
            description='アドレスが正しいか、お確かめください。削除された予約は、表示できません。'
          />
          <p>
            <ButtonLink href={bookings} variant='secondary'>
              今日の予約へ
            </ButtonLink>
          </p>
        </>
      ))
      .with({ type: 'forbidden' }, () => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <OtherSalonNotice />
        </>
      ))
      .with({ type: UNREAD }, (reason) => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <UnreadNotice
            message={unreadMessageOf('予約', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}

/** A booking of the salon of the address, and what can be done to its state. */
export const BookingScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <BookingOfSalon key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
