import type { StaffId } from '../../../models/staff'
import { type DomainError, DomainErrors } from '../../../shared'
import { mailedTokenRefused } from '../../auth/_shared/mailed-token'

export const invitationNotFound = (id: StaffId): DomainError =>
  DomainErrors.notFound('Invitation of staff member', id)

export const alreadyHasAccount = (id: StaffId): DomainError =>
  DomainErrors.conflict(`Staff member ${id} already has an account`)

/** An invitation gives the salon, and an inactive staff member has none. */
export const inactiveStaffStaysOut = (id: StaffId): DomainError =>
  DomainErrors.conflict(`Staff member ${id} is inactive`)

export const mailedMomentsAgo = (id: StaffId): DomainError =>
  DomainErrors.conflict(
    `An invitation was mailed to staff member ${id} moments ago`,
  )

/** One answer for an invitation that cannot be used, whatever the reason. */
export const invitationRefused = (): DomainError =>
  mailedTokenRefused('Invalid staff invitation')

/**
 * Told to whoever holds the token, and so reads the mailbox of the
 * address: nobody else learns from it that the address has an account.
 */
export const addressHasAccount = (email: string): DomainError =>
  DomainErrors.alreadyExists('User', 'email', email)
