import { describe, expect, it } from 'vitest'
import { aStaffMember } from '../staff/components/examples'
import {
  afterInvitation,
  afterRevocation,
  afterRoleChange,
  afterUnlinking,
  readRole,
  readRoleChange,
} from './account-form'
import { anAccount, anInvitation } from './components/examples'

const CALLED = '田中 美咲 さん'

/** A form sent with the role chosen in it, or with none. */
const formWith = (role?: string): FormData => {
  const values = new FormData()
  if (role !== undefined) {
    values.set('role', role)
  }

  return values
}

describe('readRole', () => {
  it('should give the role chosen', () => {
    // Act
    const read = readRole(formWith('manager'), ['manager', 'staff'])

    // Assert
    expect(read).toEqual({ type: 'valid', request: 'manager' })
  })

  it.each<[string, string | undefined]>([
    ['no role', undefined],
    ['the role of an owner, which the account may not give', 'owner'],
    ['a role that is none', 'customer'],
  ])('should ask for a role after %s', (_, role) => {
    // Act
    const read = readRole(formWith(role), ['manager', 'staff'])

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: { role: 'ロールを選んでください。' },
    })
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
    expect(read).toEqual({ type: 'valid', request: 'manager' })
  })

  it('should ask for a role an owner may give when the account of another owner is sent as it was', () => {
    // Act
    const read = readRoleChange(
      formWith(),
      ['manager', 'staff'],
      anAccount({ role: 'owner' }),
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: { role: 'ロールを選んでください。' },
    })
  })
})

describe('afterInvitation', () => {
  it('should say that an invitation was mailed, and that the one before is of no use once it was mailed again', () => {
    // Act
    const said = [false, true].map((again) =>
      afterInvitation(
        { type: 'invited', invitation: anInvitation() },
        CALLED,
        again,
      ),
    )

    // Assert
    expect(said).toEqual([
      {
        type: 'invited',
        invitation: anInvitation(),
        message: '田中 美咲 さんに、招待メールを送りました。',
      },
      {
        type: 'invited',
        invitation: anInvitation(),
        message:
          '田中 美咲 さんに、招待メールを送り直しました。前に送ったメールのリンクは、使えなくなりました。',
      },
    ])
  })

  it('should show the account an invitation made meanwhile, and the member who was made inactive', () => {
    // Act
    const said = [
      afterInvitation({ type: 'accepted', account: anAccount() }, CALLED, true),
      afterInvitation(
        { type: 'inactive', member: aStaffMember({ isActive: false }) },
        CALLED,
        false,
      ),
    ]

    // Assert
    expect(said).toEqual([
      {
        type: 'accepted',
        account: anAccount(),
        message:
          'その間に、田中 美咲 さんが招待を受け入れて、ログインアカウントができていました。招待メールは、送っていません。',
      },
      {
        type: 'inactive',
        member: aStaffMember({ isActive: false }),
        message:
          '招待メールを送れませんでした。その間に、田中 美咲 さんのスタッフ情報が無効になっていました。',
      },
    ])
  })

  it.each<[string, Parameters<typeof afterInvitation>[0], string, string]>([
    [
      'an invitation of a minute ago',
      { type: 'recent' },
      'recent',
      '田中 美咲 さんには、1 分以内に招待メールを送ったばかりです。',
    ],
    [
      'a role the account may not give',
      { type: 'forbidden' },
      'again',
      'このアカウントでは、このロールで招待できません。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'again',
      'アクセスが多すぎます。',
    ],
    [
      'no answer',
      { type: 'failed' },
      'again',
      '招待メールを送れませんでした。通信の状態を確かめて',
    ],
  ])(
    'should say at the form why nothing was mailed after %s',
    (_, attempt, type, message) => {
      // Act
      const said = afterInvitation(attempt, CALLED, false)

      // Assert
      expect(said).toEqual({
        type,
        says: { message: expect.stringContaining(message), errors: {} },
      })
    },
  )

  it('should take a member who was removed meanwhile as gone', () => {
    // Act
    const said = afterInvitation({ type: 'notFound' }, CALLED, false)

    // Assert
    expect(said).toEqual({ type: 'gone' })
  })
})

describe('afterRoleChange', () => {
  it('should say the role the account has now, and when it begins to count', () => {
    // Act
    const said = afterRoleChange(
      { type: 'changed', account: anAccount({ role: 'manager' }) },
      CALLED,
    )

    // Assert
    expect(said).toEqual({
      type: 'changed',
      account: anAccount({ role: 'manager' }),
      message:
        '田中 美咲 さんのロールを、マネージャーにしました。次の操作から、新しいロールで扱われます。',
    })
  })

  it.each<[string, Parameters<typeof afterRoleChange>[0], string]>([
    [
      'the own account',
      { type: 'own' },
      'ご自身のアカウントのロールは、変えられません。',
    ],
    [
      'a role the account may not give',
      { type: 'forbidden' },
      'オーナーのロールを与えられるのは、管理者です。',
    ],
    ['no answer', { type: 'failed' }, 'ロールを変えられませんでした。'],
  ])(
    'should say at the form why the role was not changed for %s',
    (_, change, message) => {
      // Act
      const said = afterRoleChange(change, CALLED)

      // Assert
      expect(said).toEqual({
        type: 'again',
        says: { message: expect.stringContaining(message), errors: {} },
      })
    },
  )
})

describe('afterRevocation and afterUnlinking', () => {
  it('should say what was done', () => {
    // Act
    const said = [
      afterRevocation({ type: 'revoked' }, CALLED),
      afterUnlinking({ type: 'unlinked' }, CALLED),
    ]

    // Assert
    expect(said).toEqual([
      { type: 'done', message: '田中 美咲 さんへの招待を取り消しました。' },
      {
        type: 'done',
        message: '田中 美咲 さんのログインアカウントの紐づけを解除しました。',
      },
    ])
  })

  it('should say that what was to be changed changed meanwhile', () => {
    // Act
    const said = [
      afterRevocation({ type: 'gone' }, CALLED),
      afterUnlinking({ type: 'gone' }, CALLED),
    ]

    // Assert
    expect(said).toEqual([
      {
        type: 'gone',
        message: expect.stringMatching(/^その間に、田中 美咲 さんの/),
      },
      {
        type: 'gone',
        message: expect.stringMatching(/^その間に、田中 美咲 さんの/),
      },
    ])
  })

  it.each<[string, () => unknown, string]>([
    [
      'a revocation refused',
      () => afterRevocation({ type: 'forbidden' }, CALLED),
      'このアカウントでは、招待を取り消せません。',
    ],
    [
      'a revocation without an answer',
      () => afterRevocation({ type: 'failed' }, CALLED),
      '招待を取り消せませんでした。',
    ],
    [
      'an unlinking of the own account',
      () => afterUnlinking({ type: 'own' }, CALLED),
      'ご自身のアカウントの紐づけは、解除できません。',
    ],
    [
      'an unlinking after too many requests',
      () => afterUnlinking({ type: 'tooManyRequests' }, CALLED),
      'アクセスが多すぎます。',
    ],
  ])(
    'should say in the dialog what went wrong with %s',
    (_, after, message) => {
      // Act
      const said = after()

      // Assert
      expect(said).toEqual({
        type: 'again',
        message: expect.stringContaining(message),
      })
    },
  )
})
