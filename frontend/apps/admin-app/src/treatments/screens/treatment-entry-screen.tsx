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
  ModelsTreatmentRecordCreateRequest,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  ButtonLink,
  type FormSays,
  Link,
  LoadingIndicator,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingKeyOf } from '../../bookings/api/bookings-api'
import {
  Unchangeable,
  WithBooking,
  WithStaffAndServices,
} from '../../bookings/screens/with-booking'
import { customerKeyOf, readCustomer } from '../../customers/api/customers-api'
import { bookingHrefOf, treatmentHrefOf } from '../../navigation'
import { productsKeyOf, readProducts } from '../../products/api/products-api'
import {
  createTreatment,
  findTreatmentOfBooking,
  TREATMENT_LISTS,
  type TreatmentRead,
  treatmentKeyOf,
  treatmentOfBookingKeyOf,
} from '../api/treatments-api'
import { TreatmentForm } from '../components/treatment-form/treatment-form'
import {
  afterTreatmentWrite,
  readTreatmentEntry,
  treatmentWrittenOf,
} from '../utils/treatment-form'
import {
  customerCalled,
  customerInASentence,
  isTreated,
} from '../utils/treatment-format'

const { form, frame, names, titles } = adminTreatmentMessages
const { entry: ENTRY } = form

type EntryProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
  customer: ModelsCustomerResponse | undefined
  staff: readonly ModelsStaffProfileResponse[]
  services: readonly ModelsServiceResponse[]
  products: readonly ModelsProductResponse[]
}

/** What the API said of the booking that the form does not: why no record was written */
type Refusal =
  /** Another account wrote the record of the booking meanwhile */
  | { type: 'exists'; treatmentId: string }
  /** The booking was cancelled meanwhile, or its treatment has not begun */
  | { type: 'notBegun' }

/**
 * The form of the record of a booking. Once written, the record is shown.
 * What another account did to the booking meanwhile is said above the
 * form, which takes the focus.
 */
