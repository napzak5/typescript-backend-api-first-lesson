import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { aStaffMember } from '../../staff/components/examples'
import { anAccount, anInvitation } from '../components/examples'
import {
  afterInvitation,
  afterRevocation,
  afterRoleChange,
  afterUnlinking,
  readRole,
  readRoleChange,
} from './account-form'

/** The name of the member, as the ledger has it */
const NAME = '田中 美咲'

/** A message whose sentences hold these, in each language */
const holding = (en: string, ja: string): unknown => ({
  en: expect.stringContaining(en),
  ja: expect.stringContaining(ja),
})

/** What the form says when no role was chosen */
const NO_ROLE = { en: 'Choose a role.', ja: 'ロールを選んでください。' }

/** A form sent with the role chosen in it, or with none. */
const formWith = (role?: string): FormData =>
  formOf(role === undefined ? {} : { role })

describe('readRole', () => {
  it('should give the role chosen', () => {
    // Act
    const read = readRole(formWith('manager'), ['manager', 'staff'])

    // Assert
    expect(read).toEqual({ type: 'valid', value: 'manager' })
  })

  it.each<[string, string | undefined]>([
    ['no role', undefined],
    ['the role of an owner, which the account may not give', 'owner'],
    ['a role that is none', 'customer'],
  ])('should ask for a role after %s', (_, role) => {
    // Act
    const read = readRole(formWith(role), ['manager', 'staff'])

    // Assert
    expect(read).toEqual({ type: 'invalid', errors: { role: NO_ROLE } })
  })
})

describe('readRoleChange', () => {
  it('should ask for nothing when the role stays as it is', () => {
    // Act
    const read = readRoleChange(
      formWith('staff'),
      ['manager', 'staff'],
      anAccount({ role: 'staff' }),
    )

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should give another role', () => {
    // Act
    const read = readRoleChange(
      formWith('manager'),
      ['manager', 'staff'],
      anAccount({ role: 'staff' }),
    )

    // Assert
    expect(read).toEqual({ type: 'valid', value: 'manager' })
  })

  it('should ask for a role an owner may give when the account of another owner is sent as it was', () => {
    // Act
    const read = readRoleChange(
      formWith(),
      ['manager', 'staff'],
      anAccount({ role: 'owner' }),
    )

    // Assert
    expect(read).toEqual({ type: 'invalid', errors: { role: NO_ROLE } })
  })
})

describe('afterInvitation', () => {
  it('should say that an invitation was mailed, and that the one before is of no use once it was mailed again', () => {
    // Act
    const said = [false, true].map((again) =>
      afterInvitation(
        { type: 'invited', invitation: anInvitation() },
        NAME,
        again,
      ),
    )

    // Assert
    expect(said).toEqual([
      {
        type: 'invited',
        invitation: anInvitation(),
        message: {
          en: 'Sent the invitation email to 田中 美咲.',
          ja: '田中 美咲 さんに、招待メールを送りました。',
        },
      },
      {
        type: 'invited',
        invitation: anInvitation(),
        message: {
          en: 'Sent the invitation email to 田中 美咲 again. The link of the email sent before no longer works.',
          ja: '田中 美咲 さんに、招待メールを送り直しました。前に送ったメールのリンクは、使えなくなりました。',
        },
      },
    ])
  })

  it('should show the account an invitation made meanwhile, and the member who was made inactive', () => {
    // Act
    const said = [
      afterInvitation({ type: 'accepted', account: anAccount() }, NAME, true),
      afterInvitation(
        { type: 'inactive', member: aStaffMember({ isActive: false }) },
        NAME,
        false,
      ),
    ]

    // Assert
    expect(said).toEqual([
      {
        type: 'accepted',
        account: anAccount(),
        message: {
          en: 'Meanwhile, 田中 美咲 accepted the invitation, and the sign-in account was made. No invitation email was sent.',
          ja: 'その間に、田中 美咲 さんが招待を受け入れて、ログインアカウントができていました。招待メールは、送っていません。',
        },
      },
      {
        type: 'inactive',
        member: aStaffMember({ isActive: false }),
        message: {
          en: 'Could not send the invitation email. Meanwhile, 田中 美咲 was made inactive.',
          ja: '招待メールを送れませんでした。その間に、田中 美咲 さんのスタッフ情報が無効になっていました。',
        },
      },
    ])
  })

  it.each<
    [string, Parameters<typeof afterInvitation>[0], string, string, string]
  >([
    [
      'an invitation of a minute ago',
      { type: 'recent' },
      'recent',
      'An invitation email was sent to 田中 美咲 less than a minute ago',
      '田中 美咲 さんには、1 分以内に招待メールを送ったばかりです。',
    ],
    [
      'a role the account may not give',
      { type: 'forbidden' },
      'again',
      'This account cannot invite with this role. Only an administrator',
      'このアカウントでは、このロールで招待できません。オーナーのロールを',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'again',
      'There are too many requests.',
      'アクセスが多すぎます。',
    ],
    [
      'no answer',
      { type: 'failed' },
      'again',
      'Could not send the invitation email. Check your connection',
      '招待メールを送れませんでした。通信の状態を確かめて',
    ],
  ])(
    'should say at the form why nothing was mailed after %s',
    (_, attempt, type, en, ja) => {
      // Act
      const said = afterInvitation(attempt, NAME, false)

      // Assert
      expect(said).toEqual({
        type,
        says: { message: holding(en, ja), errors: {} },
      })
    },
  )

  it('should take a member who was removed meanwhile as gone', () => {
    // Act
    const said = afterInvitation({ type: 'notFound' }, NAME, false)

    // Assert
    expect(said).toEqual({ type: 'gone' })
  })
})

