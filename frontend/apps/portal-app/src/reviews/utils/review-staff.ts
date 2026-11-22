import type {
  ModelsCustomerBookingResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'

/**
 * The people a review of a visit can rate: who the booking was with, then
 * who did one of its services, each once, and of them those the salon
 * shows. The API takes nobody else, and a screen can name nobody else.
 */
export const reviewersOf = (
  booking: Pick<ModelsCustomerBookingResponse, 'staffId' | 'services'>,
  shown: readonly ModelsStaffProfileResponse[],
): ModelsStaffProfileResponse[] =>
  [
    ...new Set([
      booking.staffId,
      ...booking.services.flatMap(({ staffId }) =>
        staffId === null ? [] : [staffId],
      ),
    ]),
  ].flatMap((id) => shown.filter((member) => member.id === id))
