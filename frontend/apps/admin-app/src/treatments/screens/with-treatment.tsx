import {
  UNREAD_TYPES,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
  ModelsProductResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { skipToken, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import { bookingKeyOf, readBooking } from '../../bookings/api/bookings-api'
import { WithStaffAndServices } from '../../bookings/screens/with-booking'
import { customerKeyOf, readCustomer } from '../../customers/api/customers-api'
import { treatmentsHrefOf } from '../../navigation'
import { productsKeyOf, readProducts } from '../../products/api/products-api'
import { readTreatment, treatmentKeyOf } from '../api/treatments-api'

/** What a screen of a record names and offers, read with the record */
export type TreatmentContext = {
  record: ModelsTreatmentRecordResponse
  booking: ModelsBookingResponse
  /** The customer; `undefined` for one who left the ledger */
  customer: ModelsCustomerResponse | undefined
  staff: readonly ModelsStaffProfileResponse[]
  services: readonly ModelsServiceResponse[]
  products: readonly ModelsProductResponse[]
}

type WithTreatmentProps = {
  salon: ModelsSalonResponse
  treatmentId: string
  /** The title of the screen */
  title: string
  /**
   * Whether the record is shown only once it was read anew: a screen that
   * writes it does, so that a form opens with what is stored now and is
   * not taken away by an answer nobody asked for
   */
  fresh: boolean
  /** The screen, below its heading, for the record that was read */
  children: (context: TreatmentContext) => ReactNode
}

/** What is said of a record that is not found: the way to the list */
const TreatmentNotFound = ({ salonId }: { salonId: string }) => (
  <>
    <PageHeader
      title='施術記録が見つかりません'
      description='アドレスが正しいか、お確かめください。削除された施術記録は、表示できません。'
    />
    <ButtonLink href={treatmentsHrefOf(salonId)}>施術記録の一覧へ</ButtonLink>
  </>
)

/**
 * A screen of a treatment record of the salon of the address, with what
 * it names: its booking, its customer, the members of the staff, the
 * services and the products of the salon. The booking says which salon
 * the record is of: a record of the booking of another salon is not one
 * of this salon's.
 *
 * What the record names is read once the record was. One heading stays
 * while the reads go on, so that it keeps the focus the screen gave it.
 */
export const WithTreatment = ({
  salon,
  treatmentId,
  title,
  fresh,
  children,
}: WithTreatmentProps) => {
  const read = useQuery({
    queryKey: treatmentKeyOf(treatmentId),
    queryFn: () => readTreatment(treatmentId),
    staleTime: 0,
    refetchOnWindowFocus: !fresh,
    refetchOnReconnect: !fresh,
  })
  const shown = !fresh || read.isFetchedAfterMount ? read.data : undefined
  const record = shown?.type === 'found' ? shown.record : undefined
  const booking = useQuery({
    queryKey: bookingKeyOf(record?.bookingId ?? ''),
    queryFn:
      record === undefined ? skipToken : () => readBooking(record.bookingId),
  })
  const customer = useQuery({
    queryKey: customerKeyOf(record?.customerId ?? ''),
    queryFn:
      record === undefined ? skipToken : () => readCustomer(record.customerId),
  })
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: record === undefined ? skipToken : () => readProducts(salon.id),
    refetchOnReconnect: false,
  })
  const header = <PageHeader title={title} description={salon.name} />
  const loading = (
    <>
      {header}
      <LoadingIndicator label='施術記録を読み込んでいます' />
    </>
  )

  return (
    match([shown, booking.data, customer.data, products.data])
      .with([undefined, P._, P._, P._], () => loading)
      .with([{ type: 'notFound' }, P._, P._, P._], () => (
        <TreatmentNotFound salonId={salon.id} />
      ))
      .with([{ type: P.union(...UNREAD_TYPES) }, P._, P._, P._], ([reason]) => (
        <>
          {header}
          <UnreadNotice
            message={unreadMessageOf('施術記録', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .with(
        [{ type: 'found' }, undefined, P._, P._],
        [{ type: 'found' }, P._, undefined, P._],
        [{ type: 'found' }, P._, P._, undefined],
        () => loading,
      )
      .with(
        [
          { type: 'found' },
          { type: 'found', booking: { salonId: salon.id } },
          { type: P.union('found', 'notFound') },
          { type: 'found' },
        ],
        ([{ record: found }, ofBooking, ofCustomer, ofProducts]) => (
          <>
            {header}
            <WithStaffAndServices salonId={salon.id} label='スタッフとメニュー'>
              {(staff, services) =>
                children({
                  record: found,
                  booking: ofBooking.booking,
                  customer:
                    ofCustomer.type === 'found'
                      ? ofCustomer.customer
                      : undefined,
                  staff,
                  services,
                  products: ofProducts.items,
                })
              }
            </WithStaffAndServices>
          </>
        ),
      )
      // The booking of a record stays while the record does: a record of a booking of another salon is not this salon's
      .with(
        [
          { type: 'found' },
          { type: 'found' },
          { type: P.union('found', 'notFound') },
          { type: 'found' },
        ],
        [
          { type: 'found' },
          { type: P.union('notFound', 'forbidden') },
          P._,
          P._,
        ],
        () => <TreatmentNotFound salonId={salon.id} />,
      )
      .with(
        [{ type: 'found' }, { type: P.union(...UNREAD_TYPES) }, P._, P._],
        [{ type: 'found' }, P._, { type: P.union(...UNREAD_TYPES) }, P._],
        [
          { type: 'found' },
          P._,
          P._,
          { type: P.union(...UNREAD_TYPES, 'notFound') },
        ],
        ([, ...reads]) => (
          <>
            {header}
            <UnreadNotice
              message={unreadMessageOf('施術記録', whyUnread(reads))}
              onRetry={() => {
                void booking.refetch()
                void customer.refetch()
                void products.refetch()
              }}
              pending={
                booking.isFetching || customer.isFetching || products.isFetching
              }
            />
          </>
        ),
      )
      .exhaustive()
  )
}
