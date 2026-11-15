import { Result } from '@beauty-salon-backend/utility'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import type { Actor } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import type { ApiPaginationMeta } from '../../models/salon'
import { bookingSearchRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { bookingReachOf, isWithin } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid booking search'

export type BookingPage = {
  data: ApiBookingResponse[]
  meta: ApiPaginationMeta
}

export class ListBookingsUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Lists the bookings the actor reaches by the time they begin, earliest
   * first. The cursor of a page is the ID of its last booking, and one that
   * names no booking the actor reaches is refused.
   *
   * Whether the actor keeps a booking ledger is decided before the request
   * is looked at, which is why the query arrives as the caller decoded it.
   * A member of a salon is listed the bookings of that salon and is
   * refused when the query names another; an administrator is listed those
   * of every salon, or of the one the query names.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<BookingPage, DomainError>> {
    const reach = bookingReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(bookingSearchRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const {
      cursor,
      salonId,
      customerId,
      staffId,
      status,
      bookingDateFrom,
      bookingDateTo,
    } = request.data
    if (salonId !== undefined && !isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.bookingRepository.list({
      reach,
      limit,
      after: cursor ?? null,
      salonId: salonId ?? null,
      customerId: customerId ?? null,
      staffId: staffId ?? null,
      status: status ?? null,
      bookingDateFrom: bookingDateFrom ?? null,
      bookingDateTo: bookingDateTo ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a booking',
          },
        ]),
      )
    }

    const { bookings, total, hasMore } = listed.data
    const lastBookingId = bookings.at(-1)?.booking.id ?? null

    return Result.map(BookingReadMapper.toApiBookings(bookings), (data) => ({
      data,
      meta: {
        total,
        limit,
        hasMore,
        cursor: cursor ?? null,
        nextCursor: hasMore ? lastBookingId : null,
        // Pages are only walked forwards.
        prevCursor: null,
      },
    }))
  }
}
