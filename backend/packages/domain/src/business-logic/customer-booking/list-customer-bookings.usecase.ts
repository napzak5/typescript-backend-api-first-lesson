import { Result } from '@beauty-salon-backend/utility'
import { CustomerBookingReadMapper } from '../../mappers/read/customer-booking.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerBookingResponse } from '../../models/booking'
import type { ApiPaginationMeta } from '../../models/salon'
import { customerBookingSearchRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import { ownBookingsOf } from './_shared/access'
import type { CustomerBookingUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid booking search'

export type CustomerBookingPage = {
  data: ApiCustomerBookingResponse[]
  meta: ApiPaginationMeta
}

export class ListCustomerBookingsUseCase {
  constructor(
    private readonly dependencies: CustomerBookingUseCaseDependencies,
  ) {}

  /**
   * Lists the bookings of the signed-in customer by the time they begin,
   * earliest first: those they made and those a salon entered for them, in
   * whatever status. The cursor of a page is the ID of its last booking,
   * and one that names no booking of the customer is refused.
   *
   * Whether the actor has bookings of their own is decided before the
   * request is looked at, which is why the query arrives as the caller
   * decoded it.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<CustomerBookingPage, DomainError>> {
    const reach = ownBookingsOf(actor)
    if (reach.type === 'error') {
      return reach
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(
      customerBookingSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { cursor, status, bookingDateFrom, bookingDateTo } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.bookingRepository.list({
      reach: reach.data,
      limit,
      after: cursor ?? null,
      salonId: null,
      customerId: null,
      staffId: null,
      status: status ?? null,
      bookingDateFrom: bookingDateFrom ?? null,
      bookingDateTo: bookingDateTo ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [notFound('cursor', 'a booking')]),
      )
    }

    const { bookings, total, hasMore } = listed.data
    const lastBookingId = bookings.at(-1)?.booking.id ?? null

    return Result.map(
      CustomerBookingReadMapper.toApiCustomerBookings(bookings),
      (data) => ({
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
      }),
    )
  }
}
