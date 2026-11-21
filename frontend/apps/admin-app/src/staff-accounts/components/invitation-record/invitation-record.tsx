import type {
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { Badge, Card, DescriptionList } from '@beauty-salon-frontend/ui'
import type { ReactNode, Ref } from 'react'
import { match } from 'ts-pattern'
import {
  type InvitationState,
  invitationStateOf,
  roleNameOf,
} from '../../account-format'
import styles from './invitation-record.module.css'

export type InvitationRecordProps = {
  invitation: ModelsStaffInvitationResponse
  /** The member who was invited, as the ledger has them now */
  member: ModelsStaffResponse
  /** When the invitation is looked at: whether it expired */
  now: Date
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The heading, which takes the focus when the invitation is shown after a write */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** What can be done with the invitation: revoking it */
  actions?: ReactNode
}

type StateWordsProps = { state: InvitationState; member: ModelsStaffResponse }

/** Whether the member can take the invitation now, and what to do when they cannot. */
const StateWords = ({ state, member }: StateWordsProps) =>
  match(state)
    .with('waiting', () => (
      <p className={styles['note']}>
        招待されたスタッフが、メールのリンクからパスワードを決めると、ログインアカウントができます。すでにスタッフのアカウントを持っていて、どのサロンにも属していない人は、そのアカウントでログインして招待に参加します。
      </p>
    ))
    .with('expired', () => (
      <p className={styles['note']}>
        期限が切れたので、この招待のリンクは使えません。招待し直すと、新しいリンクを送ります。
      </p>
    ))
    .with('elsewhere', () => (
      <p className={styles['note']}>
        招待したあとで、台帳のメールアドレスが変わりました（いまは
        {member.email}
        ）。この招待のリンクは使えません。招待し直すと、いまのメールアドレスに送ります。
      </p>
    ))
    .with('inactive', () => (
      <p className={styles['note']}>
        無効なスタッフへの招待は、スタッフ情報を有効に戻すまで使えません。
      </p>
    ))
    .exhaustive()

const BADGES: Record<InvitationState, ReactNode> = {
  waiting: <Badge tone='info'>受け入れ待ち</Badge>,
  expired: <Badge tone='warning'>期限切れ</Badge>,
  elsewhere: <Badge tone='danger'>使えません</Badge>,
  inactive: <Badge tone='danger'>使えません</Badge>,
}

/**
 * The invitation of a member that was mailed and not taken yet: where it
 * went, the role it gives, until when it can be taken, and whether it can
 * be taken now. The API refuses an invitation that expired, that went to
 * an address the ledger no longer has, or that is of an inactive member.
 */
export const InvitationRecord = ({
  invitation,
  member,
  now,
  timezone,
  headingRef,
  actions,
}: InvitationRecordProps) => {
  const state = invitationStateOf(invitation, member, now)

  return (
    <Card title='招待' headingRef={headingRef} actions={actions}>
      <DescriptionList
        items={[
          { term: '状態', description: BADGES[state] },
          {
            term: '宛先',
            description: invitation.email,
          },
          { term: 'ロール', description: roleNameOf(invitation.role) },
          {
            term: '期限',
            description: momentNameAt(invitation.expiresAt, timezone),
          },
          {
            term: '送った日時',
            description: momentNameAt(invitation.createdAt, timezone),
          },
        ]}
      />
      <StateWords state={state} member={member} />
    </Card>
  )
}
