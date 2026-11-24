import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { followed } from '../written'
import { ACCOUNT_WORDS } from './account-words'
import { adminStaffMessages } from './staff'
import { staffCalled } from './staff-words'

/*
 * What the admin application says of the account a member of the staff
 * signs in with: the account and the invitation that makes it, the role
 * the account has and who may give it, an invitation mailed, mailed again
 * and revoked, and an account unlinked. The addresses of mail and the
 * names of the members stand as they were written.
 */

/** Who gives the role of an owner, said after what the account may not do */
const OWNER_BY_ADMIN = text({
  en: 'Only an administrator can give the role of an owner.',
  ja: 'オーナーのロールを与えられるのは、管理者です。',
})

/** What becomes of the role of an owner that is taken away, said to an account that is not an administrator */
const OWNER_BACK = text({
  en: 'Once the role of an owner is taken away, only an administrator can give it back.',
  ja: 'オーナーのロールを外すと、戻せるのは管理者だけです。',
})

const WHAT_ROLES_DO = text({
  en: 'An owner also keeps the staff ledger and the sign-in accounts. A manager makes the shifts, and also voids sales and removes customers from the ledger. A staff member handles bookings and treatment records, and sees their own shifts.',
  ja: 'オーナーは、スタッフ台帳とログインアカウントも扱います。マネージャーは、シフトを組み、売上の取り消しや顧客台帳からの削除もします。スタッフは、予約と施術記録を扱い、自分のシフトを見ます。',
})

