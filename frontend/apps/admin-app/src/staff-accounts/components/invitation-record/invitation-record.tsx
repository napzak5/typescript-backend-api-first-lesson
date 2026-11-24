import type {
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Card,
  DescriptionList,
  Note,
  type Tone,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode, Ref } from 'react'
import { match } from 'ts-pattern'
import {
  type InvitationState,
  invitationStateOf,
  roleNameOf,
} from '../../utils/account-format'

const { words, invitation: INVITATION } = adminStaffAccountMessages

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

/** Whether the member can take the invitation now, and what to do when they cannot. */
const stateNoteOf = (
  state: InvitationState,
  member: ModelsStaffResponse,
): LocalizedText =>
  match(state)
    .with('waiting', () => INVITATION.notes.waiting)
    .with('expired', () => INVITATION.notes.expired)
    .with('elsewhere', () => INVITATION.notes.elsewhere(member.email))
    .with('inactive', () => INVITATION.notes.inactive)
    .exhaustive()

/** The badge of the state of an invitation: its tone, and its words */
const BADGES: Record<InvitationState, { tone: Tone; words: LocalizedText }> = {
  waiting: { tone: 'info', words: INVITATION.states.waiting },
  expired: { tone: 'warning', words: INVITATION.states.expired },
  elsewhere: { tone: 'danger', words: INVITATION.states.unusable },
  inactive: { tone: 'danger', words: INVITATION.states.unusable },
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
  const say = useSay()
  const state = invitationStateOf(invitation, member, now)
  const badge = BADGES[state]

  return (
    <Card
      title={say(INVITATION.title)}
      headingRef={headingRef}
      actions={actions}
    >
      <DescriptionList
        items={[
          {
            term: say(words.status),
            description: <Badge tone={badge.tone}>{say(badge.words)}</Badge>,
          },
          {
            term: say(INVITATION.recipient),
            description: invitation.email,
          },
          {
            term: say(words.role),
            description: say(roleNameOf(invitation.role)),
          },
          {
            term: say(INVITATION.expiresAt),
            description: say(momentNameAt(invitation.expiresAt, timezone)),
          },
          {
            term: say(INVITATION.sentAt),
            description: say(momentNameAt(invitation.createdAt, timezone)),
          },
        ]}
      />
      <Note>{say(stateNoteOf(state, member))}</Note>
    </Card>
  )
}
