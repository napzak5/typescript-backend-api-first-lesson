import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsBookingServiceCreateRequest,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { dayNameOf, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  NOTHING_TO_SAY,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingHrefOf } from '../../navigation'
import {
  attemptAddition,
  type BookingRead,
  bookingKeyOf,
  bookingListsKeyOf,
  type LineCheck,
} from '../api/bookings-api'
import { BookingLineForm } from '../components/booking-line-form/booking-line-form'
import {
  afterAddition,
  readAddition,
  whyNoLineAdded,
} from '../utils/booking-moves'
import { Unchangeable, WithBooking, WithStaffAndServices } from './with-booking'

const { titles } = adminBookingMessages
const { addition: ADDITION } = adminBookingMessages.moves

type AdditionProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
  staff: readonly ModelsStaffProfileResponse[]
  services: readonly ModelsServiceResponse[]
}

/**
 * The form that adds a line to a booking, on the day of its visit. The
 * page of the booking is read anew after it: the API summed the booking
 * up again.
 *
 * The API refuses a line whose member is taken without saying so: the
 * member is then checked, and what was found out is shown until a value
 * changes. A booking that changed meanwhile so that it takes no line is
 * shown as it is now, and the screen says why.
 */
const Addition = ({ salon, booking, staff, services }: AdditionProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [check, setCheck] = useState<LineCheck | undefined>(undefined)
  const key = bookingKeyOf(booking.id)
  const back = bookingHrefOf(salon.id, booking.id)
  const addition = useMutation({
    mutationFn: (request: ModelsBookingServiceCreateRequest) =>
      attemptAddition(salon.id, booking.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'added' }, () => {
          queryClient.removeQueries({ queryKey: key, exact: true })
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          notify({ tone: 'success', message: ADDITION.done })
          void navigate(back)
        })
        // The booking changed meanwhile: the screen shows it as it is now
        .with({ type: 'unaddable' }, ({ booking: now }) => {
          const read: BookingRead = { type: 'found', booking: now }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
        })
        // The booking was removed meanwhile: the screen says that there is none
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with({ type: 'taken' }, (taken) => {
          setCheck(taken.check)
          setSaid(afterAddition(taken))
        })
        .with(
          {
            type: P.union(
              'invalid',
              'tooMuch',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterAddition(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void => {
    const read = readAddition(values, { booking, timezone: salon.timezone })
    if (read.type === 'invalid') {
      setSaid({ message: undefined, errors: read.errors })
      return
    }
    setSaid(NOTHING_TO_SAY)
    setCheck(undefined)
    addition.mutate(read.value)
  }

  return (
    <BookingLineForm
      staff={staff}
      services={services}
      day={dayNameOf(booking.bookingDate)}
      timezone={salon.timezone}
      check={check}
      onValuesChange={() => setCheck(undefined)}
      message={said.message}
      errors={said.errors}
      pending={addition.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          {say(ADDITION.cancel)}
        </ButtonLink>
      }
    />
  )
}

/** Adds a line to a booking of the salon of the address. */
export const BookingLineEntryScreen = () => {
  const say = useSay()
  const title = say(titles.lineEntry)
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithBooking key={salon.id} salon={salon} title={title}>
          {(booking) =>
            match(whyNoLineAdded(booking))
              .with(P.nonNullable, (why) => (
                <Unchangeable
                  why={why}
                  back={bookingHrefOf(salon.id, booking.id)}
                />
              ))
              .with(undefined, () => (
                <WithStaffAndServices salonId={salon.id}>
                  {(staff, services) => (
                    <Addition
                      salon={salon}
                      booking={booking}
                      staff={staff}
                      services={services}
                    />
                  )}
                </WithStaffAndServices>
              ))
              .exhaustive()
          }
        </WithBooking>
      )}
    </WithSalon>
  )
}
