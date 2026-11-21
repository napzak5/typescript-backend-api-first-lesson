import { UNREAD_TYPES } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonRoleType,
  ModelsStaffAccountResponse,
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
  ModelsTwoFactorStatusType,
  ModelsUserAccountStatusType,
} from '@beauty-salon-frontend/api-client'
import type { ChoiceOption } from '@beauty-salon-frontend/ui'
import { match, P } from 'ts-pattern'
import type { AccountRead, InvitationRead } from './accounts-api'

/*
 * The words of the account of a member of the staff and of the invitation
 * that makes it, and what the account that keeps them may do.
 */

const ROLE_NAMES: Record<ModelsSalonRoleType, string> = {
  owner: 'オーナー',
  manager: 'マネージャー',
  staff: 'スタッフ',
}

/** A role of an account of a salon, in words. */
export const roleNameOf = (role: ModelsSalonRoleType): string =>
  ROLE_NAMES[role]

/** The roles an account of the role may give: that of an owner only an administrator gives. */
export const rolesGivenBy = (role: string): ModelsSalonRoleType[] =>
  role === 'admin' ? ['owner', 'manager', 'staff'] : ['manager', 'staff']

const WHAT_ROLES_DO =
  'オーナーは、スタッフ台帳とログインアカウントも扱います。マネージャーは、シフトを組み、売上の取り消しや顧客台帳からの削除もします。スタッフは、予約と施術記録を扱い、自分のシフトを見ます。'

/** What the roles let an account do, and, to an account that may not give it, who gives that of an owner. */
export const roleDescriptionFor = (role: string): string =>
  role === 'admin'
    ? WHAT_ROLES_DO
    : `${WHAT_ROLES_DO}オーナーのロールを与えられるのは、管理者です。`

/** The roles an account may give, as the choices of a form. */
export const roleOptionsOf = (
  roles: readonly ModelsSalonRoleType[],
): ChoiceOption[] =>
  roles.map((role) => ({ value: role, label: roleNameOf(role) }))

const STATUS_NAMES: Record<ModelsUserAccountStatusType, string> = {
  active: '有効',
  unverified: 'メールアドレスの確認待ち',
  inactive: '無効',
  locked: 'ロック中',
  suspended: '停止中',
  deleted: '削除済み',
}

/** What the state of an account means for the member who signs in with it */
const STATUS_NOTES: Record<ModelsUserAccountStatusType, string | undefined> = {
  active: undefined,
  unverified: 'メールアドレスの確認が済むまで、ログインできません。',
  inactive: 'このアカウントでは、ログインできません。',
  locked:
    'パスワードを続けて誤ったため、15 分の間、新しいログインができません。ログインしている端末は、そのまま使えます。すぐに解くのは、管理者の操作です。',
  suspended:
    'このアカウントは止められていて、ログインできません。止めたのは、管理者です。',
  deleted: 'このアカウントは、削除されています。',
}

/** The state of an account, in words. */
export const statusNameOf = (status: ModelsUserAccountStatusType): string =>
  STATUS_NAMES[status]

/** What the state of an account means, when it is not the state of an account in use. */
export const statusNoteOf = (
  status: ModelsUserAccountStatusType,
): string | undefined => STATUS_NOTES[status]

const TWO_FACTOR_NAMES: Record<ModelsTwoFactorStatusType, string> = {
  disabled: '設定していません',
  pending: '設定の途中です',
  enabled: '設定しています',
}

/** Whether an account asks for a code of an authenticator at sign-in, in words. */
export const twoFactorNameOf = (status: ModelsTwoFactorStatusType): string =>
  TWO_FACTOR_NAMES[status]

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
