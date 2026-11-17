import { type DomainError, DomainErrors } from '../../../shared'

/**
 * A stored salon whose time zone the runtime does not know: the API takes
 * only time zones the runtime knows.
 */
export const unknownTimeZone = (
  salonId: string,
  timezone: string,
): DomainError =>
  DomainErrors.database(
    `Stored salon ${salonId} has a time zone the runtime does not know`,
    timezone,
  )
