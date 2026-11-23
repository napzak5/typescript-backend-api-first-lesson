import {
  entityMessages,
  staffInvitationMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import type { StaffId } from '../../../models/staff'
import { type DomainError, DomainErrors } from '../../../shared'
import { mailedTokenRefused } from '../../auth/_shared/mailed-token'

export const invitationNotFound = (id: StaffId): DomainError =>
  DomainErrors.notFound(entityMessages.invitationOfStaffMember, id)

export const alreadyHasAccount = (id: StaffId): DomainError =>
  DomainErrors.conflict(staffInvitationMessages.alreadyHasAccount(id))

/** An invitation gives the salon, and an inactive staff member has none. */
export const inactiveStaffStaysOut = (id: StaffId): DomainError =>
  DomainErrors.conflict(staffInvitationMessages.staffInactive(id))

export const mailedMomentsAgo = (id: StaffId): DomainError =>
  DomainErrors.conflict(staffInvitationMessages.mailedMomentsAgo(id))

/** One answer for an invitation that cannot be used, whatever the reason. */
export const invitationRefused = (): DomainError =>
  mailedTokenRefused(staffInvitationMessages.invalidStaffInvitation)

/**
 * Told to whoever holds the token, and so reads the mailbox of the
 * address: nobody else learns from it that the address has an account.
 */
export const addressHasAccount = (email: string): DomainError =>
  DomainErrors.alreadyExists(entityMessages.user, 'email', email)

/** Told to the account itself, which is signed in. */
export const accountBelongsToStaff = (): DomainError =>
  DomainErrors.conflict(staffInvitationMessages.accountBelongsToStaff)

/**
 * Told to whoever holds the token and is signed in to another account: the
 * token alone makes the invitation nobody's. Whether the token works they
 * can already ask.
 */
export const sentToAnotherAddress = (): DomainError =>
  DomainErrors.conflict(staffInvitationMessages.sentToAnotherAddress)