export const adminStaffAccountMessages = {
  title: ACCOUNT_WORDS.account,
  /** What a screen could not read, as a sentence names it */
  names: {
    account: text({ en: 'the sign-in account', ja: 'ログインアカウント' }),
  },
  loading: text({
    en: 'Loading the sign-in account',
    ja: 'ログインアカウントを読み込んでいます',
  }),
  words: ACCOUNT_WORDS,
  /** What the roles let an account do, said to an administrator, and to the others with who gives that of an owner */
  roles: {
    forAdministrators: WHAT_ROLES_DO,
    forOthers: followed(WHAT_ROLES_DO, OWNER_BY_ADMIN),
    /** Said to an account that is not an administrator, as it changes the role of an owner */
    forOthersOfAnOwner: followed(WHAT_ROLES_DO, OWNER_BY_ADMIN, OWNER_BACK),
    missing: text({ en: 'Choose a role.', ja: 'ロールを選んでください。' }),
  },
  /** A member who has neither an account nor an invitation */
  noLogin: text({
    en: 'There is no sign-in account yet. Once invited, the staff member chooses a password from the link of the invitation email, and so makes the sign-in account.',
    ja: 'ログインアカウントは、まだありません。招待すると、招待メールのリンクから、スタッフご本人がパスワードを決めて、ログインアカウントを作ります。',
  }),
  /** What an inactive member is told instead of an invitation */
  inactive: {
    text: text({
      en: 'An inactive staff member cannot be invited. When they come back after a leave, make the staff member active again before inviting them.',
      ja: '無効なスタッフは、招待できません。休職や退職の手続きが終わって復帰するときは、スタッフ情報を有効に戻してから招待してください。',
    }),
    toChange: adminStaffMessages.titles.change,
  },
  /** The form that mails an invitation, or mails it again */
  invite: {
    title: text({ en: 'Invite', ja: '招待する' }),
    titleAgain: text({ en: 'Invite again', ja: '招待し直す' }),
    submit: text({ en: 'Send the invitation email', ja: '招待メールを送る' }),
    submitAgain: text({
      en: 'Send the invitation email again',
      ja: '招待メールを送り直す',
    }),
    /** Where the invitation goes, and how long its link works */
    to: (email: string) =>
      text({
        en: `The invitation email goes to the address of the staff ledger (${email}). To send it to another address, edit the staff member first. The link of the invitation works for 7 days.`,
        ja: `招待メールを、台帳のメールアドレス（${email}）に送ります。宛先を変えるときは、先にスタッフ情報を直してください。招待のリンクは、7 日の間、使えます。`,
      }),
    toAgain: (email: string) =>
      text({
        en: `The invitation email is sent again to the address of the staff ledger (${email}). The link of the email sent before stops working. The link of the invitation works for 7 days.`,
        ja: `招待メールを、台帳のメールアドレス（${email}）に送り直します。前に送ったメールのリンクは、使えなくなります。招待のリンクは、7 日の間、使えます。`,
      }),
    done: (displayName: string) =>
      text({
        en: `Sent the invitation email to ${staffCalled(displayName).en}.`,
        ja: `${staffCalled(displayName).ja}に、招待メールを送りました。`,
      }),
    doneAgain: (displayName: string) =>
      text({
        en: `Sent the invitation email to ${staffCalled(displayName).en} again. The link of the email sent before no longer works.`,
        ja: `${staffCalled(displayName).ja}に、招待メールを送り直しました。前に送ったメールのリンクは、使えなくなりました。`,
      }),
    acceptedMeanwhile: (displayName: string) =>
      text({
        en: `Meanwhile, ${staffCalled(displayName).en} accepted the invitation, and the sign-in account was made. No invitation email was sent.`,
        ja: `その間に、${staffCalled(displayName).ja}が招待を受け入れて、ログインアカウントができていました。招待メールは、送っていません。`,
      }),
    inactiveMeanwhile: (displayName: string) =>
      text({
        en: `Could not send the invitation email. Meanwhile, ${staffCalled(displayName).en} was made inactive.`,
        ja: `招待メールを送れませんでした。その間に、${staffCalled(displayName).ja}のスタッフ情報が無効になっていました。`,
      }),
    recent: (displayName: string) =>
      text({
        en: `An invitation email was sent to ${staffCalled(displayName).en} less than a minute ago, and another cannot follow at once. If the email cannot be found, ask them to check the spam folder too, and send it again after a while.`,
        ja: `${staffCalled(displayName).ja}には、1 分以内に招待メールを送ったばかりです。続けては送れません。メールが見当たらないときは、迷惑メールのフォルダーも確かめてもらい、少し待ってから送り直してください。`,
      }),
    forbidden: followed(
      text({
        en: 'This account cannot invite with this role.',
        ja: 'このアカウントでは、このロールで招待できません。',
      }),
      OWNER_BY_ADMIN,
    ),
    failed: text({
      en: 'Could not send the invitation email. Check your connection and try again.',
      ja: '招待メールを送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** An invitation that was mailed and not taken yet */
  invitation: {
    title: text({ en: 'Invitation', ja: '招待' }),
    recipient: text({ en: 'Sent to', ja: '宛先' }),
    expiresAt: text({ en: 'Expires', ja: '期限' }),
    sentAt: text({ en: 'Sent', ja: '送った日時' }),
    states: {
      waiting: text({ en: 'Waiting to be accepted', ja: '受け入れ待ち' }),
      expired: text({ en: 'Expired', ja: '期限切れ' }),
      unusable: text({ en: 'Cannot be used', ja: '使えません' }),
    },
    notes: {
      waiting: text({
        en: 'Once the invited staff member chooses a password from the link of the email, the sign-in account is made. Someone who already has a staff account and belongs to no salon signs in with that account to join.',
        ja: '招待されたスタッフが、メールのリンクからパスワードを決めると、ログインアカウントができます。すでにスタッフのアカウントを持っていて、どのサロンにも属していない人は、そのアカウントでログインして招待に参加します。',
      }),
      expired: text({
        en: 'The invitation expired, so its link no longer works. Invite again to send a new link.',
        ja: '期限が切れたので、この招待のリンクは使えません。招待し直すと、新しいリンクを送ります。',
      }),
      /** The ledger has another address for the member now */
      elsewhere: (email: string) =>
        text({
          en: `The email address in the staff ledger changed after the invitation (it is ${email} now). The link of this invitation does not work. Invite again to send it to the current address.`,
          ja: `招待したあとで、台帳のメールアドレスが変わりました（いまは${email}）。この招待のリンクは使えません。招待し直すと、いまのメールアドレスに送ります。`,
        }),
      inactive: text({
        en: 'An invitation of an inactive staff member cannot be used until the staff member is made active again.',
        ja: '無効なスタッフへの招待は、スタッフ情報を有効に戻すまで使えません。',
      }),
    },
  },
  /** The revocation of an invitation, after a dialog */
  revocation: {
    button: text({ en: 'Revoke the invitation', ja: '招待を取り消す' }),
    title: (displayName: string) =>
      text({
        en: `Revoke the invitation of ${staffCalled(displayName).en}?`,
        ja: `${staffCalled(displayName).ja}への招待を取り消しますか？`,
      }),
    description: text({
      en: 'Once revoked, the link of the invitation email no longer works. The staff member can be invited again later.',
      ja: '取り消すと、送った招待メールのリンクは使えなくなります。あとで、また招待できます。',
    }),
    back: uiMessages.back,
    confirm: text({ en: 'Revoke', ja: '取り消す' }),
    done: (displayName: string) =>
      text({
        en: `Revoked the invitation of ${staffCalled(displayName).en}.`,
        ja: `${staffCalled(displayName).ja}への招待を取り消しました。`,
      }),
    forbidden: text({
      en: 'This account cannot revoke invitations.',
      ja: 'このアカウントでは、招待を取り消せません。',
    }),
    failed: text({
      en: 'Could not revoke the invitation. Check your connection and try again.',
      ja: '招待を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The account linked to a member */
  account: {
    /** The account signs in with an address that is no longer that of the ledger */
    otherAddress: (email: string) =>
      text({
        en: `This account signs in with this email address, not with the address of the staff ledger (${email}). Editing the ledger after the invitation was accepted does not change the address of the sign-in.`,
        ja: `ログインには、このメールアドレスを使います。台帳のメールアドレス（${email}）とは違います。招待を受け入れたあとで台帳を直しても、ログインのメールアドレスは変わりません。`,
      }),
    own: text({
      en: 'This is your own account. From this account, its role cannot be changed, nor can it be unlinked.',
      ja: 'ご自身のアカウントです。このアカウントからは、ロールを変えることも、紐づけを解除することもできません。',
    }),
    inactiveMember: text({
      en: 'This staff member is inactive. Until the staff member is made active again, this account cannot use the screens of the salon.',
      ja: '無効なスタッフです。スタッフ情報を有効に戻すまで、このアカウントでは、サロンの画面を使えません。',
    }),
    toUserAccount: text({
      en: 'See the state of the account',
      ja: 'アカウントの状態を見る',
    }),
    toMember: text({
      en: 'Back to the staff member',
      ja: 'スタッフの内容へ',
    }),
    /** What changed meanwhile, which the API told when the screen wrote: the screen shows what is there now */
    goneMeanwhile: (displayName: string) =>
      text({
        en: `Meanwhile, the sign-in account or the invitation of ${staffCalled(displayName).en} changed (the invitation was accepted or revoked, or the account was unlinked). This is how it stands now.`,
        ja: `その間に、${staffCalled(displayName).ja}のログインアカウントか招待が、変わっていました（招待が受け入れられたか、取り消されたか、紐づけが解除されていました）。いまの状態を出しています。`,
      }),
  },
  /** The change of the role of an account */
  roleChange: {
    title: text({ en: 'Change the role', ja: 'ロールを変える' }),
    note: text({
      en: 'A new role takes effect from the next action of the account.',
      ja: 'ロールの変更は、そのアカウントの次の操作から効きます。',
    }),
    done: (displayName: string, role: LocalizedText) =>
      text({
        en: `Changed the role of ${staffCalled(displayName).en} to ${role.en}. The new role takes effect from the next action of the account.`,
        ja: `${staffCalled(displayName).ja}のロールを、${role.ja}にしました。次の操作から、新しいロールで扱われます。`,
      }),
    own: text({
      en: 'The role of your own account cannot be changed.',
      ja: 'ご自身のアカウントのロールは、変えられません。',
    }),
    forbidden: followed(
      text({
        en: 'This account cannot give this role.',
        ja: 'このアカウントでは、このロールを与えられません。',
      }),
      OWNER_BY_ADMIN,
    ),
    failed: text({
      en: 'Could not change the role. Check your connection and try again.',
      ja: 'ロールを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The unlinking of an account, after a dialog */
  unlinking: {
    button: text({ en: 'Unlink the account', ja: '紐づけを解除する' }),
    title: (displayName: string) =>
      text({
        en: `Unlink the sign-in account of ${staffCalled(displayName).en}?`,
        ja: `${staffCalled(displayName).ja}のログインアカウントの紐づけを解除しますか？`,
      }),
    description: text({
      en: 'Once unlinked, the account can no longer use the screens of the salon from its next action. The account and the staff member stay, and the staff member can be invited again. During a leave or while the staff member leaves the salon, make them inactive instead of unlinking the account.',
      ja: '解除すると、このアカウントは、次の操作からサロンの画面を使えなくなります。アカウントとスタッフ情報は残り、スタッフは、また招待できます。休職や退職の手続きの間は、解除せずに、スタッフ情報を無効にしてください。',
    }),
    back: uiMessages.back,
    confirm: text({ en: 'Unlink', ja: '解除する' }),
    done: (displayName: string) =>
      text({
        en: `Unlinked the sign-in account of ${staffCalled(displayName).en}.`,
        ja: `${staffCalled(displayName).ja}のログインアカウントの紐づけを解除しました。`,
      }),
    own: text({
      en: 'Your own account cannot be unlinked.',
      ja: 'ご自身のアカウントの紐づけは、解除できません。',
    }),
    forbidden: text({
      en: 'This account cannot unlink accounts.',
      ja: 'このアカウントでは、紐づけを解除できません。',
    }),
    failed: text({
      en: 'Could not unlink the account. Check your connection and try again.',
      ja: '紐づけを解除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
