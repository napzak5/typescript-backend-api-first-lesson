import type {
  ModelsStaffAccountResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { Card, DescriptionList, Note, useSay } from '@beauty-salon-frontend/ui'
import { adminStaffAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode, Ref } from 'react'
import {
  roleNameOf,
  sameAddress,
  statusNameOf,
  statusNoteOf,
  twoFactorNameOf,
} from '../../utils/account-format'

const { words, account: ACCOUNT } = adminStaffAccountMessages

export type AccountRecordProps = {
  account: ModelsStaffAccountResponse
  /** The member the account is linked to */
  member: ModelsStaffResponse
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The heading, which takes the focus when the account is shown after a write */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** What can be done with the account: leading to it, unlinking it */
  actions?: ReactNode
}

/**
 * The account a member signs in with, as the owner of the salon checks
 * it: the address and the role, whether the member can sign in and does,
 * and whether they set up two factors. A state that keeps the member out
 * says why; an address that is no longer that of the ledger says which one
 * the member signs in with.
 */
export const AccountRecord = ({
  account,
  member,
  timezone,
  headingRef,
  actions,
}: AccountRecordProps) => {
  const say = useSay()
  const note = statusNoteOf(account.status)

  return (
    <Card title={say(words.account)} headingRef={headingRef} actions={actions}>
      <DescriptionList
        items={[
          {
            term: say(words.email),
            description: account.email,
          },
          { term: say(words.role), description: say(roleNameOf(account.role)) },
          {
            term: say(words.status),
            description: say(statusNameOf(account.status)),
          },
          {
            term: say(words.twoFactor),
            description: say(twoFactorNameOf(account.twoFactorStatus)),
          },
          {
            term: say(words.lastLogin),
            description: say(
              account.lastLoginAt === null
                ? words.neverSignedIn
                : momentNameAt(account.lastLoginAt, timezone),
            ),
          },
          {
            term: say(words.createdAt),
            description: say(momentNameAt(account.createdAt, timezone)),
          },
        ]}
      />
      {note !== undefined && <Note>{say(note)}</Note>}
      {!sameAddress(account.email, member.email) && (
        <Note>{say(ACCOUNT.otherAddress(member.email))}</Note>
      )}
    </Card>
  )
}
