import { Result } from '@beauty-salon-backend/utility'
import {
  authMessages,
  entityMessages,
  staffInvitationMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  DAY,
  NOW,
  PUBLIC_APP_URL,
  secondsFromNow,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import { STAFF_MEMBER_ID } from '../../../__tests__/fixtures/staff-fixtures'
import {
  apiStaffInvitation,
  dbStaffInvitation,
  INVITED_EMAIL,
  SALON_NAME,
  staffInvitationDependencies,
} from '../../../__tests__/fixtures/staff-invitation-fixtures'
import type { Actor } from '../../../models/auth'
import type { SalonRole } from '../../../models/staff-invitation'
import type {
  AcceptedStaffInvitation,
  HeldStaffInvitation,
  IStaffInvitationRepository,
  IssuedStaffInvitation,
  JoinedStaffInvitation,
  RevokedStaffInvitation,
  UsableStaffInvitation,
} from '../../../repositories/staff-invitation.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  AcceptStaffInvitationUseCase,
  CreateStaffInvitationUseCase,
  DeleteStaffInvitationUseCase,
  GetStaffInvitationUseCase,
  JoinStaffInvitationUseCase,
  type StaffInvitationUseCaseDependencies,
  VerifyStaffInvitationUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: entityMessages.salon, id: SALON_ID },
}
const staffNotFound = {
  type: 'error',
  error: {
    type: 'notFound',
    entity: entityMessages.staffMember,
    id: STAFF_MEMBER_ID,
  },
}
const invitationNotFound = {
  type: 'error',
  error: {
    type: 'notFound',
    entity: entityMessages.invitationOfStaffMember,
    id: STAFF_MEMBER_ID,
  },
}
/** The one answer for a token that cannot be used. */
const refused = {
  type: 'error',
  error: {
    type: 'validation',
    message: staffInvitationMessages.invalidStaffInvitation,
    issues: [
      {
        field: 'token',
        rule: 'invalid_token',
        message: authMessages.tokenInvalidOrExpired,
      },
    ],
  },
}
const addressHasAccount = {
  type: 'error',
  error: {
    type: 'alreadyExists',
    entity: entityMessages.user,
    field: 'email',
    value: INVITED_EMAIL,
  },
}

const belongsToStaff = Result.error(
  DomainErrors.conflict(staffInvitationMessages.accountBelongsToStaff),
)
const sentToAnotherAddress = Result.error(
  DomainErrors.conflict(staffInvitationMessages.sentToAnotherAddress),
)

/** A password that is long enough and on no blocklist. */
const NEW_PASSWORD = 'violet tram under the bridge'

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * What was called of the two repositories, the hasher and the token
 * issuer, in the order of the calls: `salons.exists`, `tokens.issue`,
 * `invitations.issue`, …
 */
const calls = ({
  salonRepository,
  staffInvitationRepository,
  passwordHasher,
  tokenIssuer,
}: StaffInvitationUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(staffInvitationRepository).map(([name, method]) => ({
      name: `invitations.${name}`,
      orders: callOrdersOf(method),
    })),
    { name: 'hasher.hash', orders: callOrdersOf(passwordHasher.hash) },
    { name: 'tokens.issue', orders: callOrdersOf(tokenIssuer.issue) },
    { name: 'tokens.hashOf', orders: callOrdersOf(tokenIssuer.hashOf) },
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** The mails that were handed to the mailer. */
const mailsOf = ({ mailer }: StaffInvitationUseCaseDependencies) =>
  vi.mocked(mailer.deliver).mock.calls.map(([mail]) => mail)

/** Dependencies in which there is no such salon. */
const withoutSalon = (): StaffInvitationUseCaseDependencies =>
  staffInvitationDependencies(
    {},
    { exists: vi.fn(async () => Result.success(false)) },
  )

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): StaffInvitationUseCaseDependencies =>
  staffInvitationDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Who invites the staff members of the salon of the fixtures. */
const inviters: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
]

/** Who has no say about the invitations of the salon. */
const others: [string, Actor][] = [
  ['a manager of the salon', actors.ofSalon('manager')],
  ['a staff member of the salon', actors.ofSalon('staff')],
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ['a staff member of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user without a scope', actors.withoutScope],
]

/** Salon and staff IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
]

/** A use case that is given only a salon and a staff member. */
type OfStaffMember = (
  dependencies: StaffInvitationUseCaseDependencies,
  actor: Actor,
  id: unknown,
  salon: unknown,
) => Promise<Result<unknown, DomainError>>

