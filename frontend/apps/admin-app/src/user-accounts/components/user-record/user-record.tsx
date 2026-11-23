import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Card,
  DescriptionList,
  inJapanese,
  Note,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import {
  statusNameOf,
  statusNoteOf,
  twoFactorNameOf,
} from '../../../staff-accounts/utils/account-format'
import {
  failuresNameOf,
  ledgersOf,
  lockNameOf,
  lockNoteOf,
  lockOf,
  timeZoneNoteOf,
  userRoleNameOf,
} from '../../utils/user-accounts'

export type UserRecordProps = {
  user: ModelsUserResponse
  /** The moment the lock is weighed against: the time of the screen */
  now: Date
  /** The time zone of the device, which the moments are shown in */
  timezone: string
  /** The heading, which takes the focus when the account is shown after a write */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** What changed meanwhile, which the last attempt found: said above the record */
  meanwhile?: string | undefined
}

/**
 * The account of a user, as an administrator answers the user who asks
 * why they cannot sign in: the address and the role, the state and the
 * lock with the wrong passwords that brought it, the second factor, when
 * the password was changed and the account last signed in, from where,
 * and the ledgers it is linked to. A state or a lock that keeps the user
 * out says why.
 */
export const UserRecord = ({
  user,
  now,
  timezone,
  headingRef,
  meanwhile,
}: UserRecordProps) => {
  const lock = lockOf(user, now)
  // A locked state is said by the lock, with its moment
  const statusNote =
    user.status === 'locked' ? undefined : statusNoteOf(user.status)
  const lockNote = lockNoteOf(lock, timezone)

  return (
    <Card title='アカウントの状態' headingRef={headingRef}>
      {meanwhile !== undefined && <Alert tone='warning'>{meanwhile}</Alert>}
      <DescriptionList
        items={[
          {
            term: 'メールアドレス',
            description: user.email,
          },
          { term: 'ロール', description: userRoleNameOf(user.role) },
          { term: '状態', description: statusNameOf(user.status) },
          {
            term: 'メールアドレスの確認',
            description: user.emailVerified
              ? '確認済み'
              : 'まだ確認していません',
          },
          { term: 'ロック', description: lockNameOf(lock, timezone) },
          {
            term: 'パスワードの誤り',
            description: failuresNameOf(user.failedLoginAttempts),
          },
          {
            term: '2 要素認証',
            description: twoFactorNameOf(user.twoFactorStatus),
          },
          {
            term: 'パスワードの変更',
            description:
              user.lastPasswordChange === null
                ? 'まだ変えていません'
                : inJapanese(momentNameAt(user.lastPasswordChange, timezone)),
          },
          {
            term: '最後のログイン',
            description:
              user.lastLoginAt === null
                ? 'まだログインしていません'
                : inJapanese(momentNameAt(user.lastLoginAt, timezone)),
          },
          {
            term: '最後のログインの IP アドレス',
            description: user.lastLoginIp ?? '記録がありません',
          },
          { term: '紐づいている台帳', description: ledgersOf(user) },
          {
            term: '作った日時',
            description: inJapanese(momentNameAt(user.createdAt, timezone)),
          },
        ]}
      />
      {statusNote !== undefined && <Note>{statusNote}</Note>}
      {lockNote !== undefined && <Note>{lockNote}</Note>}
      <Note>{timeZoneNoteOf(timezone)}</Note>
    </Card>
  )
}
