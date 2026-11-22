import type {
  ModelsStaffAccountResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { Card, DescriptionList, Note } from '@beauty-salon-frontend/ui'
import type { ReactNode, Ref } from 'react'
import {
  roleNameOf,
  sameAddress,
  statusNameOf,
  statusNoteOf,
  twoFactorNameOf,
} from '../../utils/account-format'

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
  const note = statusNoteOf(account.status)

  return (
    <Card title='ログインアカウント' headingRef={headingRef} actions={actions}>
      <DescriptionList
        items={[
          {
            term: 'メールアドレス',
            description: account.email,
          },
          { term: 'ロール', description: roleNameOf(account.role) },
          { term: '状態', description: statusNameOf(account.status) },
          {
            term: '2 要素認証',
            description: twoFactorNameOf(account.twoFactorStatus),
          },
          {
            term: '最後のログイン',
            description:
              account.lastLoginAt === null
                ? 'まだログインしていません'
                : momentNameAt(account.lastLoginAt, timezone),
          },
          {
            term: '作った日時',
            description: momentNameAt(account.createdAt, timezone),
          },
        ]}
      />
      {note !== undefined && <Note>{note}</Note>}
      {!sameAddress(account.email, member.email) && (
        <Note>
          ログインには、このメールアドレスを使います。台帳のメールアドレス（
          {member.email}
          ）とは違います。招待を受け入れたあとで台帳を直しても、ログインのメールアドレスは変わりません。
        </Note>
      )}
    </Card>
  )
}
