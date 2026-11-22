import { describe, expect, it } from 'vitest'
import type { AccountRead, InvitationRead } from '../api/accounts-api'
import {
  anAccount,
  anInvitation,
  anInvitedMember,
  NOW,
} from '../components/examples'
import {
  invitationStateOf,
  type LoginShown,
  loginOf,
  roleDescriptionFor,
  rolesGivenBy,
  sameAddress,
} from './account-format'

describe('rolesGivenBy and roleDescriptionFor', () => {
  it('should let an administrator give every role', () => {
    // Act
    const roles = rolesGivenBy('admin')

    // Assert
    expect(roles).toEqual(['owner', 'manager', 'staff'])
    expect(roleDescriptionFor('admin')).not.toContain('管理者です')
  })

  it('should let an owner give the roles of a manager and of the staff, and say who gives that of an owner', () => {
    // Act
    const roles = rolesGivenBy('owner')

    // Assert
    expect(roles).toEqual(['manager', 'staff'])
    expect(roleDescriptionFor('owner')).toMatch(
      /オーナーのロールを与えられるのは、管理者です。$/,
    )
  })
})

describe('sameAddress', () => {
  it('should take two addresses that differ in the case of their letters alone as one', () => {
    // Act
    const same = sameAddress(
      'Misaki.Tanaka@Example.com',
      'misaki.tanaka@example.com',
    )

    // Assert
    expect(same).toBe(true)
  })
})

describe('invitationStateOf', () => {
  it.each<[string, Date, string]>([
    ['a second before it expires', new Date('2026-11-26T00:59:59Z'), 'waiting'],
    ['when it expires', new Date('2026-11-26T01:00:00Z'), 'expired'],
  ])('should take an invitation %s as %s', (_, now, state) => {
    // Act
    const found = invitationStateOf(anInvitation(), anInvitedMember(), now)

    // Assert
    expect(found).toBe(state)
  })

  it('should take an invitation to an address of another case as one to the address of the ledger', () => {
    // Act
    const state = invitationStateOf(
      anInvitation({ email: 'misaki.tanaka@example.com' }),
      anInvitedMember({ email: 'Misaki.Tanaka@example.com' }),
      NOW,
    )

    // Assert
    expect(state).toBe('waiting')
  })

  it('should say first that the member is inactive, then that the address changed, then that it expired', () => {
    // Arrange
    const expired = new Date('2026-12-01T00:00:00Z')
    const elsewhere = anInvitedMember({ email: 'misaki.new@example.com' })

    // Act
    const states = [
      invitationStateOf(
        anInvitation(),
        { ...elsewhere, isActive: false },
        expired,
      ),
      invitationStateOf(anInvitation(), elsewhere, expired),
      invitationStateOf(anInvitation(), anInvitedMember(), expired),
    ]

    // Assert
    expect(states).toEqual(['inactive', 'elsewhere', 'expired'])
  })
})

describe('loginOf', () => {
  const ACCOUNT: AccountRead = { type: 'found', account: anAccount() }
  const INVITATION: InvitationRead = {
    type: 'found',
    invitation: anInvitation(),
  }
  const NONE: AccountRead & InvitationRead = { type: 'notFound' }

  it.each<
    [string, AccountRead | undefined, InvitationRead | undefined, LoginShown]
  >([
    [
      'an account, the invitation still being read',
      ACCOUNT,
      undefined,
      { type: 'account', account: anAccount() },
    ],
    [
      'the account still being read',
      undefined,
      INVITATION,
      { type: 'loading' },
    ],
    [
      'no account, the invitation still being read',
      NONE,
      undefined,
      { type: 'loading' },
    ],
    [
      'no account and an invitation',
      NONE,
      INVITATION,
      { type: 'invited', invitation: anInvitation() },
    ],
    ['neither', NONE, NONE, { type: 'none' }],
    [
      'a refusal of the invitation, the account found',
      ACCOUNT,
      { type: 'forbidden' },
      { type: 'forbidden' },
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      undefined,
      { type: 'forbidden' },
    ],
    [
      'no answer to the account',
      { type: 'failed' },
      INVITATION,
      { type: 'unread', reads: [{ type: 'failed' }, INVITATION] },
    ],
    [
      'no answer to the invitation',
      NONE,
      { type: 'tooManyRequests' },
      { type: 'unread', reads: [NONE, { type: 'tooManyRequests' }] },
    ],
  ])('should show %s', (_, account, invitation, shown) => {
    // Act
    const login = loginOf(account, invitation)

    // Assert
    expect(login).toEqual(shown)
  })
})
