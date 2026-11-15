import type { Result } from '@beauty-salon-backend/utility'
import type { UserId } from '../models/auth'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type { DbStaffInvitation, SalonRole } from '../models/staff-invitation'
import type { DomainError } from '../shared'
import type { MailedToken } from './user.repository'

/** What an invitation is issued with; the address is the ledger's. */
export type StaffInvitationIssue = {
  role: SalonRole
  token: MailedToken
  /**
   * The invitation the staff member holds was mailed moments ago when it
   * ends after this. It stays then, and nothing is written.
   */
  mailedMomentsAgoIfEndingAfter: string
}

export type IssuedStaffInvitation =
  /** `salonName` is the name of the salon, for the mail. */
  | { type: 'issued'; invitation: DbStaffInvitation; salonName: string }
  | { type: 'staffNotFound' }
  /** The staff member has an account. */
  | { type: 'linked' }
  | { type: 'inactive' }
  | { type: 'mailedMomentsAgo' }

export type HeldStaffInvitation =
  | { type: 'held'; invitation: DbStaffInvitation }
  | { type: 'staffNotFound' }
  | { type: 'none' }

export type RevokedStaffInvitation =
  | { type: 'revoked' }
  | { type: 'staffNotFound' }
  | { type: 'none' }

export type UsableStaffInvitation =
  | { type: 'usable'; invitation: DbStaffInvitation }
  | { type: 'unusable' }
  /**
   * The address of the invitation has an account that is not the
   * invitation's to take, and that does not join either.
   */
  | { type: 'accountExists'; invitation: DbStaffInvitation }
  /**
   * The address of the invitation has an account that joins: one with a
   * role of a salon that reaches no salon.
   */
  | { type: 'accountMayJoin'; invitation: DbStaffInvitation }

/** The account an accepted invitation creates. */
export type StaffInvitationAcceptance = {
  passwordHash: string
  at: string
}

export type AcceptedStaffInvitation =
  | { type: 'accepted' }
  | { type: 'unusable' }
  | { type: 'accountExists' }

export type JoinedStaffInvitation =
  | { type: 'joined' }
  | { type: 'unusable' }
  /** The invitation went to another address than the one of the account. */
  | { type: 'otherAddress' }
  /**
   * The account is not one that joins: it reaches a salon, or its role is
   * not a role of a salon.
   */
  | { type: 'accountNotFree' }

/**
 * Persistence of the invitations of staff members.
 *
 * The methods that are given a salon answer `staffNotFound` when the salon
 * has no such staff member, or has one that is deleted. Whether the salon
 * itself exists is not looked at there.
 *
 * An invitation is usable while it could be issued: its token has not
 * ended, its staff member is active, not deleted, has no account and has
 * the address of the invitation in the ledger, and the salon is not
 * deleted. Every method that writes locks the staff member first, as the
 * ledger does, so that of two writes that arrive together the second sees
 * what the first did.
 *
 * An account joins an invitation when it has a role of a salon and reaches
 * no salon: it names no staff member, or one that is deleted or inactive,
 * or one of a salon that is deleted. Those are the accounts the
 * authentication gives the scope `none`.
 */
export interface IStaffInvitationRepository {
  findByStaff(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<HeldStaffInvitation, DomainError>>

  /**
   * Gives the staff member a new invitation, which takes the place of the
   * one they hold. Its address is the one the ledger has at that moment.
   */
  issue(
    salonId: SalonId,
    staffId: StaffId,
    issue: StaffInvitationIssue,
  ): Promise<Result<IssuedStaffInvitation, DomainError>>

  revoke(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<RevokedStaffInvitation, DomainError>>

  /** The invitation of this token, if it is usable at `now`. Nothing is used up. */
  findUsable(
    tokenHash: string,
    now: string,
  ): Promise<Result<UsableStaffInvitation, DomainError>>

  /**
   * Creates the account of the invitation of this token, links it to the
   * staff member and deletes the invitation, in one transaction. The
   * account has the address and the role of the invitation, is active and
   * its address counts as verified, because the token came through the
   * mailbox. An account of that address that never confirmed it becomes
   * this account; any other one stands in the way, and nothing is written.
   */
  accept(
    tokenHash: string,
    acceptance: StaffInvitationAcceptance,
  ): Promise<Result<AcceptedStaffInvitation, DomainError>>

  /**
   * Links the account of this user to the staff member of the invitation
   * of this token, gives the account the role of the invitation and
   * deletes the invitation, in one transaction. The invitation must be
   * usable at `now` and have gone to the address of the account. The
   * staff member the account named before, if any, names the account no
   * more.
   */
  join(
    tokenHash: string,
    userId: UserId,
    now: string,
  ): Promise<Result<JoinedStaffInvitation, DomainError>>
}
