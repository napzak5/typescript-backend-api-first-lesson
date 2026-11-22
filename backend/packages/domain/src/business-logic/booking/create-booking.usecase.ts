import { Result } from '@beauty-salon-backend/utility'
import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { BookingReadMapper } from '../../mappers/read/booking.mapper'
import { BookingWriteMapper } from '../../mappers/write/booking.mapper'
import type { Actor, ClientInfo } from '../../models/auth'
import type { ApiBookingResponse } from '../../models/booking'
import { bookingCreateRequestSchema } from '../../schemas/booking.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { underFreeNumber } from '../_shared/numbered'
import { bookingReachOf, isWithin } from './_shared/authorization'
import type { BookingUseCaseDependencies } from './_shared/dependencies'
import { toRefusalError } from './_shared/refusals'

const MESSAGE = bookingMessages.invalidBooking

export class CreateBookingUseCase {
  constructor(private readonly dependencies: BookingUseCaseDependencies) {}

  /**
   * Enters a booking into the ledger of a salon. Whether the actor keeps a
   * booking ledger at all is decided before the request is read, and
   * whether it is the ledger of the salon the request names, once the
   * request says which salon that is.
   *
   * What the salon enters is the salon's to judge: the request is held to
   * what keeps the ledger sound (everything it names is there and of that
   * salon, and no staff member is occupied by more bookings than they take
   * at once), and not to the opening hours, the schedules or to who and
   * what currently accepts bookings.
   */
  async execute(
    actor: Actor,
    input: unknown,
    client: ClientInfo,
  ): Promise<Result<ApiBookingResponse, DomainError>> {
    const reach = bookingReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(bookingCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const requested = BookingWriteMapper.fromCreateRequest(request.data)
    if (!isWithin(reach, requested.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const { bookingRepository, bookingNumberIssuer } = this.dependencies

    return underFreeNumber(
      'booking',
      bookingNumberIssuer,
      async (bookingNumber) => {
        const created = await bookingRepository.create(requested, {
          bookingNumber,
          createdBy: actor.userId,
          client,
        })
        if (created.type === 'error') {
          return created
        }

        return match(created.data)
          .returnType<Result<ApiBookingResponse, DomainError> | null>()
          .with({ type: 'created' }, ({ booking }) =>
            BookingReadMapper.toApiBooking(booking),
          )
          .with({ type: 'bookingNumberTaken' }, () => null)
          .with(
            { type: P.not(P.union('created', 'bookingNumberTaken')) },
            (refusal) => Result.error(toRefusalError(refusal, MESSAGE)),
          )
          .exhaustive()
      },
    )
  }
}
