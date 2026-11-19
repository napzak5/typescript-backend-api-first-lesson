import type {
  ModelsBookingResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingsHrefOf } from '../navigation'
import { unreadMessageOf, whyUnread } from '../reading'
import { dayNameOf } from '../salon-time'
import {
  readServices,
  readStaffProfiles,
  servicesKeyOf,
  staffProfilesKeyOf,
} from '../salons/salons-api'
import { OtherSalonNotice } from '../salons/with-salon'
import { hoursOf } from './booking-format'
import { bookingKeyOf, readBooking } from './bookings-api'

const UNREAD = P.union('tooManyRequests', 'failed')

export type WithBookingProps = {
  salon: ModelsSalonResponse
  /** The title of the screen */
  title: string
  /** The screen, below its heading, for the booking of the address that was read */
  children: (booking: ModelsBookingResponse) => ReactNode
}

/**
 * A screen that changes a booking of the salon of the address. The booking
 * is read whenever the screen opens, and what the screen shows is what the
 * API says then: what is changed is what is in the ledger now. Nothing is
 * read behind it while the form is filled in; what the screen does to the
 * booking it writes here itself.
 *
 * Below the heading, the booking is named by its number and its time, with
 * the way back to its page.
 */
export const WithBooking = ({ salon, title, children }: WithBookingProps) => {
  const { bookingId = '' } = useParams()
  const read = useQuery({
    queryKey: bookingKeyOf(bookingId),
    queryFn: () => readBooking(bookingId),
    staleTime: 0,
    refetchOnReconnect: false,
  })
  const shown = read.isFetchedAfterMount ? read.data : undefined

  return (
    match(shown)
      .with(undefined, () => (
        <>
          <PageHeader title={title} description={salon.name} />
          <LoadingIndicator label='予約を読み込んでいます' />
        </>
      ))
      .with(
        { type: 'found', booking: { salonId: salon.id } },
        ({ booking }) => (
          <>
            <PageHeader title={title} description={salon.name} />
            <p>
              {`予約番号 ${booking.bookingNumber}（${dayNameOf(booking.bookingDate)} ${hoursOf(booking, salon.timezone)}）`}
            </p>
            {children(booking)}
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
            <ButtonLink href={bookingsHrefOf(salon.id)} variant='secondary'>
              今日の予約へ
            </ButtonLink>
          </p>
        </>
      ))
      .with({ type: 'forbidden' }, () => (
        <>
          <PageHeader title={title} description={salon.name} />
          <OtherSalonNotice />
        </>
      ))
      .with({ type: UNREAD }, (reason) => (
        <>
          <PageHeader title={title} description={salon.name} />
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

/** What a screen that changes a booking says when the booking is not changed so: why, and the way back. */
export const Unchangeable = ({ why, back }: { why: string; back: string }) => (
  <>
    <p>{why}</p>
    <p>
      <ButtonLink href={back} variant='secondary'>
        予約の内容へ
      </ButtonLink>
    </p>
  </>
)

export type WithStaffAndServicesProps = {
  salonId: string
  /** What is read, as the screen names it while it is read: 「スタッフとメニュー」 */
  label: string
  /** The part of the screen that names and offers them */
  children: (
    staff: readonly ModelsStaffProfileResponse[],
    services: readonly ModelsServiceResponse[],
  ) => ReactNode
}

/**
 * The part of a screen that names the members of the staff and the
 * services of the salon, and offers them: shown when both were read. They
 * change seldom, and are not read behind a form that is filled in.
 */
export const WithStaffAndServices = ({
  salonId,
  label,
  children,
}: WithStaffAndServicesProps) => {
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salonId),
    queryFn: () => readStaffProfiles(salonId),
    refetchOnReconnect: false,
  })
  const services = useQuery({
    queryKey: servicesKeyOf(salonId),
    queryFn: () => readServices(salonId),
    refetchOnReconnect: false,
  })

  return match([staff.data, services.data])
    .with([undefined, P._], [P._, undefined], () => (
      <LoadingIndicator label={`${label}を読み込んでいます`} />
    ))
    .with([{ type: 'found' }, { type: 'found' }], ([ofStaff, ofServices]) =>
      children(ofStaff.items, ofServices.items),
    )
    .with(
      [{ type: UNREAD }, P._],
      [P._, { type: P.union(UNREAD, 'notFound') }],
      (reads) => (
        <UnreadNotice
          message={unreadMessageOf(label, whyUnread(reads))}
          onRetry={() => {
            void staff.refetch()
            void services.refetch()
          }}
          retrying={staff.isFetching || services.isFetching}
        />
      ),
    )
    .exhaustive()
}
