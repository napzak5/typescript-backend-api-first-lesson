import {
  UNREAD_TYPES,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingRescheduleRequest,
  ModelsCustomerBookingResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { readSalon, readStaff } from '../../salons/api/salons-api'
import { dateAt } from '../../salons/utils/salon-format'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'
import {
  moveOwnBooking,
  type OwnBookingRead,
  readOwnBooking,
  readService,
  readSlots,
} from '../api/bookings-api'
import {
  BookingForm,
  type TimesOfDay,
} from '../components/booking-form/booking-form'
import { BookingSummary } from '../components/booking-summary/booking-summary'
import {
  type Choice,
  choiceIn,
  queryOf,
  staffFor,
  timesOf,
} from '../utils/booking-choice'
import { afterMove, readMove } from '../utils/booking-flow'
import {
  isChangeable,
  isMovable,
  OWN_BOOKING_LISTS,
  serviceIdOf,
} from '../utils/own-bookings'

const TITLE = '日時の変更'

type MoveStepProps = {
  booking: ModelsCustomerBookingResponse
  salon: ModelsSalonResponse
  service: ModelsServiceResponse
  staff: readonly ModelsStaffProfileResponse[]
}

/**
 * With whom, on which day and at which time the booking is to be. It is
 * the form of a new booking without the request; the times are those that
 * are free for a visit as long as the booking, which keeps its length
 * whatever the service takes now.
 */
const MoveStep = ({ booking, salon, service, staff }: MoveStepProps) => {
  const [query, setQuery] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const today = dateAt(new Date(), salon.timezone)
  const choice = choiceIn(query, today, staff)
  const slots = useQuery({
    queryKey: [
      'salons',
      salon.id,
      'slots',
      service.id,
      queryOf(choice),
      booking.duration,
    ],
    queryFn: () =>
      readSlots({
        salonId: salon.id,
        serviceId: service.id,
        ...choice,
        duration: booking.duration,
      }),
    // A time is free until somebody books it: the times of a day are read
    // whenever they are shown, and never shown from memory
    staleTime: 0,
    gcTime: 0,
  })
  const times =
    slots.data?.type === 'found'
      ? timesOf(slots.data.slots, salon.timezone)
      : []
  const move = useMutation({
    mutationFn: (request: ModelsBookingRescheduleRequest) =>
      moveOwnBooking(booking.id, request),
    onSuccess: (outcome) => {
      if (outcome.type === 'moved') {
        const read: OwnBookingRead = { type: 'found', booking: outcome.booking }
        queryClient.setQueryData(['own', 'bookings', booking.id], read)
        notify({ tone: 'success', message: '予約の日時を変更しました。' })
        queryClient.removeQueries({ queryKey: OWN_BOOKING_LISTS })
        void navigate(`/bookings/${booking.id}`)
        return
      }
      setSays(afterMove(outcome))
      if (outcome.type === 'refused') {
        void slots.refetch()
      }
    },
  })

  const choose = (next: Choice): void => {
    // What was said about a time of another day is said no longer
    setSays(NOTHING_TO_SAY)
    setQuery(queryOf(next), { replace: true })
  }

  const submit = (values: FormData): void => {
    const read = readMove(values, { staffId: choice.staffId, times })
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    move.mutate(read.value)
  }

  return (
    <Card title='新しい日時'>
      {booking.status === 'confirmed' && (
        <Alert tone='info'>
          この予約は確定しています。日時を変更すると「確定待ち」に戻り、サロンが内容を確認すると、あらためて確定します。
        </Alert>
      )}
      <p>
        いまの予約の時間と重なる時刻は、空いている時刻に表示されないことがあります。
      </p>
      <BookingForm
        staff={staff}
        choice={choice}
        today={today}
        onChoose={choose}
        times={match(slots.data)
          .returnType<TimesOfDay>()
          .with(undefined, () => ({ type: 'loading' }))
          .with({ type: 'found' }, () => ({ type: 'listed', times }))
          .with({ type: P.union(...UNREAD_TYPES) }, (reason) => ({
            type: 'unread',
            reason,
            retrying: slots.isFetching,
          }))
          .exhaustive()}
        onRetry={() => void slots.refetch()}
        submitLabel='この日時に変更する'
        message={says.message}
        errors={says.errors}
        pending={move.isPending}
        onSubmit={submit}
      />
    </Card>
  )
}

type BookingToMoveProps = {
  booking: ModelsCustomerBookingResponse
}

/**
 * The booking as it is, and below it the form that moves it. A booking
 * that has begun or ended is moved by nobody, and one the salon added to
 * is the salon's to move: the screen says so in place of the form.
 */
const BookingToMove = ({ booking }: BookingToMoveProps) => {
  const serviceId = serviceIdOf(booking) ?? ''
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
  const again = (): void => {
    void salon.refetch()
    void service.refetch()
    void staff.refetch()
  }

  if (!isChangeable(booking, new Date())) {
    return (
      <Alert tone='warning'>
        この予約は、日時を変更できません。キャンセルした予約と、開始時刻を過ぎた予約は、変更できません。
      </Alert>
    )
  }

  return match([salon.data, service.data, staff.data])
    .with(
      [undefined, P._, P._],
      [P._, undefined, P._],
      [P._, P._, undefined],
      () => <LoadingIndicator label='予約の内容を読み込んでいます' />,
    )
    .with(
      [{ type: 'found' }, { type: 'found' }, { type: 'found' }],
      ([foundSalon, foundService, foundStaff]) => (
        <>
          <Card title={`予約番号 ${booking.bookingNumber}`}>
            <BookingSummary
              booking={booking}
              salon={foundSalon.salon}
              salonHref={`/salons/${foundSalon.salon.id}`}
              serviceName={foundService.service.name}
              staffName={
                foundStaff.staff.find(({ id }) => id === booking.staffId)
                  ?.displayName ?? null
              }
            />
          </Card>
          {isMovable(booking) ? (
            <MoveStep
              booking={booking}
              salon={foundSalon.salon}
              service={foundService.service}
              staff={staffFor(foundService.service, foundStaff.staff)}
            />
          ) : (
            <Alert tone='warning'>
              この予約は、この画面から日時を変更できません。日時の変更は、サロンにお問い合わせください。
            </Alert>
          )}
        </>
      ),
    )
    .with(
      [{ type: 'notFound' }, P._, P._],
      [P._, { type: 'notFound' }, P._],
      () => (
        <Alert tone='warning'>
          この予約は、この画面から日時を変更できません。日時の変更は、サロンにお問い合わせください。
        </Alert>
      ),
    )
    .with(
      [{ type: P.union(...UNREAD_TYPES) }, P._, P._],
      [P._, { type: P.union(...UNREAD_TYPES) }, P._],
      [P._, P._, { type: P.union(...UNREAD_TYPES) }],
      (reads) => (
        <UnreadNotice
          message={unreadMessageOf('予約の内容', whyUnread(reads))}
          onRetry={again}
          pending={salon.isFetching || service.isFetching || staff.isFetching}
        />
      ),
    )
    .exhaustive()
}

const MovePage = () => {
  const { bookingId = '' } = useParams()
  const read = useQuery({
    queryKey: ['own', 'bookings', bookingId],
    queryFn: () => readOwnBooking(bookingId),
    // The salon confirms a booking, and may change it: what is moved is
    // the booking as it is now
    staleTime: 0,
  })

  return match(read.data)
    .with(undefined, () => (
      <>
        <PageHeader title={TITLE} />
        <LoadingIndicator label='予約を読み込んでいます' />
      </>
    ))
    .with({ type: 'found' }, ({ booking }) => (
      <>
        <PageHeader
          title={TITLE}
          actions={
            <ButtonLink href={`/bookings/${booking.id}`}>
              予約の内容へ戻る
            </ButtonLink>
          }
        />
        <BookingToMove booking={booking} />
      </>
    ))
    .with({ type: 'notFound' }, () => (
      <>
        <PageHeader
          title='予約が見つかりません'
          description='アドレスが正しいか、お確かめください。ほかのアカウントで入れた予約は、表示できません。'
        />
        <ButtonLink href='/bookings'>予約の一覧へ</ButtonLink>
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        <PageHeader title={TITLE} />
        <UnreadNotice
          message={unreadMessageOf('予約', reason)}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}

/**
 * Where a customer moves a booking to another time that is free, with the
 * same member of the staff or with another.
 */
export const BookingMoveScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='予約の日時を変更するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <MovePage />
  </RequireSession>
)