/** What the two use cases that are given only a salon and a staff member share. */
describe.each<[string, 'findByStaff' | 'revoke', OfStaffMember]>([
  [
    'GetStaffInvitationUseCase',
    'findByStaff',
    (dependencies, actor, id, salon) =>
      new GetStaffInvitationUseCase(dependencies).execute(actor, salon, id),
  ],
  [
    'DeleteStaffInvitationUseCase',
    'revoke',
    (dependencies, actor, id, salon) =>
      new DeleteStaffInvitationUseCase(dependencies).execute(actor, salon, id),
  ],
])('%s', (_name, method, run) => {
  const execute = (
    dependencies: StaffInvitationUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
    salon: unknown = SALON_ID,
  ) => run(dependencies, actor, id, salon)

  it.each(inviters)(
    'looks the salon up and then asks the repository, for %s',
    async (_who, actor) => {
      const dependencies = staffInvitationDependencies()

      const result = await execute(dependencies, actor)

      expect(result.type).toBe('success')
      expect(calls(dependencies)).toEqual([
        'salons.exists',
        `invitations.${method}`,
      ])
      expect(
        dependencies.staffInvitationRepository[method],
      ).toHaveBeenCalledWith(SALON_ID, STAFF_MEMBER_ID)
      expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    },
  )

  it.each(others)(
    'refuses %s before anything is looked up',
    async (_who, actor) => {
      const dependencies = staffInvitationDependencies()

      const result = await execute(dependencies, actor)

      expect(result).toEqual(forbidden)
      expect(calls(dependencies)).toEqual([])
    },
  )

  it.each(others)(
    'refuses %s also when the ID of the staff member is no UUID',
    async (_who, actor) => {
      expect(
        await execute(staffInvitationDependencies(), actor, 'latest'),
      ).toEqual(forbidden)
    },
  )

  it('refuses whoever may not, also when there is no such salon', async () => {
    const dependencies = withoutSalon()

    expect(await execute(dependencies, actors.ofSalon('manager'))).toEqual(
      forbidden,
    )
    expect(calls(dependencies)).toEqual([])
  })

  it.each(malformedIds)(
    'rejects %s as the salon, whoever asks',
    async (_case, salon) => {
      const dependencies = staffInvitationDependencies()

      const result = await execute(
        dependencies,
        actors.customer,
        STAFF_MEMBER_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(calls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the staff member before anything is looked up',
    async (_case, id) => {
      const dependencies = staffInvitationDependencies()

      const result = await execute(dependencies, actors.admin, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('answers that the salon was not found, without asking for the invitation', async () => {
    const dependencies = withoutSalon()

    expect(await execute(dependencies)).toEqual(salonNotFound)
    expect(calls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure of the salon lookup', async () => {
    const dependencies = withFailingSalonLookup()

    expect(await execute(dependencies)).toEqual(databaseDown)
    expect(calls(dependencies)).toEqual(['salons.exists'])
  })

  it('answers that the staff member was not found when the salon has none of that ID', async () => {
    const dependencies = staffInvitationDependencies({
      [method]: vi.fn(async () => Result.success({ type: 'staffNotFound' })),
    })

    expect(await execute(dependencies)).toEqual(staffNotFound)
  })

  it('answers that the invitation was not found when the staff member holds none', async () => {
    const dependencies = staffInvitationDependencies({
      [method]: vi.fn(async () => Result.success({ type: 'none' })),
    })

    expect(await execute(dependencies)).toEqual(invitationNotFound)
  })

  it('passes on a failure of the repository', async () => {
    const dependencies = staffInvitationDependencies({
      [method]: vi.fn(async () => databaseDown),
    })

    expect(await execute(dependencies)).toEqual(databaseDown)
  })

  it('sends no mail, issues no token and hashes nothing', async () => {
    const dependencies = staffInvitationDependencies()

    await execute(dependencies)

    expect(mailsOf(dependencies)).toEqual([])
    expect(dependencies.tokenIssuer.issue).not.toHaveBeenCalled()
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
  })
})

describe('GetStaffInvitationUseCase', () => {
  const get = (dependencies: StaffInvitationUseCaseDependencies) =>
    new GetStaffInvitationUseCase(dependencies).execute(
      actors.admin,
      SALON_ID,
      STAFF_MEMBER_ID,
    )

  it('returns the invitation the staff member holds, without the hash of its token', async () => {
    const result = await get(staffInvitationDependencies())

    expect(result).toEqual({ type: 'success', data: apiStaffInvitation() })
    expect(JSON.stringify(result)).not.toContain('sha256')
  })

  it('returns an invitation whose token has ended, as it is', async () => {
    const ended = dbStaffInvitation({
      expiresAt: '2026-11-01 09:00:00+00',
      createdAt: '2026-10-25 09:00:00+00',
    })
    const dependencies = staffInvitationDependencies({
      findByStaff: vi.fn(async () =>
        Result.success<HeldStaffInvitation>({
          type: 'held',
          invitation: ended,
        }),
      ),
    })

    expect(await get(dependencies)).toEqual({
      type: 'success',
      data: apiStaffInvitation({
        expiresAt: '2026-11-01T09:00:00.000Z',
        createdAt: '2026-10-25T09:00:00.000Z',
      }),
    })
  })

  it('reports a stored invitation that does not fit the API as a database error', async () => {
    const dependencies = staffInvitationDependencies({
      findByStaff: vi.fn(async () =>
        Result.success<HeldStaffInvitation>({
          type: 'held',
          invitation: dbStaffInvitation({ expiresAt: 'next week' }),
        }),
      ),
    })

    expect(await get(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })
})

describe('DeleteStaffInvitationUseCase', () => {
  it('resolves to the ID of the staff member whose invitation was taken back', async () => {
    const result = await new DeleteStaffInvitationUseCase(
      staffInvitationDependencies(),
    ).execute(actors.ofSalon('owner'), SALON_ID, STAFF_MEMBER_ID)

    expect(result).toEqual({ type: 'success', data: STAFF_MEMBER_ID })
  })

  it('resolves to the ID in lower case when the path has it in upper case', async () => {
    const dependencies = staffInvitationDependencies()

    const result = await new DeleteStaffInvitationUseCase(dependencies).execute(
      actors.admin,
      SALON_ID,
      STAFF_MEMBER_ID.toUpperCase(),
    )

    expect(result).toEqual({ type: 'success', data: STAFF_MEMBER_ID })
    expect(dependencies.staffInvitationRepository.revoke).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
    )
  })
})

describe('CreateStaffInvitationUseCase', () => {
  const invite = (
    dependencies: StaffInvitationUseCaseDependencies,
    input: unknown = { role: 'staff' },
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
    salon: unknown = SALON_ID,
  ) =>
    new CreateStaffInvitationUseCase(dependencies).execute(
      actor,
      salon,
      id,
      input,
    )

  /** Dependencies in which issuing has the given outcome. */
  const withOutcome = (
    outcome: IssuedStaffInvitation,
  ): StaffInvitationUseCaseDependencies =>
    staffInvitationDependencies({
      issue: vi.fn(async () => Result.success(outcome)),
    })

  it('issues an invitation with the hash of a new token, for seven days from now', async () => {
    const dependencies = staffInvitationDependencies()

    await invite(dependencies)

    expect(dependencies.staffInvitationRepository.issue).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      {
        role: 'staff',
        token: {
          tokenHash: 'sha256(token-1)',
          expiresAt: secondsFromNow(7 * DAY),
        },
        mailedMomentsAgoIfEndingAfter: secondsFromNow(7 * DAY - 60),
      },
    )
  })

  it('looks the salon up, then issues a token, then the invitation', async () => {
    const dependencies = staffInvitationDependencies()

    await invite(dependencies)

    expect(calls(dependencies)).toEqual([
      'salons.exists',
      'tokens.issue',
      'invitations.issue',
    ])
  })

  it('returns the invitation as it was stored, without the token and without its hash', async () => {
    const result = await invite(staffInvitationDependencies())

    expect(result).toEqual({
      type: 'success',
      data: apiStaffInvitation({
        expiresAt: secondsFromNow(7 * DAY),
        createdAt: NOW.toISOString(),
      }),
    })
    expect(JSON.stringify(result)).not.toContain('token-1')
  })

  it('mails the token to the address the repository stored, with the name of the salon', async () => {
    const dependencies = staffInvitationDependencies()

    await invite(dependencies)

    const mails = mailsOf(dependencies)
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({
      to: INVITED_EMAIL,
      subject: 'スタッフアカウントへの招待',
    })
    expect(mails[0]?.text.split('\n')).toContain(
      `${PUBLIC_APP_URL}/accept-staff-invitation#token=token-1`,
    )
    expect(mails[0]?.text).toContain(SALON_NAME)
  })

  it('mails to the address of the stored invitation, not to one of its own', async () => {
    const dependencies = withOutcome({
      type: 'issued',
      invitation: dbStaffInvitation({ email: 'ledger@aoyama.example.com' }),
      salonName: 'Another Name',
    })

    await invite(dependencies)

    expect(mailsOf(dependencies)).toMatchObject([
      { to: 'ledger@aoyama.example.com' },
    ])
    expect(mailsOf(dependencies)[0]?.text).toContain('Another Name')
  })

  it('answers without waiting for the mail to be delivered', async () => {
    const dependencies = staffInvitationDependencies(
      {},
      {},
      // A delivery that never ends.
      { mailer: { deliver: () => new Promise<void>(() => {}) } },
    )

    expect((await invite(dependencies)).type).toBe('success')
  })

  it.each<SalonRole>(['owner', 'manager', 'staff'])(
    'lets an administrator give the role %s',
    async (role) => {
      const dependencies = staffInvitationDependencies()

      const result = await invite(dependencies, { role })

      expect(result).toMatchObject({ type: 'success', data: { role } })
      expect(dependencies.staffInvitationRepository.issue).toHaveBeenCalledWith(
        SALON_ID,
        STAFF_MEMBER_ID,
        expect.objectContaining({ role }),
      )
    },
  )

  it.each<SalonRole>(['manager', 'staff'])(
    'lets the owner of the salon give the role %s',
    async (role) => {
      const result = await invite(
        staffInvitationDependencies(),
        { role },
        actors.ofSalon('owner'),
      )

      expect(result).toMatchObject({ type: 'success', data: { role } })
    },
  )

  it('does not let the owner of the salon make another owner, and looks nothing up', async () => {
    const dependencies = staffInvitationDependencies()

    const result = await invite(
      dependencies,
      { role: 'owner' },
      actors.ofSalon('owner'),
    )

    expect(result).toEqual(forbidden)
    expect(calls(dependencies)).toEqual([])
    expect(mailsOf(dependencies)).toEqual([])
  })

  it('refuses the owner the role of an owner also when there is no such salon or staff member', async () => {
    const dependencies = withoutSalon()

    expect(
      await invite(dependencies, { role: 'owner' }, actors.ofSalon('owner')),
    ).toEqual(forbidden)
  })

  it('reads the request before it decides about the role: a request of an owner that is no invitation is rejected', async () => {
    const result = await invite(
      staffInvitationDependencies(),
      { role: 'owner', email: 'someone@example.com' },
      actors.ofSalon('owner'),
    )

    expect(rulesOf(result)).toEqual(['email:unrecognized_keys'])
  })

  it.each(others)(
    'refuses %s before the request is read and before anything is looked up',
    async (_who, actor) => {
      const dependencies = staffInvitationDependencies()

      const result = await invite(dependencies, { role: 'boss' }, actor, 'x')

      expect(result).toEqual(forbidden)
      expect(calls(dependencies)).toEqual([])
      expect(mailsOf(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon, whoever asks',
    async (_case, salon) => {
      const result = await invite(
        staffInvitationDependencies(),
        { role: 'staff' },
        actors.customer,
        STAFF_MEMBER_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the staff member before the request is read',
    async (_case, id) => {
      const dependencies = staffInvitationDependencies()

      const result = await invite(
        dependencies,
        { role: 'boss' },
        actors.admin,
        id,
      )

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(calls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a missing role', {}, ['role:invalid_value']],
    ['the role of a customer', { role: 'customer' }, ['role:invalid_value']],
    ['the role of an administrator', { role: 'admin' }, ['role:invalid_value']],
    ['a role that is null', { role: null }, ['role:invalid_value']],
    [
      'an address for the mail',
      { role: 'staff', email: 'someone@example.com' },
      ['email:unrecognized_keys'],
    ],
    ['a list as the request', [], [':invalid_type']],
    ['no request', undefined, [':invalid_type']],
  ])(
    'rejects %s under the message of an invalid invitation, before anything is looked up',
    async (_case, input, expected) => {
      const dependencies = staffInvitationDependencies()

      const result = await new CreateStaffInvitationUseCase(
        dependencies,
      ).execute(actors.admin, SALON_ID, STAFF_MEMBER_ID, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: staffInvitationMessages.invalidStaffInvitation },
      })
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('answers that the salon was not found, and issues neither a token nor an invitation', async () => {
    const dependencies = withoutSalon()

    expect(await invite(dependencies)).toEqual(salonNotFound)
    expect(calls(dependencies)).toEqual(['salons.exists'])
    expect(mailsOf(dependencies)).toEqual([])
  })

  it('passes on a failure of the salon lookup', async () => {
    const dependencies = withFailingSalonLookup()

    expect(await invite(dependencies)).toEqual(databaseDown)
    expect(mailsOf(dependencies)).toEqual([])
  })

  it.each<[string, IssuedStaffInvitation, unknown]>([
    [
      'the salon has no such staff member',
      { type: 'staffNotFound' },
      staffNotFound,
    ],
    [
      'the staff member has an account',
      { type: 'linked' },
      Result.error(
        DomainErrors.conflict(
          staffInvitationMessages.alreadyHasAccount(STAFF_MEMBER_ID),
        ),
      ),
    ],
    [
      'the staff member is inactive',
      { type: 'inactive' },
      Result.error(
        DomainErrors.conflict(
          staffInvitationMessages.staffInactive(STAFF_MEMBER_ID),
        ),
      ),
    ],
    [
      'an invitation was mailed moments ago',
      { type: 'mailedMomentsAgo' },
      Result.error(
        DomainErrors.conflict(
          staffInvitationMessages.mailedMomentsAgo(STAFF_MEMBER_ID),
        ),
      ),
    ],
  ])('sends no mail and says why when %s', async (_case, outcome, expected) => {
    const dependencies = withOutcome(outcome)

    expect(await invite(dependencies)).toEqual(expected)
    expect(mailsOf(dependencies)).toEqual([])
  })

  it('passes on a failure of the repository and sends no mail', async () => {
    const dependencies = staffInvitationDependencies({
      issue: vi.fn(async () => databaseDown),
    })

    expect(await invite(dependencies)).toEqual(databaseDown)
    expect(mailsOf(dependencies)).toEqual([])
  })

  it('issues a different token for every invitation', async () => {
    const dependencies = staffInvitationDependencies()

    await invite(dependencies)
    await invite(dependencies)

    const links = mailsOf(dependencies).map(
      ({ text }) => text.split('#token=')[1]?.split('\n')[0],
    )
    expect(links).toEqual(['token-1', 'token-2'])
  })

  it('takes the time from the clock it is given', async () => {
    const later = new Date('2027-01-31T23:59:30.000Z')
    const dependencies = staffInvitationDependencies(
      {},
      {},
      { clock: () => later },
    )

    await invite(dependencies)

    expect(dependencies.staffInvitationRepository.issue).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      expect.objectContaining({
        token: {
          tokenHash: 'sha256(token-1)',
          expiresAt: '2027-02-07T23:59:30.000Z',
        },
        mailedMomentsAgoIfEndingAfter: '2027-02-07T23:58:30.000Z',
      }),
    )
  })
})

describe('VerifyStaffInvitationUseCase', () => {
  const verify = (
    dependencies: StaffInvitationUseCaseDependencies,
    input: unknown = { token: 'mailed-token' },
  ) => new VerifyStaffInvitationUseCase(dependencies).execute(input)

  /** Dependencies in which looking for the usable invitation has the given outcome. */
  const withFound = (
    found: UsableStaffInvitation,
  ): StaffInvitationUseCaseDependencies =>
    staffInvitationDependencies({
      findUsable: vi.fn(async () => Result.success(found)),
    })

  it('returns the invitation of a token that can be used, without the hash of the token, as one to accept', async () => {
    const result = await verify(staffInvitationDependencies())

    expect(result).toEqual({
      type: 'success',
      data: { invitation: apiStaffInvitation(), next: 'accept' },
    })
    expect(JSON.stringify(result)).not.toContain('sha256')
  })

  it('returns the invitation as one to join when the address has an account that joins', async () => {
    const dependencies = withFound({
      type: 'accountMayJoin',
      invitation: dbStaffInvitation({ role: 'manager' }),
    })

    const result = await verify(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        invitation: apiStaffInvitation({ role: 'manager' }),
        next: 'join',
      },
    })
    expect(JSON.stringify(result)).not.toContain('sha256')
  })

  it.each<UsableStaffInvitation['type']>(['usable', 'accountMayJoin'])(
    'reports a stored invitation that does not fit the API as a database error, when it is %s',
    async (type) => {
      const dependencies = withFound({
        type,
        invitation: dbStaffInvitation({ expiresAt: 'next week' }),
      })

      expect(await verify(dependencies)).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
    },
  )

  it('looks for the hash of the token, at the time of the clock, and writes nothing', async () => {
    const dependencies = staffInvitationDependencies()

    await verify(dependencies)

    expect(
      dependencies.staffInvitationRepository.findUsable,
    ).toHaveBeenCalledWith('sha256(mailed-token)', NOW.toISOString())
    expect(calls(dependencies)).toEqual([
      'tokens.hashOf',
      'invitations.findUsable',
    ])
  })

  it('gives the one answer for a token that cannot be used', async () => {
    expect(await verify(withFound({ type: 'unusable' }))).toEqual(refused)
  })

  it('tells the holder of the token that the address has an account', async () => {
    const dependencies = withFound({
      type: 'accountExists',
      invitation: dbStaffInvitation(),
    })

    expect(await verify(dependencies)).toEqual(addressHasAccount)
  })

  it.each([
    ['a missing token', {}, ['token:invalid_type']],
    ['an empty token', { token: '' }, ['token:too_small']],
    [
      'a token over 255 characters',
      { token: 't'.repeat(256) },
      ['token:too_big'],
    ],
    [
      'a password next to the token',
      { token: 'mailed-token', password: NEW_PASSWORD },
      ['password:unrecognized_keys'],
    ],
    ['no request', undefined, [':invalid_type']],
  ])(
    'rejects %s without looking for an invitation',
    async (_case, input, expected) => {
      const dependencies = staffInvitationDependencies()

      const result = await new VerifyStaffInvitationUseCase(
        dependencies,
      ).execute(input)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: staffInvitationMessages.invalidStaffInvitation },
      })
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('passes on a failure of the repository', async () => {
    const dependencies = staffInvitationDependencies({
      findUsable: vi.fn(async () => databaseDown),
    })

    expect(await verify(dependencies)).toEqual(databaseDown)
  })

  it('sends no mail and hashes no password', async () => {
    const dependencies = staffInvitationDependencies()

    await verify(dependencies)

    expect(mailsOf(dependencies)).toEqual([])
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
  })
})

describe('AcceptStaffInvitationUseCase', () => {
  const accept = (
    dependencies: StaffInvitationUseCaseDependencies,
    input: unknown = { token: 'mailed-token', password: NEW_PASSWORD },
  ) => new AcceptStaffInvitationUseCase(dependencies).execute(input)

  /** Dependencies in which the repository answers as given. */
  const withRepository = (
    overrides: Partial<IStaffInvitationRepository>,
  ): StaffInvitationUseCaseDependencies =>
    staffInvitationDependencies(overrides)

  const found = (outcome: UsableStaffInvitation) => ({
    findUsable: vi.fn(async () => Result.success(outcome)),
  })
  const accepted = (outcome: AcceptedStaffInvitation) => ({
    accept: vi.fn(async () => Result.success(outcome)),
  })

  it('creates the account with the hash of the password, at the time of the clock, and returns nothing', async () => {
    const dependencies = staffInvitationDependencies()

    const result = await accept(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.staffInvitationRepository.accept).toHaveBeenCalledWith(
      'sha256(mailed-token)',
      { passwordHash: `hashed:${NEW_PASSWORD}`, at: NOW.toISOString() },
    )
  })

  it('looks for the invitation, hashes the password and only then writes', async () => {
    const dependencies = staffInvitationDependencies()

    await accept(dependencies)

    expect(calls(dependencies)).toEqual([
      'tokens.hashOf',
      'invitations.findUsable',
      'hasher.hash',
      'invitations.accept',
    ])
    expect(
      dependencies.staffInvitationRepository.findUsable,
    ).toHaveBeenCalledWith('sha256(mailed-token)', NOW.toISOString())
  })

  it('hashes the password in NFC', async () => {
    const dependencies = staffInvitationDependencies()

    await accept(dependencies, {
      token: 'mailed-token',
      password: 'café au lait at dawn',
    })

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledWith(
      'café au lait at dawn',
    )
  })

  it('sends no mail and issues no token', async () => {
    const dependencies = staffInvitationDependencies()

    await accept(dependencies)

    expect(mailsOf(dependencies)).toEqual([])
    expect(dependencies.tokenIssuer.issue).not.toHaveBeenCalled()
  })

  it.each([
    ['a missing token', { password: NEW_PASSWORD }, ['token:invalid_type']],
    [
      'a missing password',
      { token: 'mailed-token' },
      ['password:invalid_type'],
    ],
    [
      'a password of 14 characters',
      { token: 'mailed-token', password: 'a'.repeat(7) + 'b'.repeat(7) },
      ['password:too_small'],
    ],
    [
      'a password of 129 characters',
      { token: 'mailed-token', password: `${'ab'.repeat(64)}c` },
      ['password:too_big'],
    ],
    [
      'an address for the account',
      { token: 'mailed-token', password: NEW_PASSWORD, email: 'x@example.com' },
      ['email:unrecognized_keys'],
    ],
    [
      'a role for the account',
      { token: 'mailed-token', password: NEW_PASSWORD, role: 'owner' },
      ['role:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
  ])(
    'rejects %s without looking for an invitation',
    async (_case, input, expected) => {
      const dependencies = staffInvitationDependencies()

      const result = await accept(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: staffInvitationMessages.invalidStaffInvitation },
      })
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('gives the one answer for a token that cannot be used, and hashes nothing', async () => {
    const dependencies = withRepository(found({ type: 'unusable' }))

    expect(await accept(dependencies)).toEqual(refused)
    expect(calls(dependencies)).toEqual([
      'tokens.hashOf',
      'invitations.findUsable',
    ])
  })

  it('tells the holder of the token that the address has an account, and hashes nothing', async () => {
    const dependencies = withRepository(
      found({ type: 'accountExists', invitation: dbStaffInvitation() }),
    )

    expect(await accept(dependencies)).toEqual(addressHasAccount)
    expect(calls(dependencies)).toEqual([
      'tokens.hashOf',
      'invitations.findUsable',
    ])
  })

  it('tells of the account also when it is one that joins: accepting creates an account, and the address has one', async () => {
    const dependencies = withRepository(
      found({ type: 'accountMayJoin', invitation: dbStaffInvitation() }),
    )

    expect(await accept(dependencies)).toEqual(addressHasAccount)
    expect(calls(dependencies)).toEqual([
      'tokens.hashOf',
      'invitations.findUsable',
    ])
  })

  it('tells of the account before it looks at the password: no password would work', async () => {
    const dependencies = withRepository(
      found({ type: 'accountExists', invitation: dbStaffInvitation() }),
    )

    const result = await accept(dependencies, {
      token: 'mailed-token',
      password: INVITED_EMAIL,
    })

    expect(result).toEqual(addressHasAccount)
  })

  it.each([
    ['the address of the invitation', INVITED_EMAIL],
    ['the address in another case', INVITED_EMAIL.toUpperCase()],
    ['one unit typed over and over', 'abc123'.repeat(3)],
    ['a well-known phrase', 'Correct Horse Battery Staple'],
  ])(
    'rejects %s as the password, and neither hashes nor writes',
    async (_case, password) => {
      const dependencies = staffInvitationDependencies()

      const result = await accept(dependencies, {
        token: 'mailed-token',
        password,
      })

      expect(rulesOf(result)).toEqual(['password:blocklisted'])
      expect(result).toMatchObject({
        error: { message: staffInvitationMessages.invalidStaffInvitation },
      })
      expect(calls(dependencies)).toEqual([
        'tokens.hashOf',
        'invitations.findUsable',
      ])
    },
  )

  it('holds the password against the address of the invitation that was found', async () => {
    const dependencies = withRepository(
      found({
        type: 'usable',
        invitation: dbStaffInvitation({ email: 'another@aoyama.example.com' }),
      }),
    )

    expect(
      rulesOf(
        await accept(dependencies, {
          token: 'mailed-token',
          password: 'another@aoyama.example.com',
        }),
      ),
    ).toEqual(['password:blocklisted'])
    expect(
      (
        await accept(dependencies, {
          token: 'mailed-token',
          password: INVITED_EMAIL,
        })
      ).type,
    ).toBe('success')
  })

  it('gives the one answer when the invitation stopped working before the account was written', async () => {
    const dependencies = withRepository(accepted({ type: 'unusable' }))

    expect(await accept(dependencies)).toEqual(refused)
  })

  it('tells of the account when the address was registered before the account was written', async () => {
    const dependencies = withRepository(accepted({ type: 'accountExists' }))

    expect(await accept(dependencies)).toEqual(addressHasAccount)
  })

  it('passes on a failure to find the invitation, and hashes nothing', async () => {
    const dependencies = withRepository({
      findUsable: vi.fn(async () => databaseDown),
    })

    expect(await accept(dependencies)).toEqual(databaseDown)
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
  })

  it('passes on a failure to hash the password, and writes nothing', async () => {
    const dependencies = staffInvitationDependencies()
    vi.mocked(dependencies.passwordHasher.hash).mockResolvedValueOnce(
      databaseDown,
    )

    expect(await accept(dependencies)).toEqual(databaseDown)
    expect(dependencies.staffInvitationRepository.accept).not.toHaveBeenCalled()
  })

  it('passes on a failure to write the account', async () => {
    const dependencies = withRepository({
      accept: vi.fn(async () => databaseDown),
    })

    expect(await accept(dependencies)).toEqual(databaseDown)
  })

  it('takes back nobody: revoking is not part of accepting', async () => {
    const dependencies = staffInvitationDependencies()

    await accept(dependencies)

    expect(dependencies.staffInvitationRepository.revoke).not.toHaveBeenCalled()
    expect(dependencies.staffInvitationRepository.issue).not.toHaveBeenCalled()
  })
})

describe('JoinStaffInvitationUseCase', () => {
  const join = (
    dependencies: StaffInvitationUseCaseDependencies,
    actor: Actor = actors.withoutScope,
    input: unknown = { token: 'mailed-token' },
  ) => new JoinStaffInvitationUseCase(dependencies).execute(actor, input)

  /** Dependencies in which joining has the given outcome. */
  const withJoined = (
    outcome: JoinedStaffInvitation,
  ): StaffInvitationUseCaseDependencies =>
    staffInvitationDependencies({
      join: vi.fn(async () => Result.success(outcome)),
    })

  it("links the actor's account by the hash of the token, at the time of the clock, and returns nothing", async () => {
    const dependencies = staffInvitationDependencies()

    const result = await join(dependencies)

    expect(result).toEqual({ type: 'success', data: null })
    expect(dependencies.staffInvitationRepository.join).toHaveBeenCalledWith(
      'sha256(mailed-token)',
      USER_ID,
      NOW.toISOString(),
    )
    expect(calls(dependencies)).toEqual(['tokens.hashOf', 'invitations.join'])
  })

  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
  ])('refuses %s before the request is read', async (_who, actor) => {
    const dependencies = staffInvitationDependencies()

    expect(await join(dependencies, actor)).toEqual(forbidden)
    expect(await join(dependencies, actor, {})).toEqual(forbidden)
    expect(calls(dependencies)).toEqual([])
  })

  it.each<[string, Actor]>([
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
    ['a staff member', actors.ofSalon('staff')],
    [
      'a staff member of another salon',
      actors.ofSalon('staff', OTHER_SALON_ID),
    ],
  ])(
    'tells %s that the account belongs to a staff member, and looks for no invitation',
    async (_who, actor) => {
      const dependencies = staffInvitationDependencies()

      expect(await join(dependencies, actor)).toEqual(belongsToStaff)
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('reads the request before it tells an account that it has a salon', async () => {
    const result = await join(
      staffInvitationDependencies(),
      actors.ofSalon('staff'),
      {},
    )

    expect(rulesOf(result)).toEqual(['token:invalid_type'])
  })

  it.each([
    ['a missing token', {}, ['token:invalid_type']],
    ['an empty token', { token: '' }, ['token:too_small']],
    [
      'a token over 255 characters',
      { token: 't'.repeat(256) },
      ['token:too_big'],
    ],
    [
      'a password next to the token',
      { token: 'mailed-token', password: NEW_PASSWORD },
      ['password:unrecognized_keys'],
    ],
    [
      'a role next to the token',
      { token: 'mailed-token', role: 'owner' },
      ['role:unrecognized_keys'],
    ],
    ['no request', undefined, [':invalid_type']],
  ])(
    'rejects %s without looking for an invitation',
    async (_case, input, expected) => {
      const dependencies = staffInvitationDependencies()

      const result = await new JoinStaffInvitationUseCase(dependencies).execute(
        actors.withoutScope,
        input,
      )

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: staffInvitationMessages.invalidStaffInvitation },
      })
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('gives the one answer for a token that cannot be used', async () => {
    expect(await join(withJoined({ type: 'unusable' }))).toEqual(refused)
  })

  it('tells the holder of the token that the invitation went to another address', async () => {
    expect(await join(withJoined({ type: 'otherAddress' }))).toEqual(
      sentToAnotherAddress,
    )
  })

  it('tells the account that it belongs to a staff member when it was linked before it was written', async () => {
    expect(await join(withJoined({ type: 'accountNotFree' }))).toEqual(
      belongsToStaff,
    )
  })

  it('passes on a failure of the repository', async () => {
    const dependencies = staffInvitationDependencies({
      join: vi.fn(async () => databaseDown),
    })

    expect(await join(dependencies)).toEqual(databaseDown)
  })

  it('leaves every decision about the invitation to the one write: nothing is looked for first', async () => {
    const dependencies = staffInvitationDependencies()

    await join(dependencies)

    expect(
      dependencies.staffInvitationRepository.findUsable,
    ).not.toHaveBeenCalled()
    expect(dependencies.staffInvitationRepository.accept).not.toHaveBeenCalled()
  })

  it('sends no mail, hashes no password and issues no token', async () => {
    const dependencies = staffInvitationDependencies()

    await join(dependencies)

    expect(mailsOf(dependencies)).toEqual([])
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
    expect(dependencies.tokenIssuer.issue).not.toHaveBeenCalled()
  })
})

describe('what a result of the repository cannot be mistaken for', () => {
  it.each<[string, JoinedStaffInvitation]>([
    ['a token that cannot be used', { type: 'unusable' }],
    ['an invitation to another address', { type: 'otherAddress' }],
    ['an account that has a salon', { type: 'accountNotFree' }],
  ])('does not report %s as a joined invitation', async (_case, outcome) => {
    const dependencies = staffInvitationDependencies({
      join: vi.fn(async () => Result.success(outcome)),
    })

    const result = await new JoinStaffInvitationUseCase(dependencies).execute(
      actors.withoutScope,
      { token: 'mailed-token' },
    )

    expect(result.type).toBe('error')
  })

  it.each<[string, RevokedStaffInvitation]>([
    ['no staff member', { type: 'staffNotFound' }],
    ['no invitation', { type: 'none' }],
  ])(
    'does not report %s as a taken-back invitation',
    async (_case, outcome) => {
      const dependencies = staffInvitationDependencies({
        revoke: vi.fn(async () => Result.success(outcome)),
      })

      const result = await new DeleteStaffInvitationUseCase(
        dependencies,
      ).execute(actors.admin, SALON_ID, STAFF_MEMBER_ID)

      expect(result.type).toBe('error')
    },
  )
})
