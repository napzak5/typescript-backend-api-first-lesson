import type { ModelsCustomerBookingResponse } from '@beauty-salon-frontend/api-client'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Card,
  LoadingIndicator,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { CUSTOMERS } from '../roles'
import { readSalon, readStaff } from '../salons/salons-api'
import { UnreadNotice } from '../salons/unread-notice'
import { SignInHelp } from '../sign-in-help'
import { readOwnBooking, readService, whyUnread } from './bookings-api'
import { BookingSummary } from './components/booking-summary/booking-summary'

const TITLE = '予約の内容'

const UNREAD = P.union('tooManyRequests', 'failed')

type BookingDetailsProps = {
  booking: ModelsCustomerBookingResponse
}

/**
 * A booking names its salon, its service and its member of the staff by
 * their IDs. The salon says when the booking is (its time zone) and what an
 * amount is in (its currency), so nothing is shown before the salon is
 * read; a service or a member of the staff that the salon no longer shows
 * leaves the rest as it is.
 */
const BookingDetails = ({ booking }: BookingDetailsProps) => {
  const serviceId = booking.services.at(0)?.serviceId ?? ''
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

  return match([salon.data, service.data, staff.data])
    .with(
      [undefined, P._, P._],
      [P._, undefined, P._],
      [P._, P._, undefined],
      () => <LoadingIndicator label='予約の内容を読み込んでいます' />,
    )
    .with(
      [
        { type: 'found' },
        { type: P.union('found', 'notFound') },
        { type: 'found' },
      ],
      ([found, ofService, ofStaff]) => (
        <Card title={`予約番号 ${booking.bookingNumber}`}>
          <BookingSummary
            booking={booking}
            salon={found.salon}
            salonHref={`/salons/${found.salon.id}`}
            serviceName={
              ofService.type === 'found' ? ofService.service.name : null
            }
            staffName={
              ofStaff.staff.find(({ id }) => id === booking.staffId)
                ?.displayName ?? null
            }
          />
        </Card>
      ),
    )
    .with(
      [{ type: P.union('notFound', 'tooManyRequests', 'failed') }, P._, P._],
      [P._, { type: UNREAD }, P._],
      [P._, P._, { type: UNREAD }],
      (reads) => (
        <UnreadNotice
          what='予約の内容'
          reason={whyUnread(reads)}
          onRetry={again}
          retrying={salon.isFetching || service.isFetching || staff.isFetching}
        />
      ),
    )
    .exhaustive()
}

const OwnBooking = () => {
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
        <PageHeader title={TITLE} />
        <LoadingIndicator label='予約を読み込んでいます' />
      </>
    ))
    .with({ type: 'found' }, ({ booking }) => (
      <>
        <PageHeader title={TITLE} />
        <BookingDetails booking={booking} />
      </>
    ))
    .with({ type: 'notFound' }, () => (
      <>
        <PageHeader
          title='予約が見つかりません'
          description='アドレスが正しいか、お確かめください。ほかのアカウントで入れた予約は、表示できません。'
        />
        <p>
          <ButtonLink href='/'>サロンを探す</ButtonLink>
        </p>
      </>
    ))
    .with({ type: UNREAD }, (reason) => (
      <>
        <PageHeader title={TITLE} />
        <UnreadNotice
          what='予約'
          reason={reason}
          onRetry={() => void read.refetch()}
          retrying={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}

/** A booking of the customer who is signed in: what was booked, when, with whom, and where it stands. */
export const BookingDetailScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='予約を確認するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <OwnBooking />
  </RequireSession>
)
