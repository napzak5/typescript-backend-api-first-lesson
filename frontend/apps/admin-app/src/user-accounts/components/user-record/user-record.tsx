import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Card,
  DescriptionList,
  Note,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminUserAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
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

const { record } = adminUserAccountMessages
const { words } = record

export type UserRecordProps = {
  user: ModelsUserResponse
  /** The moment the lock is weighed against: the time of the screen */
  now: Date
  /** The time zone of the device, which the moments are shown in */
  timezone: string
  /** The heading, which takes the focus when the account is shown after a write */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** What changed meanwhile, which the last attempt found: said above the record */
  meanwhile?: LocalizedText | undefined
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
  const say = useSay()
  const lock = lockOf(user, now)
  // A locked state is said by the lock, with its moment
  const statusNote =
    user.status === 'locked' ? undefined : statusNoteOf(user.status)
  const lockNote = lockNoteOf(lock, timezone)

  return (
    <Card title={say(record.title)} headingRef={headingRef}>
      {meanwhile !== undefined && (
        <Alert tone='warning'>{say(meanwhile)}</Alert>
      )}
      <DescriptionList
        items={[
          {
            term: say(words.email),
            description: user.email,
          },
          {
            term: say(words.role),
            description: say(userRoleNameOf(user.role)),
          },
          {
            term: say(words.status),
            description: say(statusNameOf(user.status)),
          },
          {
            term: say(record.emailVerified),
            description: say(
              user.emailVerified ? record.verified : record.notVerified,
            ),
          },
          {
            term: say(record.lock),
            description: say(lockNameOf(lock, timezone)),
          },
          {
            term: say(record.failures),
            description: say(failuresNameOf(user.failedLoginAttempts)),
          },
          {
            term: say(words.twoFactor),
            description: say(twoFactorNameOf(user.twoFactorStatus)),
          },
          {
            term: say(record.passwordChange),
            description: say(
              user.lastPasswordChange === null
                ? record.neverChanged
                : momentNameAt(user.lastPasswordChange, timezone),
            ),
          },
          {
            term: say(words.lastLogin),
            description: say(
              user.lastLoginAt === null
                ? words.neverSignedIn
                : momentNameAt(user.lastLoginAt, timezone),
            ),
          },
          {
            term: say(record.lastLoginIp),
            description: user.lastLoginIp ?? say(record.noIp),
          },
          { term: say(record.ledgers), description: say(ledgersOf(user)) },
          {
            term: say(words.createdAt),
            description: say(momentNameAt(user.createdAt, timezone)),
          },
        ]}
      />
      {statusNote !== undefined && <Note>{say(statusNote)}</Note>}
      {lockNote !== undefined && <Note>{say(lockNote)}</Note>}
      <Note>{say(timeZoneNoteOf(timezone))}</Note>
    </Card>
  )
}
