import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsBookingServiceResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminBookingMessages,
  adminMenuMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingHrefOf } from '../../navigation'
import {
  attemptLineRemoval,
  type BookingRead,
  bookingKeyOf,
  bookingListsKeyOf,
  type LineRead,
  lineKeyOf,
  readBookingLine,
} from '../api/bookings-api'
import { BookingLineRecord } from '../components/booking-line-record/booking-line-record'
import { LineRemoval } from '../components/line-removal/line-removal'
import { hoursOf } from '../utils/booking-format'
import { afterLineRemoval, whyLineStays } from '../utils/booking-moves'
import { serviceNameOf } from '../utils/day-bookings'
import { WithBooking, WithStaffAndServices } from './with-booking'

const { titles, names, frame } = adminBookingMessages
const { line: LINE, removal: REMOVAL } = adminBookingMessages.moves

type LineProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
  line: ModelsBookingServiceResponse
}

/**
 * A line of a booking, and its removal. The line is not changed: another
 * is added, and this one taken away. After a removal the page of the
 * booking is read anew, as the API summed the booking up again; a line
 * that stays after all is said so from the booking as it is now.
 */
const Line = ({ salon, booking, line }: LineProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [removing, setRemoving] = useState(false)
  const [removalSaid, setRemovalSaid] = useState<LocalizedText | undefined>(
    undefined,
  )
  const bookingKey = bookingKeyOf(booking.id)
  const back = bookingHrefOf(salon.id, booking.id)
  const removal = useMutation({
    mutationFn: () => attemptLineRemoval(booking.id, line.id),
    onSuccess: (outcome) =>
      match(afterLineRemoval(outcome))
        .with({ type: 'done' }, () => {
          queryClient.removeQueries({ queryKey: bookingKey, exact: true })
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          notify({ tone: 'success', message: REMOVAL.done })
          void navigate(back)
        })
        .with({ type: 'again' }, ({ message }) => setRemovalSaid(message))
        .with({ type: 'stays' }, ({ booking: now }) => {
          const read: BookingRead = { type: 'found', booking: now }
          setRemoving(false)
          queryClient.setQueryData(bookingKey, read)
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
        })
        // The line or its booking was gone already: both are read anew
        .with({ type: 'gone' }, () => {
          setRemoving(false)
          void queryClient.invalidateQueries({ queryKey: bookingKey })
        })
        .exhaustive(),
  })

  return (
    <WithStaffAndServices salonId={salon.id}>
      {(staff, services) => (
        <>
          <BookingLineRecord
            line={line}
            staff={staff}
            services={services}
            timezone={salon.timezone}
            currency={salon.currency}
          />
          <LineRemoval
            why={whyLineStays(booking)}
            what={REMOVAL.lineOf(
              serviceNameOf(line.serviceId, services) ??
                say(adminMenuMessages.removedService),
              hoursOf(line, salon.timezone),
            )}
            open={removing}
            onOpen={() => {
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
      )}
    </WithStaffAndServices>
  )
}

type LineOfBookingProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
}

/** The line of the address, read whenever the screen opens, as the booking is. */
const LineOfBooking = ({ salon, booking }: LineOfBookingProps) => {
  const say = useSay()
  const { lineId = '' } = useParams()
  const read = useQuery({
    queryKey: lineKeyOf(booking.id, lineId),
    queryFn: () => readBookingLine(booking.id, lineId),
    staleTime: 0,
    refetchOnReconnect: false,
  })
  const shown: LineRead | undefined = read.isFetchedAfterMount
    ? read.data
    : undefined
  const back = (
    <ButtonLink href={bookingHrefOf(salon.id, booking.id)}>
      {say(frame.toBooking)}
    </ButtonLink>
  )

  return match(shown)
    .with(undefined, () => <LoadingIndicator label={say(LINE.loading)} />)
    .with({ type: 'found' }, ({ line }) => (
      <>
        <Line salon={salon} booking={booking} line={line} />
        {back}
      </>
    ))
    .with({ type: 'notFound' }, () => (
      <>
        <p>{say(LINE.notFound)}</p>
        {back}
      </>
    ))
    .with({ type: 'forbidden' }, () => <OtherSalonNotice />)
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={say(unreadMessageOf(names.line, reason))}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .exhaustive()
}

/** A line of a booking of the salon of the address, and its removal. */
export const BookingLineScreen = () => {
  const say = useSay()
  const title = say(titles.line)
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithBooking key={salon.id} salon={salon} title={title}>
          {(booking) => <LineOfBooking salon={salon} booking={booking} />}
        </WithBooking>
      )}
    </WithSalon>
  )
}