const TreatmentEntry = ({
  salon,
  booking,
  customer,
  staff,
  services,
  products,
}: EntryProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [refusal, setRefusal] = useState<Refusal>()
  const alert = useRef<HTMLDivElement>(null)
  const back = bookingHrefOf(salon.id, booking.id)

  // What is said instead of the errors of the form takes the focus in the commit that says it
  useLayoutEffect(() => {
    if (refusal !== undefined) {
      alert.current?.focus()
    }
  }, [refusal])

  const creation = useMutation({
    mutationFn: (request: ModelsTreatmentRecordCreateRequest) =>
      createTreatment(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ record }) => {
          const read: TreatmentRead = { type: 'found', record }
          queryClient.setQueryData(treatmentKeyOf(record.id), read)
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          notify({
            tone: 'success',
            message: treatmentWrittenOf(customerInASentence(customer), 'entry'),
          })
          void navigate(treatmentHrefOf(salon.id, record.id))
        })
        .with({ type: 'exists' }, ({ treatmentId }) => {
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          setRefusal({ type: 'exists', treatmentId })
        })
        .with({ type: 'notBegun' }, () => {
          void queryClient.invalidateQueries({
            queryKey: bookingKeyOf(booking.id),
          })
          setRefusal({ type: 'notBegun' })
        })
        // The booking was removed meanwhile: the screen says it is not found
        .with({ type: 'notFound' }, () => {
          void queryClient.invalidateQueries({
            queryKey: bookingKeyOf(booking.id),
          })
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) =>
            setSaid(afterTreatmentWrite(refused, 'entry', booking.bookingDate)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void => {
    const read = readTreatmentEntry(values, booking, {
      products,
      bookingDay: booking.bookingDate,
    })
    if (read.type === 'invalid') {
      setSaid({ message: undefined, errors: read.errors })
      return
    }
    setSaid(NOTHING_TO_SAY)
    setRefusal(undefined)
    creation.mutate(read.value)
  }

  return (
    <>
      <p>{say(frame.customerOf(customerCalled(customer)))}</p>
      {refusal !== undefined && (
        <div ref={alert} tabIndex={-1}>
          {match(refusal)
            .with({ type: 'exists' }, ({ treatmentId }) => (
              <Alert tone='danger'>
                {say(ENTRY.exists)}
                <Link href={treatmentHrefOf(salon.id, treatmentId)}>
                  {say(ENTRY.viewExisting)}
                </Link>
              </Alert>
            ))
            .with({ type: 'notBegun' }, () => (
              <Alert tone='danger'>{say(ENTRY.notBegun)}</Alert>
            ))
            .exhaustive()}
        </div>
      )}
      <TreatmentForm
        booking={booking}
        staff={staff}
        services={services}
        products={products}
        submitLabel={say(ENTRY.submit)}
        message={said.message}
        errors={said.errors}
        pending={creation.isPending}
        onSubmit={submit}
        actions={
          <ButtonLink href={back} variant='quiet'>
            {say(ENTRY.cancel)}
          </ButtonLink>
        }
      />
    </>
  )
}

type BookingPartProps = {
  salon: ModelsSalonResponse
  booking: ModelsBookingResponse
}

/**
 * What the form needs beside the booking: its customer, whether its record
 * was written already, and the products of the salon. A booking whose
 * record was written leads to the record; one whose treatment has not
 * begun is not written of.
 */
const BookingPart = ({ salon, booking }: BookingPartProps) => {
  const say = useSay()
  const back = bookingHrefOf(salon.id, booking.id)
  const treated = isTreated(booking)
  const customer = useQuery({
    queryKey: customerKeyOf(booking.customerId),
    queryFn: () => readCustomer(booking.customerId),
    enabled: treated,
  })
  const existing = useQuery({
    queryKey: treatmentOfBookingKeyOf(booking.id),
    queryFn: () =>
      findTreatmentOfBooking({
        salonId: salon.id,
        customerId: booking.customerId,
        bookingId: booking.id,
      }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: treated,
  })
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    refetchOnReconnect: false,
    enabled: treated,
  })

  if (!treated) {
    return <Unchangeable why={ENTRY.notBegun} back={back} />
  }

  return match([customer.data, existing.data, products.data])
    .with(
      [undefined, P._, P._],
      [P._, undefined, P._],
      [P._, P._, undefined],
      () => <LoadingIndicator label={say(ENTRY.preparing)} />,
    )
    .with(
      [
        { type: P.union('found', 'notFound') },
        { type: 'found', record: P.nonNullable },
        P._,
      ],
      ([, { record }]) => (
        <>
          <p>{say(ENTRY.written)}</p>
          <ButtonLink href={treatmentHrefOf(salon.id, record.id)}>
            {say(ENTRY.view)}
          </ButtonLink>
        </>
      ),
    )
    .with(
      [
        { type: P.union('found', 'notFound') },
        { type: 'found' },
        { type: 'found' },
      ],
      ([ofCustomer, , ofProducts]) => (
        <WithStaffAndServices salonId={salon.id}>
          {(staff, services) => (
            <TreatmentEntry
              salon={salon}
              booking={booking}
              customer={
                ofCustomer.type === 'found' ? ofCustomer.customer : undefined
              }
              staff={staff}
              services={services}
              products={ofProducts.items}
            />
          )}
        </WithStaffAndServices>
      ),
    )
    .with(
      [{ type: P.union(...UNREAD_TYPES) }, P._, P._],
      [P._, { type: P.union(...UNREAD_TYPES) }, P._],
      [P._, P._, { type: P.union(...UNREAD_TYPES, 'notFound') }],
      (reads) => (
        <UnreadNotice
          message={say(
            unreadMessageOf(names.customerAndProducts, whyUnread(reads)),
          )}
          onRetry={() => {
            void customer.refetch()
            void existing.refetch()
            void products.refetch()
          }}
          pending={
            customer.isFetching || existing.isFetching || products.isFetching
          }
        />
      ),
    )
    .exhaustive()
}

/** Writes the treatment record of a booking of the salon of the address. */
export const TreatmentEntryScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const title = say(titles.entry)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithBooking salon={salon} title={title}>
          {(booking) => (
            <BookingPart key={booking.id} salon={salon} booking={booking} />
          )}
        </WithBooking>
      )}
    </WithSalon>
  )
}