describe('afterRoleChange', () => {
  it('should say the role the account has now, and when it begins to count', () => {
    // Act
    const said = afterRoleChange(
      { type: 'changed', account: anAccount({ role: 'manager' }) },
      NAME,
    )

    // Assert
    expect(said).toEqual({
      type: 'changed',
      account: anAccount({ role: 'manager' }),
      message: {
        en: 'Changed the role of 田中 美咲 to Manager. The new role takes effect from the next action of the account.',
        ja: '田中 美咲 さんのロールを、マネージャーにしました。次の操作から、新しいロールで扱われます。',
      },
    })
  })

  it.each<[string, Parameters<typeof afterRoleChange>[0], string, string]>([
    [
      'the own account',
      { type: 'own' },
      'The role of your own account cannot be changed.',
      'ご自身のアカウントのロールは、変えられません。',
    ],
    [
      'a role the account may not give',
      { type: 'forbidden' },
      'This account cannot give this role. Only an administrator can give the role of an owner.',
      'このアカウントでは、このロールを与えられません。オーナーのロールを与えられるのは、管理者です。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'There are too many requests.',
      'アクセスが多すぎます。',
    ],
    [
      'no answer',
      { type: 'failed' },
      'Could not change the role. Check your connection',
      'ロールを変えられませんでした。通信の状態を確かめて',
    ],
  ])(
    'should say at the form why the role was not changed for %s',
    (_, change, en, ja) => {
      // Act
      const said = afterRoleChange(change, NAME)

      // Assert
      expect(said).toEqual({
        type: 'again',
        says: { message: holding(en, ja), errors: {} },
      })
    },
  )

  it('should say that the account changed meanwhile', () => {
    // Act
    const said = afterRoleChange({ type: 'gone' }, NAME)

    // Assert
    expect(said).toEqual({
      type: 'gone',
      message: {
        en: 'Meanwhile, the sign-in account or the invitation of 田中 美咲 changed (the invitation was accepted or revoked, or the account was unlinked). This is how it stands now.',
        ja: 'その間に、田中 美咲 さんのログインアカウントか招待が、変わっていました（招待が受け入れられたか、取り消されたか、紐づけが解除されていました）。いまの状態を出しています。',
      },
    })
  })
})

describe('afterRevocation and afterUnlinking', () => {
  it('should say what was done', () => {
    // Act
    const said = [
      afterRevocation({ type: 'revoked' }, NAME),
      afterUnlinking({ type: 'unlinked' }, NAME),
    ]

    // Assert
    expect(said).toEqual([
      {
        type: 'done',
        message: {
          en: 'Revoked the invitation of 田中 美咲.',
          ja: '田中 美咲 さんへの招待を取り消しました。',
        },
      },
      {
        type: 'done',
        message: {
          en: 'Unlinked the sign-in account of 田中 美咲.',
          ja: '田中 美咲 さんのログインアカウントの紐づけを解除しました。',
        },
      },
    ])
  })

  it('should say that what was to be changed changed meanwhile', () => {
    // Act
    const said = [
      afterRevocation({ type: 'gone' }, NAME),
      afterUnlinking({ type: 'gone' }, NAME),
    ]

    // Assert
    expect(said).toEqual([
      {
        type: 'gone',
        message: holding(
          'Meanwhile, the sign-in account or the invitation of 田中 美咲 changed',
          'その間に、田中 美咲 さんの',
        ),
      },
      {
        type: 'gone',
        message: holding(
          'Meanwhile, the sign-in account or the invitation of 田中 美咲 changed',
          'その間に、田中 美咲 さんの',
        ),
      },
    ])
  })

  it.each<[string, () => unknown, string, string]>([
    [
      'a revocation refused',
      () => afterRevocation({ type: 'forbidden' }, NAME),
      'This account cannot revoke invitations.',
      'このアカウントでは、招待を取り消せません。',
    ],
    [
      'a revocation after too many requests',
      () => afterRevocation({ type: 'tooManyRequests' }, NAME),
      'There are too many requests.',
      'アクセスが多すぎます。',
    ],
    [
      'a revocation without an answer',
      () => afterRevocation({ type: 'failed' }, NAME),
      'Could not revoke the invitation. Check your connection',
      '招待を取り消せませんでした。通信の状態を確かめて',
    ],
    [
      'an unlinking of the own account',
      () => afterUnlinking({ type: 'own' }, NAME),
      'Your own account cannot be unlinked.',
      'ご自身のアカウントの紐づけは、解除できません。',
    ],
    [
      'an unlinking refused',
      () => afterUnlinking({ type: 'forbidden' }, NAME),
      'This account cannot unlink accounts.',
      'このアカウントでは、紐づけを解除できません。',
    ],
    [
      'an unlinking after too many requests',
      () => afterUnlinking({ type: 'tooManyRequests' }, NAME),
      'There are too many requests.',
      'アクセスが多すぎます。',
    ],
    [
      'an unlinking without an answer',
      () => afterUnlinking({ type: 'failed' }, NAME),
      'Could not unlink the account. Check your connection',
      '紐づけを解除できませんでした。通信の状態を確かめて',
    ],
  ])('should say in the dialog what went wrong with %s', (_, after, en, ja) => {
    // Act
    const said = after()

    // Assert
    expect(said).toEqual({ type: 'again', message: holding(en, ja) })
  })
})
