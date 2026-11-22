import { Result } from '@beauty-salon-backend/utility'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import { BookingWriteMapper } from '../../mappers/write/booking.mapper'
import type { Actor } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import type { ApiPage } from '../../models/page'
import { bookingSearchRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { bookingReachOf, isWithin } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = bookingMessages.invalidBookingSearch

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
  ): Promise<Result<ApiPage<ApiBookingResponse>, DomainError>> {
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
    const criteria = BookingWriteMapper.fromSearchRequest(request.data, reach)
    if (criteria.salonId !== null && !isWithin(reach, criteria.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const listed = await this.dependencies.bookingRepository.list(criteria)
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

    return BookingReadMapper.toApiBookingPage(listed.data, criteria)
  }
}
