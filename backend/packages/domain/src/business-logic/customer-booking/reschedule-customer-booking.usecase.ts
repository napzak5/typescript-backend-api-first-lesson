import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'
import { CustomerBookingReadMapper } from '../../mappers/read/customer-booking.mapper'
import { CustomerBookingWriteMapper } from '../../mappers/write/customer-booking.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerBookingResponse,
  parseBookingId,
} from '../../models/booking'
import { bookingRescheduleRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { cannotBeRescheduled } from '../booking/_shared/refusals'
import { ownBookingsOf } from './_shared/access'
import type { CustomerBookingUseCaseDependencies } from './_shared/dependencies'
import { toBookingRefusalError } from './_shared/refusals'

const MESSAGE = 'Invalid booking reschedule'

export class RescheduleCustomerBookingUseCase {
  constructor(
    private readonly dependencies: CustomerBookingUseCaseDependencies,
  ) {}

  /**
   * Moves a booking of the signed-in customer to another slot: another
   * time, another staff member, or both. The booking is a draft, pending
   * or confirmed, has not begun, and is for one service with the staff
   * member in charge; what the salon made more of is the salon's to move.
   * The slot is one the list of available slots would offer for the
   * service at that moment if the booking were not there, for as long as
   * the booking takes. A confirmed booking waits for the salon again.
   *
   * A request that names the time and the staff member the booking has
   * changes nothing and returns the booking.
   *
   * Whether the actor has bookings of their own is decided before the ID
   * and the request are looked at, the ID before the request, and both
   * before the booking is looked up. A booking of another customer is
   * answered like one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiCustomerBookingResponse, DomainError>> {
    const reach = ownBookingsOf(actor)
    if (reach.type === 'error') {
      return reach
    }

    const bookingId = parseBookingId(id)
    if (bookingId.type === 'error') {
      return bookingId
    }
    const request = parseWith(bookingRescheduleRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const { bookingRepository, clock } = this.dependencies
    const rebooked = await bookingRepository.rebook(
      bookingId.data,
      reach.data,
      CustomerBookingWriteMapper.fromRescheduleRequest(request.data),
      { changedBy: actor.userId, now: clock() },
    )
    if (rebooked.type === 'error') {
      return rebooked
    }

    return match(rebooked.data)
      .returnType<Result<ApiCustomerBookingResponse, DomainError>>()
      .with({ type: P.union('rescheduled', 'unchanged') }, ({ booking }) =>
        CustomerBookingReadMapper.toApiCustomerBooking(booking),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Booking', bookingId.data)),
      )
      .with({ type: 'statusDoesNotAllow' }, (refusal) =>
        Result.error(cannotBeRescheduled(refusal)),
      )
      .with({ type: 'alreadyBegun' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The time of the booking has come, so the customer cannot move it any more; the salon notes what became of the visit',
          ),
        ),
      )
      .with({ type: 'notOneSlot' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The booking has several services, or a service with another staff member than the one in charge, so the customer cannot move it; contact the salon to move it',
          ),
        ),
      )
      .with(
        {
          type: P.union(
            'profileNotFound',
            'invalid',
            'timeZoneUnknown',
            'hoursUnreadable',
            'customerNotAccepted',
            'notASlot',
            'customerOccupied',
          ),
        },
        (refusal) =>
          Result.error(toBookingRefusalError(refusal, actor, MESSAGE)),
      )
      .exhaustive()
  }
}
