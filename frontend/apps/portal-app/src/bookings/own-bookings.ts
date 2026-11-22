import type { NotFound, Unread } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingStatusType,
  ModelsCustomerBookingResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { daysFrom, queryOf } from './booking-choice'
import type { OwnBookingsAsked } from './bookings-api'

/**
 * The key under which the lists of the bookings of the account are kept.
 * A screen that wrote a booking takes away what was read under it
 * (`removeQueries`): a list is then read before it is shown again, and
 * never says for a moment what the write just changed. The key is no
 * beginning of the key of a booking (`['own', 'bookings', id]`), so what
 * takes the lists away leaves the booking that was just written.
 */
export const OWN_BOOKING_LISTS = ['own', 'booking-lists']

/** Which of the bookings of a customer a list shows: the visits to come, or those that were. */
export type When = 'upcoming' | 'past'

/**
 * The list an address names. An address is also typed by hand: whatever
 * is not the list of the visits that were is the list of those to come.
 */
export const whenIn = (query: URLSearchParams): When =>
  query.get('when') === 'past' ? 'past' : 'upcoming'

/** The address of a list. The visits to come are the list without a query. */
export const listHrefOf = (when: When): string =>
  when === 'past' ? '/bookings?when=past' : '/bookings'

/**
 * What the API is asked for: the visits from today on, or those until
 * yesterday. A visit of today is one to come until the day is over.
 */
export const askedOf = (when: When, today: string): OwnBookingsAsked =>
  when === 'past'
    ? { bookingDateTo: daysFrom(today, -1) }
    : { bookingDateFrom: today }

/** The states in which the API lets a customer cancel or move a booking */
const CHANGEABLE: Record<ModelsBookingStatusType, boolean> = {
  draft: true,
  pending: true,
  confirmed: true,
  in_progress: false,
  completed: false,
  cancelled: false,
  no_show: false,
}

/**
 * Whether the customer can still cancel the booking or move it: before it
 * begins, and while the salon has neither begun nor ended it. This decides
 * what the screen offers; the API decides again when it is asked.
 */
export const isChangeable = (
  {
    status,
    startTime,
  }: Pick<ModelsCustomerBookingResponse, 'status' | 'startTime'>,
  now: Date,
): boolean => CHANGEABLE[status] && Date.parse(startTime) > now.getTime()

/**
 * Whether the customer can move the booking themselves. The API moves a
 * booking that a free time can stand for: one service, with the member of
 * the staff the booking has. A booking the salon added to is the salon's
 * to move.
 */
export const isMovable = ({
  staffId,
  services,
}: Pick<ModelsCustomerBookingResponse, 'staffId' | 'services'>): boolean => {
  const [only, ...others] = services

  return others.length === 0 && only?.staffId === staffId
}

/**
 * The address of the screen that moves a booking. It opens with what the
 * booking has: its member of the staff, and its day.
 */
export const moveHrefOf = ({
  id,
  staffId,
  bookingDate,
}: Pick<
  ModelsCustomerBookingResponse,
  'id' | 'staffId' | 'bookingDate'
>): string =>
  `/bookings/${id}/reschedule?${queryOf({ staffId, date: bookingDate })}`

/** The service a booking is named after: the first it has. */
export const serviceIdOf = ({
  services,
}: Pick<ModelsCustomerBookingResponse, 'services'>): string | undefined =>
  services.at(0)?.serviceId

type ServiceOfSalon = { salonId: string; serviceId: string }

/**
 * The salons and the services that bookings name, each once and in the
 * order they are first named: what a list reads besides the bookings.
 */
export const namedBy = (
  bookings: readonly Pick<
    ModelsCustomerBookingResponse,
    'salonId' | 'services'
  >[],
): { salonIds: string[]; services: ServiceOfSalon[] } => ({
  salonIds: [...new Set(bookings.map(({ salonId }) => salonId))],
  services: [
    ...new Map(
      bookings.flatMap((booking): [string, ServiceOfSalon][] => {
        const serviceId = serviceIdOf(booking)

        return serviceId === undefined
          ? []
          : [[serviceId, { salonId: booking.salonId, serviceId }]]
      }),
    ).values(),
  ],
})

type SalonRead =
  | { type: 'found'; salon: Pick<ModelsSalonResponse, 'name' | 'timezone'> }
  | NotFound
  | Unread

type NameRead =
  | { type: 'found'; service: Pick<ModelsServiceResponse, 'name'> }
  | NotFound
  | Unread

/** What was read of the salons and the services so far; `undefined` for what is on its way. */
export type Named = {
  salon: (salonId: string) => SalonRead | undefined
  service: (serviceId: string) => NameRead | undefined
}

/** A booking in a list, with the names it is read by. */
export type Row = {
  booking: ModelsCustomerBookingResponse
  /**
   * The salon: its name, and the time zone the times of the booking are
   * read in. `null` when the salon is no longer there
   */
  salon: Pick<ModelsSalonResponse, 'name' | 'timezone'> | null
  /** `null` when the salon no longer shows the service */
  serviceName: string | null
}

/** Why the rows of a list end before its bookings do */
type Unnamed = { type: 'reading' } | { type: 'unread'; reason: Unread }

type Rows = {
  rows: Row[]
  /**
   * Why the rows end where they do: every booking has its row (`none`),
   * the names of the next one are on their way (`reading`), or they could
   * not be read
   */
  rest: { type: 'none' } | Unnamed
}

const UNNAMED: NotFound = { type: 'notFound' }

const rowOf = (
  booking: ModelsCustomerBookingResponse,
  named: Named,
): { type: 'named'; row: Row } | Unnamed => {
  const serviceId = serviceIdOf(booking)
  const salon = named.salon(booking.salonId)
  const service = serviceId === undefined ? UNNAMED : named.service(serviceId)
  if (salon === undefined || service === undefined) {
    return { type: 'reading' }
  }
  if (salon.type === 'tooManyRequests' || salon.type === 'failed') {
    return { type: 'unread', reason: salon }
  }
  if (service.type === 'tooManyRequests' || service.type === 'failed') {
    return { type: 'unread', reason: service }
  }

  return {
    type: 'named',
    row: {
      booking,
      salon: salon.type === 'found' ? salon.salon : null,
      serviceName: service.type === 'found' ? service.service.name : null,
    },
  }
}

/**
 * The rows of a list: the bookings in their order, as far as their names
 * are read. A booking is shown whole or not yet, so the rows end at the
 * first whose salon or service is not read; a salon or a service that is
 * no longer there is read, and has no name.
 */
export const rowsOf = (
  bookings: readonly ModelsCustomerBookingResponse[],
  named: Named,
): Rows => {
  const read = bookings.map((booking) => rowOf(booking, named))
  const end = read.findIndex(({ type }) => type !== 'named')
  const unnamed = read.at(end)

  return {
    rows: read
      .slice(0, end === -1 ? read.length : end)
      .flatMap((one) => (one.type === 'named' ? [one.row] : [])),
    rest:
      end === -1 || unnamed === undefined || unnamed.type === 'named'
        ? { type: 'none' }
        : unnamed,
  }
}
