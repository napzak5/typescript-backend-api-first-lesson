import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingRescheduleRequest,
  ModelsBookingResponse,
  ModelsBookingServiceResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingHrefOf } from '../../navigation'
import {
  attemptMove,
  type BookingRead,
  bookingKeyOf,
  bookingListsKeyOf,
  type LineCheck,
} from '../api/bookings-api'
import { BookingMoveForm } from '../components/booking-move-form/booking-move-form'
import {
  afterMove,
  movedLines,
  readMove,
  whyUnmovable,
} from '../utils/booking-moves'
import { Unchangeable, WithBooking, WithStaffAndServices } from './with-booking'

const TITLE = '日時と担当を変える'

type MoveProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
  staff: readonly ModelsStaffProfileResponse[]
  services: readonly ModelsServiceResponse[]
}

/**
 * The form that moves a booking, opened with what it has. The lines are
 * shown where the values would put them, as the values change. A form sent
 * as it was opened asks the API for nothing.
 *
 * The API refuses a move that would take a member beyond what they take
 * at once without saying which line: each line is then checked where it
 * would be, and what was found out is shown under it until a value
 * changes. A booking that changed meanwhile into a state that is not moved
 * is shown as it is now, and the screen says why.
 */
const Move = ({ salon, booking, staff, services }: MoveProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const [moved, setMoved] = useState<
    readonly ModelsBookingServiceResponse[] | undefined
  >(() =>
    movedLines(booking, {
      startTime: booking.startTime,
      staffId: booking.staffId,
    }),
  )
  const [checks, setChecks] = useState<readonly LineCheck[] | undefined>(
    undefined,
  )
  const key = bookingKeyOf(booking.id)
  const back = bookingHrefOf(salon.id, booking.id)
  const move = useMutation({
    mutationFn: (request: ModelsBookingRescheduleRequest) =>
      attemptMove(salon.id, booking.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'moved' }, ({ booking: now }) => {
          const read: BookingRead = { type: 'found', booking: now }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          notify({ tone: 'success', message: '予約の日時と担当を変えました。' })
          void navigate(back)
        })
        // The booking changed meanwhile: the screen shows it as it is now
        .with({ type: 'unmovable' }, ({ booking: now }) => {
          const read: BookingRead = { type: 'found', booking: now }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
        })
        // The booking was removed meanwhile: the screen says that there is none
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with({ type: 'taken' }, (taken) => {
          setChecks(taken.checks)
          setSaid(afterMove(taken))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterMove(refused)),
        )
        .exhaustive(),
  })

  const change = (values: FormData): void => {
    const read = readMove(values, salon.timezone)
    setMoved(
      read.type === 'valid' ? movedLines(booking, read.value) : undefined,
    )
    setChecks(undefined)
  }

  const submit = (values: FormData): void =>
    match(readMove(values, salon.timezone))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with(
        {
          type: 'valid',
          value: { staffId: booking.staffId, startTime: booking.startTime },
        },
        () => {
          notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
          void navigate(back)
        },
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        setChecks(undefined)
        move.mutate(value)
      })
      .exhaustive()

  return (
    <BookingMoveForm
      staff={staff}
      services={services}
      booking={booking}
      timezone={salon.timezone}
      moved={moved}
      checks={checks}
      onValuesChange={change}
      message={said.message}
      errors={said.errors}
      pending={move.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Moves a booking of the salon of the address to another time, or another member of the staff. */
export const BookingMoveScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithBooking key={salon.id} salon={salon} title={TITLE}>
          {(booking) =>
            match(whyUnmovable(booking))
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
                    <Move
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
