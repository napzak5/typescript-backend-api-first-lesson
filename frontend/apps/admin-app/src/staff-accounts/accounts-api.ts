import {
  type ModelsSalonRoleType,
  type ModelsStaffAccountResponse,
  type ModelsStaffInvitationResponse,
  type ModelsStaffResponse,
  staffAccountsDelete,
  staffAccountsGet,
  staffAccountsUpdate,
  staffInvitationsCreate,
  staffInvitationsDelete,
  staffInvitationsGet,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  type Unread,
  unreadOf,
} from '../reading'
import { readStaffMember } from '../staff/staff-api'

/*
 * The account a member of the staff signs in with, as the owner of the
 * salon and an administrator keep it: the invitation that makes it, and
 * the account once the member has taken the invitation.
 */

const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key the account of a member is read under. */
export const accountKeyOf = (staffId: string): string[] => [
  'staff-account',
  staffId,
]

/** The key the invitation of a member is read under. */
export const invitationKeyOf = (staffId: string): string[] => [
  'staff-invitation',
  staffId,
]

/** The account linked to a member, or why there is none to show: no account is linked. */
export type AccountRead =
  | { type: 'found'; account: ModelsStaffAccountResponse }
  | NotFound
  | Forbidden
  | Unread

/** The account linked to a member of a salon. */
export const readAccount = async (
  salonId: string,
  staffId: string,
): Promise<AccountRead> => {
  const answer = await staffAccountsGet(salonId, staffId).catch(() => null)

  return (
    match(answer)
      .returnType<AccountRead>()
      .with({ status: 200 }, ({ data }) => ({
        type: 'found',
        account: data.data,
      }))
      // No account is linked to the member, nor to an ID that is no ID
      .with({ status: P.union(400, 404) }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** The invitation of a member that was not taken yet, or why there is none to show. */
export type InvitationRead =
  | { type: 'found'; invitation: ModelsStaffInvitationResponse }
  | NotFound
  | Forbidden
  | Unread

/** The invitation of a member of a salon: one that expired as well, until it is replaced or revoked. */
export const readInvitation = async (
  salonId: string,
  staffId: string,
): Promise<InvitationRead> => {
  const answer = await staffInvitationsGet(salonId, staffId).catch(() => null)

  return match(answer)
    .returnType<InvitationRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      invitation: data.data,
    }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** The member was invited less than a minute ago: the API does not mail them again so soon */
type Recent = { type: 'recent' }

const RECENT: Recent = { type: 'recent' }

/** What came of inviting a member. */
export type InvitationAttempt =
  | { type: 'invited'; invitation: ModelsStaffInvitationResponse }
  /** An invitation was taken meanwhile: the account it made */
  | { type: 'accepted'; account: ModelsStaffAccountResponse }
  /** The member was made inactive meanwhile */
  | { type: 'inactive'; member: ModelsStaffResponse }
  | Recent
  /** The member was removed meanwhile */
  | NotFound
  | Forbidden
  | Unread

/** The API refuses an invitation in one answer, whatever the reason */
type Refused = { type: 'refused' }

const REFUSED: Refused = { type: 'refused' }

const createInvitation = async (
  salonId: string,
  staffId: string,
  role: ModelsSalonRoleType,
): Promise<InvitationAttempt | Refused> => {
  const answer = await staffInvitationsCreate(salonId, staffId, {
    role,
  }).catch(() => null)

  return (
    match(answer)
      .returnType<InvitationAttempt | Refused>()
      .with({ status: 201 }, ({ data }) => ({
        type: 'invited',
        invitation: data.data,
      }))
      .with({ status: 409 }, () => REFUSED)
      .with({ status: 404 }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      // The screen sends only the roles the account may give
      .with({ status: P.union(400, 413, 415) }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/**
 * Why the API refused an invitation. It refuses a member who has an
 * account, a member who is inactive, and a member who was invited less
 * than a minute ago in the same words, and checks them in this order: the
 * account and the member are read again, in the same order.
 */
const whyRefused = async (
  salonId: string,
  staffId: string,
): Promise<InvitationAttempt> => {
  const account = await readAccount(salonId, staffId)
  if (account.type === 'found') {
    return { type: 'accepted', account: account.account }
  }
  if (account.type !== 'notFound') {
    return account
  }
  const member = await readStaffMember(salonId, staffId)

  return match(member)
    .returnType<InvitationAttempt>()
    .with({ type: 'found', member: { isActive: false } }, (read) => ({
      type: 'inactive',
      member: read.member,
    }))
    .with({ type: 'found' }, () => RECENT)
    .with({ type: 'notFound' }, () => NOT_FOUND)
    .with({ type: 'forbidden' }, () => FORBIDDEN)
    .with({ type: P.union('tooManyRequests', 'failed') }, (unread) => unread)
    .exhaustive()
}

/**
 * Mails a member an invitation to make the account they sign in with, at
 * the address the ledger has for them. An invitation the member had is
 * replaced: its link is of no use any more.
 */
export const attemptInvitation = async (
  salonId: string,
  staffId: string,
  role: ModelsSalonRoleType,
): Promise<InvitationAttempt> => {
  const created = await createInvitation(salonId, staffId, role)

  return created.type === 'refused' ? whyRefused(salonId, staffId) : created
}

/** There was nothing to change any more: the invitation was taken or revoked, the account unlinked, or the member removed */
type Gone = { type: 'gone' }

const GONE: Gone = { type: 'gone' }

/** What came of revoking an invitation. */
export type InvitationRevocation =
  | { type: 'revoked' }
  | Gone
  | Forbidden
  | Unread

/** Revokes the invitation of a member: the link that was mailed is of no use any more. */
export const revokeInvitation = async (
  salonId: string,
  staffId: string,
): Promise<InvitationRevocation> => {
  const answer = await staffInvitationsDelete(salonId, staffId).catch(
    () => null,
  )

  return match(answer)
    .returnType<InvitationRevocation>()
    .with({ status: 204 }, () => ({ type: 'revoked' }))
    .with({ status: P.union(400, 404) }, () => GONE)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** The account is the signed-in account itself, whose role and link it may not change */
type Own = { type: 'own' }

const OWN: Own = { type: 'own' }

/** What came of giving an account another role. */
export type RoleChange =
  | { type: 'changed'; account: ModelsStaffAccountResponse }
  | Gone
  | Own
  | Forbidden
  | Unread

/** Gives the account of a member another role: it has it from its next request on. */
export const changeRole = async (
  salonId: string,
  staffId: string,
  role: ModelsSalonRoleType,
): Promise<RoleChange> => {
  const answer = await staffAccountsUpdate(salonId, staffId, { role }).catch(
    () => null,
  )

  return match(answer)
    .returnType<RoleChange>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'changed',
      account: data.data,
    }))
    .with({ status: 404 }, () => GONE)
    .with({ status: 409 }, () => OWN)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(400, 413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of unlinking an account from a member. */
export type AccountUnlinking =
  | { type: 'unlinked' }
  | Gone
  | Own
  | Forbidden
  | Unread

/**
 * Unlinks the account from a member: it reaches the salon no more from its
 * next request on. The account and the member stay, and the member may be
 * invited again.
 */
export const unlinkAccount = async (
  salonId: string,
  staffId: string,
): Promise<AccountUnlinking> => {
  const answer = await staffAccountsDelete(salonId, staffId).catch(() => null)

  return match(answer)
    .returnType<AccountUnlinking>()
    .with({ status: 204 }, () => ({ type: 'unlinked' }))
    .with({ status: P.union(400, 404) }, () => GONE)
    .with({ status: 409 }, () => OWN)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
