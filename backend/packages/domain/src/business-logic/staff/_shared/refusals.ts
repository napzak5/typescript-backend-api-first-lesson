import type { StaffId } from '../../../models/staff'
import { type DomainError, DomainErrors } from '../../../shared'

export const staffNotFound = (id: StaffId): DomainError =>
  DomainErrors.notFound('Staff member', id)

export const ownRecordStaysActive = (): DomainError =>
  DomainErrors.conflict('You cannot deactivate your own staff record')

export const ownRecordStays = (): DomainError =>
  DomainErrors.conflict('You cannot delete your own staff record')
