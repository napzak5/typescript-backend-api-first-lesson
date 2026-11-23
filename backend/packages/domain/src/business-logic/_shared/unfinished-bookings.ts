import { bookingMessages } from '@beauty-salon-shared/i18n/messages/api'
import { type DomainError, DomainErrors } from '../../shared'

/**
 * Why something that bookings refer to is not deleted: one of them is not
 * finished. The visit still expects its salon, its customer, its staff
 * members and its services; the bookings are completed, cancelled or
 * removed first.
 */
export const unfinishedBookingsReferTo = (
  referred: keyof typeof bookingMessages.unfinishedBookingsReferTo,
): DomainError =>
  DomainErrors.conflict(bookingMessages.unfinishedBookingsReferTo[referred])
