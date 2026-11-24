import {
  UNREAD_TYPES,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingCancelRequest,
  ModelsCustomerBookingResponse,
} from '@beauty-salon-frontend/api-client'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  portalBookingMessages,
  portalSalonMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { BookingReview } from '../../reviews/screens/booking-review'
import { readSalon, readStaff } from '../../salons/api/salons-api'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'
import {
  cancelOwnBooking,
  type OwnBookingRead,
  readOwnBooking,
  readService,
} from '../api/bookings-api'
import { BookingChanges } from '../components/booking-changes/booking-changes'
import { BookingSummary } from '../components/booking-summary/booking-summary'
import { afterCancellation, readCancellation } from '../utils/booking-flow'
import { whenLineOf } from '../utils/booking-format'
import {
  isChangeable,
  isMovable,
  moveHrefOf,
  OWN_BOOKING_LISTS,
  serviceIdOf,
} from '../utils/own-bookings'

const { detail: words, names } = portalBookingMessages

const GONE_OR_FOUND = P.union('found', 'notFound')

type BookingDetailsProps = {
  booking: ModelsCustomerBookingResponse
}

/**
 * A booking names its salon, its service and its member of the staff by
 * their IDs. The salon says when the booking is (its time zone) and what an
 * amount is in (its currency), so nothing is shown before the salon is
 * read; what is no longer there leaves the rest as it is.
 *
 * Below it is what the customer can still do: move the booking, on a
 * screen of its own, or cancel it, after a dialog has asked. A visit that
 * took place has its review there instead, or the way to write one.
 */
