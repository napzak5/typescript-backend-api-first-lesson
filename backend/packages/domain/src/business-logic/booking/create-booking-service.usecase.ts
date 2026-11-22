import { Result } from '@beauty-salon-backend/utility'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import { BookingWriteMapper } from '../../mappers/write/booking.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiBookingServiceResponse,
  parseBookingIdOfPath,
} from '../../models/booking'
import { bookingServiceCreateRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { bookingReachOf } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'
import {
  amountsTooBig,
  servicesAreSettled,
  toRefusalError,
} from './_shared/refusals'

const MESSAGE = bookingMessages.invalidBookingService

export class CreateBookingServiceUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Adds a service line to a booking that is not finished: before the
   * visit, or while it is under way. The line is a copy of its service as
   * the service is then, it comes after the lines the booking has, and
   * the booking says of its lines again when the visit is and what it
   * costs.
   *
   * As for a booking that is entered, the line is held to what keeps the
   * ledger sound: the service and the staff member are of the salon, and
   * the staff member is not occupied by more bookings than they take at
   * once. A booking keeps to one visit and to the number of lines a
   * booking holds.
   */
  async execute(
    actor: Actor,
    booking: unknown,
    input: unknown,
  ): Promise<Result<ApiBookingServiceResponse, DomainError>> {
    const reach = bookingReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const bookingId = parseBookingIdOfPath(booking)
    if (bookingId.type === 'error') {
      return bookingId
    }
    const request = parseWith(bookingServiceCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const added = await this.dependencies.bookingRepository.addService(
      bookingId.data,
      reach,
      BookingWriteMapper.fromServiceCreateRequest(request.data),
    )
    if (added.type === 'error') {
      return added
    }

    return match(added.data)
      .returnType<Result<ApiBookingServiceResponse, DomainError>>()
      .with({ type: 'added' }, ({ service }) =>
        BookingReadMapper.toApiBookingService(service),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Booking', bookingId.data)),
      )
      .with({ type: 'statusDoesNotAllow' }, (refusal) =>
        Result.error(servicesAreSettled(refusal)),
      )
      .with({ type: 'tooManyServices' }, ({ limit }) =>
        Result.error(
          DomainErrors.conflict(`A booking has at most ${limit} services`),
        ),
      )
      .with({ type: 'visitTooLong' }, ({ hours }) =>
        Result.error(
          DomainErrors.conflict(
            `Every service of a booking begins within ${hours} hours of the earliest one`,
          ),
        ),
      )
      .with(
        { type: P.union('invalid', 'timeZoneUnknown', 'staffOccupied') },
        (refusal) => Result.error(toRefusalError(refusal, MESSAGE)),
      )
      .with({ type: 'amountsTooBig' }, () => Result.error(amountsTooBig()))
      .exhaustive()
  }
}
