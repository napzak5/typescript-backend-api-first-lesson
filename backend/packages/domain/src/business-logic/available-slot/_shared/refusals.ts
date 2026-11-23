import { availableSlotMessages } from '@beauty-salon-shared/i18n/messages/api'
import { type DomainError, DomainErrors } from '../../../shared'

/**
 * The hours of a salon are times of its clocks. A salon whose time zone
 * the runtime does not know has no time they could be told in.
 */
export const timeZoneUnknown = (): DomainError =>
  DomainErrors.conflict(availableSlotMessages.timeZoneUnknown)