const BookingDetails = ({ booking }: BookingDetailsProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const focusHeading = useScreenHeadingFocus()
  // A booking has a line at least: the API removes no last one
  const serviceId = String(serviceIdOf(booking))
  const own = ['own', 'bookings', booking.id]
  const salon = useQuery({
    queryKey: ['salons', booking.salonId, 'salon'],
    queryFn: () => readSalon(booking.salonId),
  })
  const service = useQuery({
    queryKey: ['salons', booking.salonId, 'services', serviceId],
    queryFn: () => readService(booking.salonId, serviceId),
  })
  const staff = useQuery({
    queryKey: ['salons', booking.salonId, 'staff'],
    queryFn: () => readStaff(booking.salonId),
  })
  const [asking, setAsking] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [unsent, setUnsent] = useState<LocalizedText>()
  /** What the API refused: said on the page, where the booking is read again */
  const [refusal, setRefusal] = useState<LocalizedText>()
  const changeable = isChangeable(booking, new Date())
  /** The customer cancelled here, or tried to: the buttons may go with what they did */
  const answered = useRef(false)

  // The buttons went with the dialog that had the focus, and the screen is
  // the same one: the focus goes to its heading, in the commit that shows
  // the booking as it is now
  useLayoutEffect(() => {
    if (!changeable && answered.current) {
      answered.current = false
      focusHeading()
    }
  }, [changeable, focusHeading])

  const cancellation = useMutation({
    mutationFn: (request: ModelsBookingCancelRequest) =>
      cancelOwnBooking(booking.id, request),
    onSuccess: (outcome) => {
      if (outcome.type === 'cancelled') {
        const read: OwnBookingRead = { type: 'found', booking: outcome.booking }
        answered.current = true
        queryClient.setQueryData(own, read)
        notify({ tone: 'success', message: words.cancelled })
        queryClient.removeQueries({ queryKey: OWN_BOOKING_LISTS })
        return
      }
      match(afterCancellation(outcome))
        .with({ type: 'again' }, ({ message }) => setUnsent(message))
        .with({ type: 'refused' }, ({ message }) => {
          answered.current = true
          setAsking(false)
          setRefusal(message)
          void queryClient.invalidateQueries({ queryKey: own })
        })
        .with({ type: 'gone' }, () => {
          void queryClient.invalidateQueries({ queryKey: own })
        })
        .exhaustive()
    },
  })

  const ask = (): void => {
    // What was said about an attempt before is said no longer
    answered.current = false
    setUnsent(undefined)
    setRefusal(undefined)
    setAsking(true)
  }

  const again = (): void => {
    void salon.refetch()
    void service.refetch()
    void staff.refetch()
  }

  return match([salon.data, service.data, staff.data])
    .with(
      [undefined, P._, P._],
      [P._, undefined, P._],
      [P._, P._, undefined],
      () => <LoadingIndicator label={say(words.loadingDetails)} />,
    )
    .with(
      [{ type: GONE_OR_FOUND }, { type: GONE_OR_FOUND }, { type: 'found' }],
      ([ofSalon, ofService, ofStaff]) => {
        const found = ofSalon.type === 'found' ? ofSalon.salon : null

        return (
          <>
            {refusal !== undefined && (
              <Alert tone='danger'>{say(refusal)}</Alert>
            )}
            <Card title={say(words.numbered(booking.bookingNumber))}>
              <BookingSummary
                booking={booking}
                salon={found}
                salonHref={`/salons/${booking.salonId}`}
                serviceName={
                  ofService.type === 'found' ? ofService.service.name : null
                }
                staffName={
                  ofStaff.staff.find(({ id }) => id === booking.staffId)
                    ?.displayName ?? null
                }
              />
              {changeable && (
                <BookingChanges
                  moveHref={
                    found !== null &&
                    ofService.type === 'found' &&
                    isMovable(booking)
                      ? moveHrefOf(booking)
                      : undefined
                  }
                  when={whenLineOf(booking, found?.timezone ?? null)}
                  open={asking}
                  onOpen={ask}
                  onClose={() => setAsking(false)}
                  message={unsent}
                  pending={cancellation.isPending}
                  onCancel={(values) =>
                    cancellation.mutate(readCancellation(values))
                  }
                />
              )}
            </Card>
            {/* A visit that took place is written about, once */}
            {booking.status === 'completed' && (
              <BookingReview bookingId={booking.id} salon={found} />
            )}
          </>
        )
      },
    )
    .with(
      [{ type: P.union(...UNREAD_TYPES) }, P._, P._],
      [P._, { type: P.union(...UNREAD_TYPES) }, P._],
      [P._, P._, { type: P.union(...UNREAD_TYPES) }],
      (reads) => (
        <UnreadNotice
          message={say(unreadMessageOf(names.details, whyUnread(reads)))}
          onRetry={again}
          pending={salon.isFetching || service.isFetching || staff.isFetching}
        />
      ),
    )
    .exhaustive()
}

const OwnBooking = () => {
  const say = useSay()
  const { bookingId = '' } = useParams()
  const read = useQuery({
    queryKey: ['own', 'bookings', bookingId],
    queryFn: () => readOwnBooking(bookingId),
    // The salon confirms a booking, and may change it: what is shown is
    // read whenever the screen opens
    staleTime: 0,
  })

  return match(read.data)
    .with(undefined, () => (
      <>
        <PageHeader title={say(words.title)} />
        <LoadingIndicator label={say(words.loading)} />
      </>
    ))
    .with({ type: 'found' }, ({ booking }) => (
      <>
        <PageHeader title={say(words.title)} />
        <BookingDetails booking={booking} />
        <ButtonLink href='/bookings'>{say(words.toList)}</ButtonLink>
      </>
    ))
    .with({ type: 'notFound' }, () => (
      <>
        <PageHeader
          title={say(words.notFound)}
          description={say(words.notFoundDescription)}
        />
        <ButtonLink href='/'>
          {say(portalSalonMessages.search.title)}
        </ButtonLink>
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        <PageHeader title={say(words.title)} />
        <UnreadNotice
          message={say(unreadMessageOf(names.booking, reason))}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}

/**
 * A booking of the customer who is signed in: what was booked, when, with
 * whom, and where it stands; and, until it begins, the ways to move it or
 * to cancel it.
 */
export const BookingDetailScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(portalBookingMessages.signInToSee)}
      signInHelp={<SignInHelp />}
    >
      <OwnBooking />
    </RequireSession>
  )
}
