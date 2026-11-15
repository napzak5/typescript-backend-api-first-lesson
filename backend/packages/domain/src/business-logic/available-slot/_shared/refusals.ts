import { type DomainError, DomainErrors } from '../../../shared'

/**
 * The hours of a salon are times of its clocks. A salon whose time zone
 * the runtime does not know has no time they could be told in.
 */
export const timeZoneUnknown = (): DomainError =>
  DomainErrors.conflict(
    'The time zone of the salon is not one that is known, so the times of its hours cannot be told; correct the time zone of the salon first',
  )
