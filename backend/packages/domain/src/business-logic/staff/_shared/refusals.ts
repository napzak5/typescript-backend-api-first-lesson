import {
  entityMessages,
  staffMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import type { StaffId } from '../../../models/staff'
import { type DomainError, DomainErrors } from '../../../shared'

export const staffNotFound = (id: StaffId): DomainError =>
  DomainErrors.notFound(entityMessages.staffMember, id)

export const ownRecordStaysActive = (): DomainError =>
  DomainErrors.conflict(staffMessages.ownRecordStaysActive)

export const ownRecordStays = (): DomainError =>
  DomainErrors.conflict(staffMessages.ownRecordStays)
