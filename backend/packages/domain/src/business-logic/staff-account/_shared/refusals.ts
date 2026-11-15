import type { StaffId } from '../../../models/staff'
import { type DomainError, DomainErrors } from '../../../shared'

export const accountNotFound = (id: StaffId): DomainError =>
  DomainErrors.notFound('Account of staff member', id)

/**
 * An owner who gave their own account another role could not take the
 * role of an owner back: only an administrator gives it.
 */
export const ownRoleStays = (): DomainError =>
  DomainErrors.conflict('You cannot change the role of your own account')

/** Unlinked, the actor's own account would reach the salon no more. */
export const ownAccountStaysLinked = (): DomainError =>
  DomainErrors.conflict('You cannot unlink your own account')
