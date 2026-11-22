import { NOT_FOUND, UNREAD_TYPES } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsBookingUpdateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Form,
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
  type BookingRead,
  bookingKeyOf,
  bookingListsKeyOf,
  updateBooking,
} from '../api/bookings-api'
import { BookingNotesFields } from '../components/booking-notes-fields/booking-notes-fields'
import { afterNotesChange, readNotesChange } from '../utils/booking-entry'
import { WithBooking } from './with-booking'

const TITLE = '要望とメモを変える'

type NotesChangeProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
}

/**
 * The form of what the salon wrote down on a booking, opened with what the
 * booking has. It sends what was changed and nothing else, and a form sent
 * as it was opened asks the API for nothing. What it changed is what the
 * page of the booking shows at once.
 */
const NotesChange = ({ salon, booking }: NotesChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const key = bookingKeyOf(booking.id)
  const back = bookingHrefOf(salon.id, booking.id)
  const update = useMutation({
    mutationFn: (request: ModelsBookingUpdateRequest) =>
      updateBooking(booking.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'updated' }, ({ booking: updated }) => {
          const read: BookingRead = { type: 'found', booking: updated }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          notify({ tone: 'success', message: '予約の記録を変えました。' })
          void navigate(back)
        })
        // The booking was removed meanwhile: the screen says that there is none
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with(
          { type: P.union('invalid', 'forbidden', P.union(...UNREAD_TYPES)) },
          (refused) => setSaid(afterNotesChange(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readNotesChange(values, booking))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        update.mutate(value)
      })
      .exhaustive()

  return (
    <Form
      submitLabel='変更を保存する'
      message={said.message}
      errors={said.errors}
      pending={update.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    >
      <BookingNotesFields notes={booking} errors={said.errors} />
    </Form>
  )
}

/** Changes what the salon wrote down on a booking of the salon of the address. */
export const BookingNotesScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithBooking key={salon.id} salon={salon} title={TITLE}>
          {(booking) => <NotesChange salon={salon} booking={booking} />}
        </WithBooking>
      )}
    </WithSalon>
  )
}
