import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminStaffAccountMessages } from './index'

const { account, invitation, invite, revocation, roleChange, unlinking } =
  adminStaffAccountMessages

const NAME = '田中 美咲'

const EMAIL = 'misaki.tanaka@example.com'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminStaffAccountMessages.invite.to',
    invite.to(EMAIL),
    {
      en: 'The invitation email goes to the address of the staff ledger (misaki.tanaka@example.com). To send it to another address, edit the staff member first. The link of the invitation works for 7 days.',
      ja: '招待メールを、台帳のメールアドレス（misaki.tanaka@example.com）に送ります。宛先を変えるときは、先にスタッフ情報を直してください。招待のリンクは、7 日の間、使えます。',
    },
  ],
  [
    'adminStaffAccountMessages.invite.toAgain',
    invite.toAgain(EMAIL),
    {
      en: 'The invitation email is sent again to the address of the staff ledger (misaki.tanaka@example.com). The link of the email sent before stops working. The link of the invitation works for 7 days.',
      ja: '招待メールを、台帳のメールアドレス（misaki.tanaka@example.com）に送り直します。前に送ったメールのリンクは、使えなくなります。招待のリンクは、7 日の間、使えます。',
    },
  ],
  [
    'adminStaffAccountMessages.invite.done',
    invite.done(NAME),
    {
      en: 'Sent the invitation email to 田中 美咲.',
      ja: '田中 美咲 さんに、招待メールを送りました。',
    },
  ],
  [
    'adminStaffAccountMessages.invite.doneAgain',
    invite.doneAgain(NAME),
    {
      en: 'Sent the invitation email to 田中 美咲 again. The link of the email sent before no longer works.',
      ja: '田中 美咲 さんに、招待メールを送り直しました。前に送ったメールのリンクは、使えなくなりました。',
    },
  ],
  [
    'adminStaffAccountMessages.invite.acceptedMeanwhile',
    invite.acceptedMeanwhile(NAME),
    {
      en: 'Meanwhile, 田中 美咲 accepted the invitation, and the sign-in account was made. No invitation email was sent.',
      ja: 'その間に、田中 美咲 さんが招待を受け入れて、ログインアカウントができていました。招待メールは、送っていません。',
    },
  ],
  [
    'adminStaffAccountMessages.invite.inactiveMeanwhile',
    invite.inactiveMeanwhile(NAME),
    {
      en: 'Could not send the invitation email. Meanwhile, 田中 美咲 was made inactive.',
      ja: '招待メールを送れませんでした。その間に、田中 美咲 さんのスタッフ情報が無効になっていました。',
    },
  ],
  [
    'adminStaffAccountMessages.invite.recent',
    invite.recent(NAME),
    {
      en: 'An invitation email was sent to 田中 美咲 less than a minute ago, and another cannot follow at once. If the email cannot be found, ask them to check the spam folder too, and send it again after a while.',
      ja: '田中 美咲 さんには、1 分以内に招待メールを送ったばかりです。続けては送れません。メールが見当たらないときは、迷惑メールのフォルダーも確かめてもらい、少し待ってから送り直してください。',
    },
  ],
  [
    'adminStaffAccountMessages.invitation.notes.elsewhere',
    invitation.notes.elsewhere(EMAIL),
    {
      en: 'The email address in the staff ledger changed after the invitation (it is misaki.tanaka@example.com now). The link of this invitation does not work. Invite again to send it to the current address.',
      ja: '招待したあとで、台帳のメールアドレスが変わりました（いまはmisaki.tanaka@example.com）。この招待のリンクは使えません。招待し直すと、いまのメールアドレスに送ります。',
    },
  ],
  [
    'adminStaffAccountMessages.revocation.title',
    revocation.title(NAME),
    {
      en: 'Revoke the invitation of 田中 美咲?',
      ja: '田中 美咲 さんへの招待を取り消しますか？',
    },
  ],
  [
    'adminStaffAccountMessages.revocation.done',
    revocation.done(NAME),
    {
      en: 'Revoked the invitation of 田中 美咲.',
      ja: '田中 美咲 さんへの招待を取り消しました。',
    },
  ],
  [
    'adminStaffAccountMessages.account.otherAddress',
    account.otherAddress(EMAIL),
    {
      en: 'This account signs in with this email address, not with the address of the staff ledger (misaki.tanaka@example.com). Editing the ledger after the invitation was accepted does not change the address of the sign-in.',
      ja: 'ログインには、このメールアドレスを使います。台帳のメールアドレス（misaki.tanaka@example.com）とは違います。招待を受け入れたあとで台帳を直しても、ログインのメールアドレスは変わりません。',
    },
  ],
  [
    'adminStaffAccountMessages.account.goneMeanwhile',
    account.goneMeanwhile(NAME),
    {
      en: 'Meanwhile, the sign-in account or the invitation of 田中 美咲 changed (the invitation was accepted or revoked, or the account was unlinked). This is how it stands now.',
      ja: 'その間に、田中 美咲 さんのログインアカウントか招待が、変わっていました（招待が受け入れられたか、取り消されたか、紐づけが解除されていました）。いまの状態を出しています。',
    },
  ],
  [
    'adminStaffAccountMessages.roleChange.done',
    roleChange.done(NAME, { en: 'Manager', ja: 'マネージャー' }),
    {
      en: 'Changed the role of 田中 美咲 to Manager. The new role takes effect from the next action of the account.',
      ja: '田中 美咲 さんのロールを、マネージャーにしました。次の操作から、新しいロールで扱われます。',
    },
  ],
  [
    'adminStaffAccountMessages.unlinking.title',
    unlinking.title(NAME),
    {
      en: 'Unlink the sign-in account of 田中 美咲?',
      ja: '田中 美咲 さんのログインアカウントの紐づけを解除しますか？',
    },
  ],
  [
    'adminStaffAccountMessages.unlinking.done',
    unlinking.done(NAME),
    {
      en: 'Unlinked the sign-in account of 田中 美咲.',
      ja: '田中 美咲 さんのログインアカウントの紐づけを解除しました。',
    },
  ],
]

describe('the messages of the accounts of the staff of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminStaffAccountMessages }, '').made.toSorted(),
    )
  })

  it('should say what the roles do, then who gives that of an owner, then who gives it back', () => {
    // Assert
    expect(adminStaffAccountMessages.roles.forOthersOfAnOwner).toEqual({
      en: 'An owner also keeps the staff ledger and the sign-in accounts. A manager makes the shifts, and also voids sales and removes customers from the ledger. A staff member handles bookings and treatment records, and sees their own shifts. Only an administrator can give the role of an owner. Once the role of an owner is taken away, only an administrator can give it back.',
      ja: 'オーナーは、スタッフ台帳とログインアカウントも扱います。マネージャーは、シフトを組み、売上の取り消しや顧客台帳からの削除もします。スタッフは、予約と施術記録を扱い、自分のシフトを見ます。オーナーのロールを与えられるのは、管理者です。オーナーのロールを外すと、戻せるのは管理者だけです。',
    })
  })
})
