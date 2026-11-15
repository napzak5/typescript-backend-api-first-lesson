import { type DomainError, DomainErrors } from '../../shared'

/**
 * Why something that bookings refer to is not deleted: one of them is not
 * finished. The visit still expects its salon, its customer, its staff
 * members and its services; the bookings are completed, cancelled or
 * removed first.
 */
export const unfinishedBookingsReferTo = (
  referred: 'customer' | 'salon' | 'service' | 'staff member',
): DomainError =>
  DomainErrors.conflict(
    `The ${referred} cannot be deleted: bookings that are not finished refer to it`,
  )
