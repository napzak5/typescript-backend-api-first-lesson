import { UNREAD_TYPES } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonRoleType,
  ModelsStaffAccountResponse,
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
  ModelsTwoFactorStatusType,
  ModelsUserAccountStatusType,
} from '@beauty-salon-frontend/api-client'
import type { NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match, P } from 'ts-pattern'
import type { AccountRead, InvitationRead } from '../api/accounts-api'

/*
 * The words of the account of a member of the staff and of the invitation
 * that makes it, and what the account that keeps them may do.
 */

const { words, roles: ROLE_WORDS } = adminStaffAccountMessages

const ROLE_NAMES: Record<ModelsSalonRoleType, LocalizedText> =
  termMessages.salonRole

/** A role of an account of a salon, in words. */
export const roleNameOf = (role: ModelsSalonRoleType): LocalizedText =>
  ROLE_NAMES[role]

/** The roles an account of the role may give: that of an owner only an administrator gives. */
export const rolesGivenBy = (role: string): ModelsSalonRoleType[] =>
  role === 'admin' ? ['owner', 'manager', 'staff'] : ['manager', 'staff']

/** What the roles let an account do, and, to an account that may not give it, who gives that of an owner. */
export const roleDescriptionFor = (role: string): LocalizedText =>
  role === 'admin' ? ROLE_WORDS.forAdministrators : ROLE_WORDS.forOthers

/** The roles an account may give, as the choices of a form. */
export const roleOptionsOf = (
  roles: readonly ModelsSalonRoleType[],
): NamedChoice[] =>
  roles.map((role) => ({ value: role, label: roleNameOf(role) }))

const STATUS_NAMES: Record<ModelsUserAccountStatusType, LocalizedText> =
  words.statuses

/** What the state of an account means for the member who signs in with it */
const STATUS_NOTES: Record<
  ModelsUserAccountStatusType,
  LocalizedText | undefined
> = { active: undefined, ...words.statusNotes }

/** The state of an account, in words. */
export const statusNameOf = (
  status: ModelsUserAccountStatusType,
): LocalizedText => STATUS_NAMES[status]

/** What the state of an account means, when it is not the state of an account in use. */
export const statusNoteOf = (
  status: ModelsUserAccountStatusType,
): LocalizedText | undefined => STATUS_NOTES[status]

const TWO_FACTOR_NAMES: Record<ModelsTwoFactorStatusType, LocalizedText> =
  words.twoFactorStatuses

/** Whether an account asks for a code of an authenticator at sign-in, in words. */
export const twoFactorNameOf = (
  status: ModelsTwoFactorStatusType,
): LocalizedText => TWO_FACTOR_NAMES[status]

/** Whether an account is that of the session itself, which may not change its own role or link. */
export const isOwnAccount = (
  account: ModelsStaffAccountResponse,
  userId: string | undefined,
): boolean => account.id === userId

/** The same address of mail, whatever the case of its letters. */
export const sameAddress = (one: string, other: string): boolean =>
  one.toLowerCase() === other.toLowerCase()

/**
 * Whether an invitation can still be taken, and why not: the member was
 * made inactive, the ledger has another address for them now, or the
 * invitation expired. The API refuses them all alike.
 */
export type InvitationState = 'waiting' | 'inactive' | 'elsewhere' | 'expired'

/** Whether an invitation can be taken now. */
export const invitationStateOf = (
  invitation: ModelsStaffInvitationResponse,
  member: ModelsStaffResponse,
  now: Date,
): InvitationState => {
  if (!member.isActive) {
    return 'inactive'
  }
  if (!sameAddress(invitation.email, member.email)) {
    return 'elsewhere'
  }

  return new Date(invitation.expiresAt).getTime() <= now.getTime()
    ? 'expired'
    : 'waiting'
}

/** What a member has to sign in with, as the screen shows it */
type Login =
  | { type: 'account'; account: ModelsStaffAccountResponse }
  | { type: 'invited'; invitation: ModelsStaffInvitationResponse }
  /** Neither an account nor an invitation */
  | { type: 'none' }

/** What the screen shows of the two reads: what was not read, or what the member has to sign in with. */
export type LoginShown =
  | Login
  | { type: 'loading' }
  | { type: 'forbidden' }
  | { type: 'unread'; reads: (AccountRead | InvitationRead | undefined)[] }

/**
 * What a member has to sign in with, from the account and the invitation
 * read side by side: an account if one is linked, else an invitation if
 * the member has one. A refusal comes first, as it holds for both; an
 * account that is found is shown though the invitation is still read.
 */
export const loginOf = (
  account: AccountRead | undefined,
  invitation: InvitationRead | undefined,
): LoginShown => {
  if (account?.type === 'forbidden' || invitation?.type === 'forbidden') {
    return { type: 'forbidden' }
  }
  if (account?.type === 'found') {
    return { type: 'account', account: account.account }
  }
  if (account === undefined || invitation === undefined) {
    return { type: 'loading' }
  }
  const unread: LoginShown = { type: 'unread', reads: [account, invitation] }
  if (account.type !== 'notFound') {
    return unread
  }

  return match(invitation)
    .returnType<LoginShown>()
    .with({ type: 'found' }, (read) => ({
      type: 'invited',
      invitation: read.invitation,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'none' }))
    .with({ type: P.union(...UNREAD_TYPES) }, () => unread)
    .exhaustive()
}
