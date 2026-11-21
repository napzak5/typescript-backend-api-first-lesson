import type {
  ModelsBookingResponse,
  ModelsBookingServiceCreateRequest,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayNameOf,
  NOT_FOUND,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { ButtonLink, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingHrefOf } from '../navigation'
import type { FormSays } from './booking-entry'
import { afterAddition, readAddition, whyNoLineAdded } from './booking-moves'
import {
  attemptAddition,
  type BookingRead,
  bookingKeyOf,
  bookingListsKeyOf,
  type LineCheck,
} from './bookings-api'
import { BookingLineForm } from './components/booking-line-form/booking-line-form'
import { Unchangeable, WithBooking, WithStaffAndServices } from './with-booking'

const TITLE = '施術明細を追加する'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
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
          notify({ tone: 'success', message: '施術明細を追加しました。' })
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
    setSaid(NOTHING_SAID)
    setCheck(undefined)
    addition.mutate(read.request)
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
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Adds a line to a booking of the salon of the address. */
export const BookingLineEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithBooking key={salon.id} salon={salon} title={TITLE}>
          {(booking) =>
            match(whyNoLineAdded(booking))
              .with(P.string, (why) => (
                <Unchangeable
                  why={why}
                  back={bookingHrefOf(salon.id, booking.id)}
                />
              ))
              .with(undefined, () => (
                <WithStaffAndServices
                  salonId={salon.id}
                  label='スタッフとメニュー'
                >
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
