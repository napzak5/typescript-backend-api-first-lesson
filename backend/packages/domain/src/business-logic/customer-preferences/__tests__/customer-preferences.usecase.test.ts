import { Result } from '@beauty-salon-backend/utility'
import {
  customerPreferencesMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import { OTHER_CUSTOMER_ID } from '../../../__tests__/fixtures/customer-fixtures'
import {
  AVOIDED_STAFF_ID,
  apiCustomerPreferences,
  customerPreferencesDependencies,
  customerPreferencesUpdateRequest,
  dbCustomerPreferences,
  emptyCustomerPreferences,
  PREFERRED_STAFF_ID,
  customerPreferencesRepositoryCalls as repositoryCalls,
  UNNAMED_STAFF_ID,
} from '../../../__tests__/fixtures/customer-preferences-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type {
  CustomerPreferencesLookup,
  CustomerPreferencesUpdate,
  ICustomerPreferencesRepository,
} from '../../../repositories/customer-preferences.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  type CustomerPreferencesUseCaseDependencies,
  GetCustomerPreferencesUseCase,
  GetOwnCustomerPreferencesUseCase,
  UpdateCustomerPreferencesUseCase,
  UpdateOwnCustomerPreferencesUseCase,
} from '..'

const MESSAGE = 'Invalid customer preferences update'
const INVALID_UPDATE =
  customerPreferencesMessages.invalidCustomerPreferencesUpdate

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const customerNotFound = Result.error(
  DomainErrors.notFound('Customer', OTHER_CUSTOMER_ID),
)
const profileNotFound = Result.error(
  DomainErrors.notFound('Customer profile of user', USER_ID),
)
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** The message of a failed validation; null for anything else. */
const validationMessageOf = (
  result: Result<unknown, DomainError>,
): string | null =>
  result.type === 'error' && result.error.type === 'validation'
    ? toldIn(result.error.message, 'en')
    : null

const finding = (
  outcome: CustomerPreferencesLookup,
): Partial<ICustomerPreferencesRepository> => ({
  findByCustomerId: vi.fn(async () => Result.success(outcome)),
})

const updating = (
  outcome: CustomerPreferencesUpdate,
): Partial<ICustomerPreferencesRepository> => ({
  update: vi.fn(async () => Result.success(outcome)),
})

/** Preferences whose time slots cannot be turned into a response. */
const corruptPreferences = dbCustomerPreferences({ preferredTimeSlots: {} })

/** Those who keep the ledger. */
const keepers: [string, Actor][] = [
  ['an admin', actors.admin],
  ['the owner of a salon', actors.ofSalon('owner')],
  ['the manager of a salon', actors.ofSalon('manager')],
  ['the staff of a salon', actors.ofSalon('staff')],
]

