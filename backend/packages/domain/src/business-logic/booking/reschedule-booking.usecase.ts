import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import type { Actor } from '../../models/auth'
import { type ApiBookingResponse, parseBookingId } from '../../models/booking'
import { bookingRescheduleRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { bookingReachOf } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'
import { cannotBeRescheduled, toRefusalError } from './_shared/refusals'

const MESSAGE = 'Invalid booking reschedule'

export class RescheduleBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Moves a booking that is a draft, pending or confirmed to another time
   * and to another staff member in charge. The service lines move with the
   * booking, and those of the staff member who was in charge go to the new
   * one. The status stays what it is.
   *
   * As for a booking that is entered, the move is held to what keeps the
   * ledger sound: the staff member is one of the salon, and no staff
   * member is occupied by more bookings than they take at once. The
   * opening hours and the schedules are the salon's to judge.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    const reach = bookingReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const bookingId = parseBookingId(id)
    if (bookingId.type === 'error') {
      return bookingId
    }
    const request = parseWith(bookingRescheduleRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const rescheduled = await this.dependencies.bookingRepository.reschedule(
      bookingId.data,
      reach,
      request.data,
    )
    if (rescheduled.type === 'error') {
      return rescheduled
    }

    return match(rescheduled.data)
      .returnType<Result<ApiBookingResponse, DomainError>>()
      .with({ type: 'rescheduled' }, ({ booking }) =>
        BookingReadMapper.toApiBooking(booking),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Booking', bookingId.data)),
      )
      .with({ type: 'statusDoesNotAllow' }, (refusal) =>
        Result.error(cannotBeRescheduled(refusal)),
      )
      .with(
        { type: P.union('invalid', 'timeZoneUnknown', 'staffOccupied') },
        (refusal) => Result.error(toRefusalError(refusal, MESSAGE)),
      )
      .exhaustive()
  }
}
