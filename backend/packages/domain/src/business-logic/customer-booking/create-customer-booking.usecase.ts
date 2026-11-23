import { Result } from '@beauty-salon-backend/utility'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { CustomerBookingReadMapper } from '../../mappers/read/customer-booking.mapper'
import { CustomerBookingWriteMapper } from '../../mappers/write/customer-booking.mapper'
import type { Actor, ClientInfo } from '../../models/auth'
import type { ApiCustomerBookingResponse } from '../../models/booking'
import { customerBookingCreateRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, parseWith } from '../../shared'
import { underFreeNumber } from '../_shared/numbered'
import { ownBookingsOf } from './_shared/access'
import type { CustomerBookingUseCaseDependencies } from './_shared/dependencies'
import { toBookingRefusalError } from './_shared/refusals'

const MESSAGE = bookingMessages.invalidBooking

export class CreateCustomerBookingUseCase {
  constructor(
    private readonly dependencies: CustomerBookingUseCaseDependencies,
  ) {}

  /**
   * Books a slot for the signed-in customer: one service with one staff
   * member of a salon, at a time the list of available slots offers at
   * that moment. Whether the actor has bookings of their own is decided
   * before the request is read.
   *
   * What a customer books is held to everything the salon has set for the
   * bookings of its customers, and the booking waits as `pending` for the
   * salon to confirm it. Everything else of the booking is what the salon
   * would have entered for the same visit.
   */
  async execute(
    actor: Actor,
    input: unknown,
    client: ClientInfo,
  ): Promise<Result<ApiCustomerBookingResponse, DomainError>> {
    const reach = ownBookingsOf(actor)
    if (reach.type === 'error') {
      return reach
    }

    const request = parseWith(
      customerBookingCreateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }

    const requested = CustomerBookingWriteMapper.fromCreateRequest(request.data)

    const { bookingRepository, bookingNumberIssuer, clock } = this.dependencies
    const { customerId } = reach.data

    return underFreeNumber(
      'booking',
      bookingNumberIssuer,
      async (bookingNumber) => {
        const booked = await bookingRepository.book(
          requested,
          { customerId, now: clock() },
          { bookingNumber, createdBy: actor.userId, client },
        )
        if (booked.type === 'error') {
          return booked
        }

        return match(booked.data)
          .returnType<Result<ApiCustomerBookingResponse, DomainError> | null>()
          .with({ type: 'created' }, ({ booking }) =>
            CustomerBookingReadMapper.toApiCustomerBooking(booking),
          )
          .with({ type: 'bookingNumberTaken' }, () => null)
          .with(
            { type: P.not(P.union('created', 'bookingNumberTaken')) },
            (refusal) =>
              Result.error(toBookingRefusalError(refusal, actor, MESSAGE)),
          )
          .exhaustive()
      },
    )
  }
}