/** Those the ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

/** Accounts that are not the account of a customer. */
const notCustomers: [string, Actor][] = [
  ['an admin', actors.admin],
  ['the owner of a salon', actors.ofSalon('owner')],
  ['the manager of a salon', actors.ofSalon('manager')],
  ['the staff of a salon', actors.ofSalon('staff')],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

describe('GetCustomerPreferencesUseCase', () => {
  const get = (
    dependencies: CustomerPreferencesUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = OTHER_CUSTOMER_ID,
  ) => new GetCustomerPreferencesUseCase(dependencies).execute(actor, id)

  it('returns the preferences of the customer of the path', async () => {
    const dependencies = customerPreferencesDependencies()

    const result = await get(dependencies)

    expect(result).toEqual({ type: 'success', data: apiCustomerPreferences() })
    expect(
      dependencies.customerPreferencesRepository.findByCustomerId,
    ).toHaveBeenCalledWith(OTHER_CUSTOMER_ID)
    expect(repositoryCalls(dependencies)).toEqual(['findByCustomerId'])
  })

  it.each(keepers)('lets %s read them', async (_case, actor) => {
    const result = await get(customerPreferencesDependencies(), actor)

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s without looking anything up, whatever the ID',
    async (_case, actor) => {
      const dependencies = customerPreferencesDependencies()

      expect(await get(dependencies, actor)).toEqual(forbidden)
      expect(await get(dependencies, actor, 'not-an-id')).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not let a customer read their own preferences through the ledger', async () => {
    const dependencies = customerPreferencesDependencies()

    expect(await get(dependencies, actors.customer, CUSTOMER_ID)).toEqual(
      forbidden,
    )
  })

  it('returns the empty preferences of a customer who has stated none', async () => {
    const dependencies = customerPreferencesDependencies(
      finding({ type: 'found', preferences: emptyCustomerPreferences() }),
    )

    expect(await get(dependencies)).toEqual({
      type: 'success',
      data: {
        preferredStaffId: null,
        preferredTimeSlots: [],
        avoidStaffIds: [],
        stylePreferences: null,
        communicationStyle: null,
        specialRequests: null,
      },
    })
  })

  it.each<[string, unknown]>([
    ['text that is not a UUID', 'me'],
    ['a number', 7],
    ['null', null],
  ])('rejects %s as the ID without looking anything up', async (_case, id) => {
    const dependencies = customerPreferencesDependencies()

    const result = await get(dependencies, actors.admin, id)

    expect(validationMessageOf(result)).toBe('Invalid customer ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('looks the customer up under the ID in lower case', async () => {
    const dependencies = customerPreferencesDependencies()

    await get(dependencies, actors.admin, OTHER_CUSTOMER_ID.toUpperCase())

    expect(
      dependencies.customerPreferencesRepository.findByCustomerId,
    ).toHaveBeenCalledWith(OTHER_CUSTOMER_ID)
  })

  it('does not find the preferences of a customer who does not exist, and names the customer', async () => {
    const dependencies = customerPreferencesDependencies(
      finding({ type: 'customerNotFound' }),
    )

    expect(await get(dependencies)).toEqual(customerNotFound)
  })

  it('names a customer who does not exist by the ID in lower case, however it was written', async () => {
    const dependencies = customerPreferencesDependencies(
      finding({ type: 'customerNotFound' }),
    )

    expect(
      await get(dependencies, actors.admin, OTHER_CUSTOMER_ID.toUpperCase()),
    ).toEqual(customerNotFound)
  })

  it('passes a failure of the repository on', async () => {
    const dependencies = customerPreferencesDependencies({
      findByCustomerId: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('answers with a database error when what is stored cannot be turned into a response', async () => {
    const dependencies = customerPreferencesDependencies(
      finding({ type: 'found', preferences: corruptPreferences }),
    )

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateCustomerPreferencesUseCase', () => {
  const update = (
    dependencies: CustomerPreferencesUseCaseDependencies,
    input: unknown = { communicationStyle: 'よく話したい' },
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = OTHER_CUSTOMER_ID,
  ) =>
    new UpdateCustomerPreferencesUseCase(dependencies).execute(actor, id, input)

  it('hands the properties of the request to the repository as the changes, and returns the preferences as they are afterwards', async () => {
    const dependencies = customerPreferencesDependencies()

    const result = await update(dependencies, {
      communicationStyle: 'よく話したい',
      specialRequests: null,
    })

    expect(result).toEqual({
      type: 'success',
      data: apiCustomerPreferences({
        communicationStyle: 'よく話したい',
        specialRequests: null,
      }),
    })
    expect(
      dependencies.customerPreferencesRepository.update,
    ).toHaveBeenCalledWith(OTHER_CUSTOMER_ID, {
      communicationStyle: 'よく話したい',
      specialRequests: null,
    })
    expect(repositoryCalls(dependencies)).toEqual(['update'])
  })

  it('hands on every property a request can state, each under its own name', async () => {
    const dependencies = customerPreferencesDependencies()
    const request = customerPreferencesUpdateRequest()

    const result = await update(dependencies, request)

    expect(result).toEqual({ type: 'success', data: request })
    expect(
      dependencies.customerPreferencesRepository.update,
    ).toHaveBeenCalledWith(OTHER_CUSTOMER_ID, request)
  })

  it('hands the IDs on in lower case', async () => {
    const dependencies = customerPreferencesDependencies()

    await update(
      dependencies,
      {
        preferredStaffId: UNNAMED_STAFF_ID.toUpperCase(),
        avoidStaffIds: [AVOIDED_STAFF_ID.toUpperCase()],
      },
      actors.admin,
      OTHER_CUSTOMER_ID.toUpperCase(),
    )

    expect(
      dependencies.customerPreferencesRepository.update,
    ).toHaveBeenCalledWith(OTHER_CUSTOMER_ID, {
      preferredStaffId: UNNAMED_STAFF_ID,
      avoidStaffIds: [AVOIDED_STAFF_ID],
    })
  })

  it.each(keepers)('lets %s change them', async (_case, actor) => {
    const result = await update(
      customerPreferencesDependencies(),
      { specialRequests: 'x' },
      actor,
    )

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s before the ID and the request are read',
    async (_case, actor) => {
      const dependencies = customerPreferencesDependencies()

      expect(await update(dependencies, undefined, actor)).toEqual(forbidden)
      expect(await update(dependencies, {}, actor, 'not-an-id')).toEqual(
        forbidden,
      )
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reads the ID before the request', async () => {
    const dependencies = customerPreferencesDependencies()

    const result = await update(dependencies, {}, actors.admin, 'not-an-id')

    expect(validationMessageOf(result)).toBe('Invalid customer ID')
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each<[string, unknown, string[]]>([
    ['an empty request', {}, [':custom']],
    ['a request that is not an object', 'quiet', [':invalid_type']],
    [
      'a property the preferences do not have',
      { notes: 'x' },
      ['notes:unrecognized_keys'],
    ],
    [
      'a list that is null',
      { avoidStaffIds: null },
      ['avoidStaffIds:invalid_type'],
    ],
    [
      'time slots that overlap',
      {
        preferredTimeSlots: [
          { startTime: '10:00', endTime: '12:00' },
          { startTime: '11:00', endTime: '13:00' },
        ],
      },
      ['preferredTimeSlots.1:custom'],
    ],
    [
      'a communication style that is too long',
      { communicationStyle: 'あ'.repeat(101) },
      ['communicationStyle:too_big'],
    ],
  ])('rejects %s without writing anything', async (_case, input, rules) => {
    const dependencies = customerPreferencesDependencies()

    const result = await update(dependencies, input)

    expect(validationMessageOf(result)).toBe(MESSAGE)
    expect(rulesOf(result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each<[string, string[]]>([
    ['the only one', [PREFERRED_STAFF_ID]],
    ['one of several', [AVOIDED_STAFF_ID, PREFERRED_STAFF_ID]],
  ])(
    'rejects a request whose preferred staff member is %s of the avoided ones it states, without writing anything',
    async (_case, avoidStaffIds) => {
      const dependencies = customerPreferencesDependencies()

      const result = await update(dependencies, {
        preferredStaffId: PREFERRED_STAFF_ID,
        avoidStaffIds,
      })

      expect(validationMessageOf(result)).toBe(MESSAGE)
      expect(rulesOf(result)).toEqual(['preferredStaffId:avoided'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('finds the preferred staff member among the avoided ones however the two are written', async () => {
    const dependencies = customerPreferencesDependencies()

    const result = await update(dependencies, {
      preferredStaffId: PREFERRED_STAFF_ID.toUpperCase(),
      avoidStaffIds: [PREFERRED_STAFF_ID],
    })

    expect(rulesOf(result)).toEqual(['preferredStaffId:avoided'])
  })

  it.each<[string, Record<string, unknown>]>([
    [
      'a preferred staff member and avoided ones that do not include them',
      {
        preferredStaffId: PREFERRED_STAFF_ID,
        avoidStaffIds: [AVOIDED_STAFF_ID],
      },
    ],
    [
      'no preferred staff member and avoided ones',
      { preferredStaffId: null, avoidStaffIds: [PREFERRED_STAFF_ID] },
    ],
    [
      'a preferred staff member and no avoided ones',
      { preferredStaffId: PREFERRED_STAFF_ID, avoidStaffIds: [] },
    ],
    [
      'a preferred staff member alone, whom the stored preferences may avoid',
      { preferredStaffId: AVOIDED_STAFF_ID },
    ],
    [
      'avoided ones alone, of whom the stored preferences may prefer one',
      { avoidStaffIds: [PREFERRED_STAFF_ID] },
    ],
  ])('leaves a request with %s to the repository', async (_case, input) => {
    const dependencies = customerPreferencesDependencies()

    await update(dependencies, input)

    expect(repositoryCalls(dependencies)).toEqual(['update'])
  })

  it('does not find a customer who does not exist, and names the customer', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'customerNotFound' }),
    )

    expect(await update(dependencies)).toEqual(customerNotFound)
  })

  it('names a customer who does not exist by the ID in lower case, however it was written', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'customerNotFound' }),
    )

    expect(
      await update(
        dependencies,
        { communicationStyle: 'よく話したい' },
        actors.admin,
        OTHER_CUSTOMER_ID.toUpperCase(),
      ),
    ).toEqual(customerNotFound)
  })

  it('reports the rules the preferences would break once changed, as the repository found them', async () => {
    const issues = [
      {
        field: 'preferredStaffId',
        rule: 'avoided',
        message: customerPreferencesMessages.notAvoidedStaffMember,
      },
    ]
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'invalid', issues }),
    )

    expect(
      await update(dependencies, { avoidStaffIds: [PREFERRED_STAFF_ID] }),
    ).toEqual(Result.error(DomainErrors.validation(INVALID_UPDATE, issues)))
  })

  it.each<[string, Record<string, unknown>, string[], string[]]>([
    [
      'the preferred staff member',
      { preferredStaffId: UNNAMED_STAFF_ID },
      [UNNAMED_STAFF_ID],
      ['preferredStaffId:not_found'],
    ],
    [
      'an avoided staff member, under their index',
      { avoidStaffIds: [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID] },
      [UNNAMED_STAFF_ID],
      ['avoidStaffIds.1:not_found'],
    ],
    [
      'every avoided staff member',
      { avoidStaffIds: [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID] },
      [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID],
      ['avoidStaffIds.0:not_found', 'avoidStaffIds.1:not_found'],
    ],
    [
      'the preferred staff member and an avoided one',
      {
        preferredStaffId: PREFERRED_STAFF_ID,
        avoidStaffIds: [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID],
      },
      [PREFERRED_STAFF_ID, AVOIDED_STAFF_ID],
      ['preferredStaffId:not_found', 'avoidStaffIds.0:not_found'],
    ],
    [
      'the avoided one alone, when the preferred one of the request was found',
      {
        preferredStaffId: PREFERRED_STAFF_ID,
        avoidStaffIds: [UNNAMED_STAFF_ID],
      },
      [UNNAMED_STAFF_ID],
      ['avoidStaffIds.0:not_found'],
    ],
  ])(
    'tells where the request names a staff member who was not found: %s',
    async (_case, input, staffIds, rules) => {
      const dependencies = customerPreferencesDependencies(
        updating({ type: 'staffNotFound', staffIds }),
      )

      const result = await update(dependencies, input)

      expect(validationMessageOf(result)).toBe(MESSAGE)
      expect(rulesOf(result)).toEqual(rules)
    },
  )

  it('says what a staff member who was not found must be', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'staffNotFound', staffIds: [UNNAMED_STAFF_ID] }),
    )

    expect(
      await update(dependencies, { preferredStaffId: UNNAMED_STAFF_ID }),
    ).toEqual(
      Result.error(
        DomainErrors.validation(INVALID_UPDATE, [
          {
            field: 'preferredStaffId',
            rule: 'not_found',
            message: ruleMessages.aStaffMember,
          },
        ]),
      ),
    )
  })

  it('does not take a cleared preferred staff member for one who was not found', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'staffNotFound', staffIds: [UNNAMED_STAFF_ID] }),
    )

    const result = await update(dependencies, {
      preferredStaffId: null,
      avoidStaffIds: [UNNAMED_STAFF_ID],
    })

    expect(rulesOf(result)).toEqual(['avoidStaffIds.0:not_found'])
  })

  it('passes a failure of the repository on', async () => {
    const dependencies = customerPreferencesDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })

  it('answers with a database error when what is stored cannot be turned into a response', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'updated', preferences: corruptPreferences }),
    )

    expect(await update(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('GetOwnCustomerPreferencesUseCase', () => {
  const get = (
    dependencies: CustomerPreferencesUseCaseDependencies,
    actor: Actor = actors.customer,
  ) => new GetOwnCustomerPreferencesUseCase(dependencies).execute(actor)

  it('returns the preferences of the customer of the account', async () => {
    const dependencies = customerPreferencesDependencies()

    const result = await get(dependencies)

    expect(result).toEqual({ type: 'success', data: apiCustomerPreferences() })
    expect(
      dependencies.customerPreferencesRepository.findByCustomerId,
    ).toHaveBeenCalledWith(CUSTOMER_ID)
    expect(repositoryCalls(dependencies)).toEqual(['findByCustomerId'])
  })

  it.each(notCustomers)(
    'refuses %s without looking anything up',
    async (_case, actor) => {
      const dependencies = customerPreferencesDependencies()

      expect(await get(dependencies, actor)).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not find the preferences of an account without a profile, without looking anything up', async () => {
    const dependencies = customerPreferencesDependencies()

    expect(await get(dependencies, actors.customerWithoutProfile)).toEqual(
      profileNotFound,
    )
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers as for a missing profile when the customer was deleted after the actor was authenticated', async () => {
    const dependencies = customerPreferencesDependencies(
      finding({ type: 'customerNotFound' }),
    )

    expect(await get(dependencies)).toEqual(profileNotFound)
  })

  it('returns the empty preferences of a customer who has stated none', async () => {
    const dependencies = customerPreferencesDependencies(
      finding({ type: 'found', preferences: emptyCustomerPreferences() }),
    )

    expect(await get(dependencies)).toEqual({
      type: 'success',
      data: emptyCustomerPreferences(),
    })
  })

  it('passes a failure of the repository on', async () => {
    const dependencies = customerPreferencesDependencies({
      findByCustomerId: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('answers with a database error when what is stored cannot be turned into a response', async () => {
    const dependencies = customerPreferencesDependencies(
      finding({ type: 'found', preferences: corruptPreferences }),
    )

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateOwnCustomerPreferencesUseCase', () => {
  const update = (
    dependencies: CustomerPreferencesUseCaseDependencies,
    input: unknown = { communicationStyle: 'よく話したい' },
    actor: Actor = actors.customer,
  ) =>
    new UpdateOwnCustomerPreferencesUseCase(dependencies).execute(actor, input)

  it('changes the preferences of the customer of the account, and returns them as they are afterwards', async () => {
    const dependencies = customerPreferencesDependencies()

    const result = await update(dependencies, {
      preferredStaffId: UNNAMED_STAFF_ID,
      specialRequests: null,
    })

    expect(result).toEqual({
      type: 'success',
      data: apiCustomerPreferences({
        preferredStaffId: UNNAMED_STAFF_ID,
        specialRequests: null,
      }),
    })
    expect(
      dependencies.customerPreferencesRepository.update,
    ).toHaveBeenCalledWith(CUSTOMER_ID, {
      preferredStaffId: UNNAMED_STAFF_ID,
      specialRequests: null,
    })
    expect(repositoryCalls(dependencies)).toEqual(['update'])
  })

  it('lets the customer state every property the ledger can', async () => {
    const dependencies = customerPreferencesDependencies()
    const request = customerPreferencesUpdateRequest()

    const result = await update(dependencies, request)

    expect(result).toEqual({ type: 'success', data: request })
    expect(
      dependencies.customerPreferencesRepository.update,
    ).toHaveBeenCalledWith(CUSTOMER_ID, request)
  })

  it.each(notCustomers)(
    'refuses %s before the request is read',
    async (_case, actor) => {
      const dependencies = customerPreferencesDependencies()

      expect(await update(dependencies, undefined, actor)).toEqual(forbidden)
      expect(await update(dependencies, {}, actor)).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not find the preferences of an account without a profile, before the request is read', async () => {
    const dependencies = customerPreferencesDependencies()

    expect(
      await update(dependencies, {}, actors.customerWithoutProfile),
    ).toEqual(profileNotFound)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each<[string, unknown, string[]]>([
    ['an empty request', {}, [':custom']],
    [
      'a property the preferences do not have',
      { customerId: OTHER_CUSTOMER_ID },
      ['customerId:unrecognized_keys'],
    ],
    [
      'a staff member avoided twice',
      { avoidStaffIds: [AVOIDED_STAFF_ID, AVOIDED_STAFF_ID] },
      ['avoidStaffIds.1:custom'],
    ],
    [
      'a preferred staff member the request avoids',
      {
        preferredStaffId: PREFERRED_STAFF_ID,
        avoidStaffIds: [PREFERRED_STAFF_ID],
      },
      ['preferredStaffId:avoided'],
    ],
  ])('rejects %s without writing anything', async (_case, input, rules) => {
    const dependencies = customerPreferencesDependencies()

    const result = await update(dependencies, input)

    expect(validationMessageOf(result)).toBe(MESSAGE)
    expect(rulesOf(result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers as for a missing profile when the customer was deleted after the actor was authenticated', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'customerNotFound' }),
    )

    expect(await update(dependencies)).toEqual(profileNotFound)
  })

  it('tells where the request names a staff member who was not found', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({
        type: 'staffNotFound',
        staffIds: [PREFERRED_STAFF_ID, UNNAMED_STAFF_ID],
      }),
    )

    const result = await update(dependencies, {
      preferredStaffId: PREFERRED_STAFF_ID,
      avoidStaffIds: [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID],
    })

    expect(validationMessageOf(result)).toBe(MESSAGE)
    expect(rulesOf(result)).toEqual([
      'preferredStaffId:not_found',
      'avoidStaffIds.1:not_found',
    ])
  })

  it('reports the rules the preferences would break once changed', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({
        type: 'invalid',
        issues: [
          {
            field: 'preferredStaffId',
            rule: 'avoided',
            message: customerPreferencesMessages.notAvoidedStaffMember,
          },
        ],
      }),
    )

    const result = await update(dependencies, {
      preferredStaffId: AVOIDED_STAFF_ID,
    })

    expect(validationMessageOf(result)).toBe(MESSAGE)
    expect(rulesOf(result)).toEqual(['preferredStaffId:avoided'])
  })

  it('passes a failure of the repository on', async () => {
    const dependencies = customerPreferencesDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })

  it('answers with a database error when what is stored cannot be turned into a response', async () => {
    const dependencies = customerPreferencesDependencies(
      updating({ type: 'updated', preferences: corruptPreferences }),
    )

    expect(await update(dependencies)).toEqual(storedRowIsCorrupt)
  })
})
