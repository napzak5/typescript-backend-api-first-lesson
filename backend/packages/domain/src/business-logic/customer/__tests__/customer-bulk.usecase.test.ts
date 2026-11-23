import { Result } from '@beauty-salon-backend/utility'
import {
  customerMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiCustomer,
  customerCreateRequest,
  customerDependencies,
  dbCustomer,
  OTHER_CUSTOMER_ID,
  REFERRER_ID,
} from '../../../__tests__/fixtures/customer-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type {
  CustomerBulkCreation,
  CustomerBulkDeletion,
  CustomerBulkUpdate,
  ICustomerRepository,
} from '../../../repositories/customer.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  BatchGetCustomersUseCase,
  BulkCreateCustomersUseCase,
  BulkDeleteCustomersUseCase,
  BulkUpdateCustomersUseCase,
} from '..'

/** A third customer of the ledger. */
const THIRD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1c03'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const emailTaken = Result.error(
  DomainErrors.alreadyExists(
    entityMessages.customer,
    'email',
    'second@example.com',
  ),
)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** A new customer of an email, with the rest of the fixture request. */
const newCustomer = (email: string, referredBy: string | null = null) => ({
  ...customerCreateRequest(),
  email,
  referralCode: null,
  referredBy,
})

/** What the methods of a fake repository were called with. */
const callsOf = (
  repository: ICustomerRepository,
  method: 'findByIds' | 'createMany' | 'updateMany' | 'deleteMany',
): unknown[][] => vi.mocked(repository[method]).mock.calls

/** Who may: the platform's administrators and every member of a salon. */
const keepers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
]

/** Who may not: those who are no member of a salon. */
const strangers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user of no scope', actors.withoutScope],
]

describe('BatchGetCustomersUseCase', () => {
  const ofIds = (repository: Partial<ICustomerRepository> = {}) =>
    customerDependencies({
      findByIds: vi.fn(async () =>
        Result.success([
          dbCustomer({ id: THIRD_ID, email: 'third@example.com' }),
          dbCustomer(),
          dbCustomer({ id: OTHER_CUSTOMER_ID, email: 'other@example.com' }),
        ]),
      ),
      ...repository,
    })

  it('answers the customers in the order of the IDs, whatever order the repository finds them in', async () => {
    const dependencies = ofIds()

    const result = await new BatchGetCustomersUseCase(dependencies).execute(
      actors.admin,
      { ids: [OTHER_CUSTOMER_ID, CUSTOMER_ID, THIRD_ID] },
    )

    expect(result).toEqual(
      Result.success([
        apiCustomer({ id: OTHER_CUSTOMER_ID, email: 'other@example.com' }),
        apiCustomer(),
        apiCustomer({ id: THIRD_ID, email: 'third@example.com' }),
      ]),
    )
    expect(callsOf(dependencies.customerRepository, 'findByIds')).toEqual([
      [[OTHER_CUSTOMER_ID, CUSTOMER_ID, THIRD_ID]],
    ])
  })

  it('reads IDs in capitals as the same IDs', async () => {
    const dependencies = ofIds()

    const result = await new BatchGetCustomersUseCase(dependencies).execute(
      actors.admin,
      { ids: [THIRD_ID.toUpperCase()] },
    )

    expect(result.type).toBe('success')
    expect(callsOf(dependencies.customerRepository, 'findByIds')).toEqual([
      [[THIRD_ID]],
    ])
  })

  it.each(keepers)('lets %s read them', async (_who, actor) => {
    const result = await new BatchGetCustomersUseCase(ofIds()).execute(actor, {
      ids: [CUSTOMER_ID],
    })

    expect(result).toEqual(Result.success([apiCustomer()]))
  })

  it.each(strangers)(
    'refuses %s before the request is read',
    async (_who, actor) => {
      const dependencies = ofIds()

      const results = [
        await new BatchGetCustomersUseCase(dependencies).execute(actor, {
          ids: [CUSTOMER_ID],
        }),
        await new BatchGetCustomersUseCase(dependencies).execute(actor, 'x'),
      ]

      expect(results).toEqual([forbidden, forbidden])
      expect(callsOf(dependencies.customerRepository, 'findByIds')).toEqual([])
    },
  )

  it('answers not found with the first customer of the request that is missing', async () => {
    const dependencies = customerDependencies({
      findByIds: vi.fn(async () => Result.success([dbCustomer()])),
    })

    const result = await new BatchGetCustomersUseCase(dependencies).execute(
      actors.admin,
      { ids: [CUSTOMER_ID, THIRD_ID, OTHER_CUSTOMER_ID] },
    )

    expect(result).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.customer, THIRD_ID)),
    )
  })

  it.each<[string, unknown, string[]]>([
    ['no object', 'ids', [':invalid_type']],
    ['no IDs', {}, ['ids:invalid_type']],
    ['an empty list', { ids: [] }, ['ids:too_small']],
    [
      'a hundred and one IDs',
      {
        ids: Array.from(
          { length: 101 },
          (_, index) =>
            `0193a5b8-7c2e-7d4f-8a1b-${String(index).padStart(12, '0')}`,
        ),
      },
      ['ids:too_big'],
    ],
    [
      'an ID that is no UUID',
      { ids: [CUSTOMER_ID, 'x'] },
      ['ids.1:invalid_format'],
    ],
    [
      'an ID twice, once in capitals',
      { ids: [CUSTOMER_ID, THIRD_ID, CUSTOMER_ID.toUpperCase()] },
      ['ids.2:custom'],
    ],
    [
      'another property',
      { ids: [CUSTOMER_ID], salonId: CUSTOMER_ID },
      ['salonId:unrecognized_keys'],
    ],
  ])('refuses a request with %s', async (_case, input, rules) => {
    const dependencies = ofIds()

    const result = await new BatchGetCustomersUseCase(dependencies).execute(
      actors.admin,
      input,
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(callsOf(dependencies.customerRepository, 'findByIds')).toEqual([])
  })

  it('takes a hundred IDs', async () => {
    const ids = Array.from(
      { length: 100 },
      (_, index) =>
        `0193a5b8-7c2e-7d4f-8a1b-${String(index).padStart(12, '0')}`,
    )
    const dependencies = customerDependencies({
      findByIds: vi.fn(async () =>
        Result.success(
          ids.map((id) => dbCustomer({ id, email: `${id}@example.com` })),
        ),
      ),
    })

    const result = await new BatchGetCustomersUseCase(dependencies).execute(
      actors.admin,
      { ids },
    )

    expect(
      result.type === 'success' && result.data.map(({ id }) => id),
    ).toEqual(ids)
  })

  it('passes a failure of the database on, and refuses a stored row it cannot read', async () => {
    const down = await new BatchGetCustomersUseCase(
      customerDependencies({ findByIds: vi.fn(async () => databaseDown) }),
    ).execute(actors.admin, { ids: [CUSTOMER_ID] })
    const corrupt = await new BatchGetCustomersUseCase(
      customerDependencies({
        findByIds: vi.fn(async () =>
          Result.success([dbCustomer({ updatedAt: 'yesterday' })]),
        ),
      }),
    ).execute(actors.admin, { ids: [CUSTOMER_ID] })

    expect(down).toEqual(databaseDown)
    expect(corrupt).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })
})

describe('BulkCreateCustomersUseCase', () => {
  const creating = (outcome: CustomerBulkCreation) =>
    customerDependencies({
      createMany: vi.fn(async () => Result.success(outcome)),
    })
  const created = creating({
    type: 'created',
    customers: [
      dbCustomer({ id: OTHER_CUSTOMER_ID }),
      dbCustomer({ id: THIRD_ID }),
    ],
  })

  it('writes the customers in the order of the request and answers their IDs in that order', async () => {
    const dependencies = created

    const result = await new BulkCreateCustomersUseCase(dependencies).execute(
      actors.ofSalon('staff'),
      {
        items: [
          newCustomer('First@Example.com'),
          newCustomer('second@example.com', REFERRER_ID),
        ],
      },
    )

    expect(result).toEqual(
      Result.success({ created: [OTHER_CUSTOMER_ID, THIRD_ID] }),
    )
    expect(callsOf(dependencies.customerRepository, 'createMany')).toEqual([
      [
        [
          expect.objectContaining({
            email: 'first@example.com',
            referredBy: null,
          }),
          expect.objectContaining({
            email: 'second@example.com',
            referredBy: REFERRER_ID,
          }),
        ],
        USER_ID,
      ],
    ])
  })

  it.each(keepers)('lets %s add customers', async (_who, actor) => {
    const result = await new BulkCreateCustomersUseCase(created).execute(
      actor,
      { items: [newCustomer('first@example.com')] },
    )

    expect(result.type).toBe('success')
  })

  it.each(strangers)(
    'refuses %s before the request is read',
    async (_who, actor) => {
      const dependencies = created

      const results = [
        await new BulkCreateCustomersUseCase(dependencies).execute(actor, {
          items: [newCustomer('first@example.com')],
        }),
        await new BulkCreateCustomersUseCase(dependencies).execute(actor, {}),
      ]

      expect(results).toEqual([forbidden, forbidden])
    },
  )

  it.each<[string, unknown, string[]]>([
    ['no items', {}, ['items:invalid_type']],
    ['an empty list', { items: [] }, ['items:too_small']],
    [
      'a hundred and one items',
      {
        items: Array.from({ length: 101 }, (_, index) =>
          newCustomer(`c${index}@example.com`),
        ),
      },
      ['items:too_big'],
    ],
    [
      'an item that breaks a rule of its shape',
      {
        items: [
          newCustomer('first@example.com'),
          { ...newCustomer('x'), tags: ['a', 'a'] },
        ],
      },
      ['items.1.email:invalid_format', 'items.1.tags.1:custom'],
    ],
    [
      'an item without a property',
      {
        items: [{ ...newCustomer('first@example.com'), firstName: undefined }],
      },
      ['items.0.firstName:invalid_type'],
    ],
    [
      'an item that writes what the ledger counts',
      { items: [{ ...newCustomer('first@example.com'), visitCount: 3 }] },
      ['items.0.visitCount:unrecognized_keys'],
    ],
  ])('refuses a request with %s', async (_case, input, rules) => {
    const dependencies = created

    const result = await new BulkCreateCustomersUseCase(dependencies).execute(
      actors.admin,
      input,
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(callsOf(dependencies.customerRepository, 'createMany')).toEqual([])
  })

  it('refuses the birth dates in the future at their items, before anything is written', async () => {
    const dependencies = created

    const result = await new BulkCreateCustomersUseCase(dependencies).execute(
      actors.admin,
      {
        items: [
          { ...newCustomer('first@example.com'), birthDate: '2026-11-16' },
          newCustomer('second@example.com'),
          { ...newCustomer('third@example.com'), birthDate: '2027-01-01' },
        ],
      },
    )

    expect(rulesOf(result)).toEqual([
      'items.0.birthDate:too_big',
      'items.2.birthDate:too_big',
    ])
    expect(callsOf(dependencies.customerRepository, 'createMany')).toEqual([])
  })

  it('refuses every item whose referrer is missing, at its place', async () => {
    const result = await new BulkCreateCustomersUseCase(
      creating({ type: 'referrersNotFound', missing: [THIRD_ID] }),
    ).execute(actors.admin, {
      items: [
        newCustomer('first@example.com', THIRD_ID),
        newCustomer('second@example.com', REFERRER_ID),
        newCustomer('third@example.com'),
        newCustomer('fourth@example.com', THIRD_ID.toUpperCase()),
      ],
    })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: customerMessages.invalidCustomers },
    })
    expect(rulesOf(result)).toEqual([
      'items.0.referredBy:not_found',
      'items.3.referredBy:not_found',
    ])
  })

  it('passes a taken email and a failure of the database on', async () => {
    const taken = await new BulkCreateCustomersUseCase(
      customerDependencies({ createMany: vi.fn(async () => emailTaken) }),
    ).execute(actors.admin, { items: [newCustomer('second@example.com')] })
    const down = await new BulkCreateCustomersUseCase(
      customerDependencies({ createMany: vi.fn(async () => databaseDown) }),
    ).execute(actors.admin, { items: [newCustomer('second@example.com')] })

    expect(taken).toEqual(emailTaken)
    expect(down).toEqual(databaseDown)
  })
})

describe('BulkUpdateCustomersUseCase', () => {
  const updating = (outcome: CustomerBulkUpdate) =>
    customerDependencies({
      updateMany: vi.fn(async () => Result.success(outcome)),
    })
  const updated = updating({
    type: 'updated',
    customers: [dbCustomer({ id: THIRD_ID }), dbCustomer({ id: CUSTOMER_ID })],
  })

  it('writes the changes in the order of the request and answers the IDs in that order', async () => {
    const dependencies = updated

    const result = await new BulkUpdateCustomersUseCase(dependencies).execute(
      actors.ofSalon('staff'),
      {
        items: [
          { id: THIRD_ID.toUpperCase(), updates: { notes: null } },
          {
            id: CUSTOMER_ID,
            updates: { email: 'New@Example.com', referredBy: REFERRER_ID },
          },
        ],
      },
    )

    expect(result).toEqual(Result.success({ updated: [THIRD_ID, CUSTOMER_ID] }))
    expect(callsOf(dependencies.customerRepository, 'updateMany')).toEqual([
      [
        [
          { id: THIRD_ID, changes: { notes: null } },
          {
            id: CUSTOMER_ID,
            changes: { email: 'new@example.com', referredBy: REFERRER_ID },
          },
        ],
        USER_ID,
      ],
    ])
  })

  it.each(strangers)(
    'refuses %s before the request is read',
    async (_who, actor) => {
      const results = [
        await new BulkUpdateCustomersUseCase(updated).execute(actor, {
          items: [{ id: CUSTOMER_ID, updates: { notes: null } }],
        }),
        await new BulkUpdateCustomersUseCase(updated).execute(actor, []),
      ]

      expect(results).toEqual([forbidden, forbidden])
    },
  )

  it.each(keepers)('lets %s change customers', async (_who, actor) => {
    const result = await new BulkUpdateCustomersUseCase(updated).execute(
      actor,
      { items: [{ id: CUSTOMER_ID, updates: { notes: null } }] },
    )

    expect(result.type).toBe('success')
  })

  it.each<[string, unknown, string[]]>([
    ['an empty list', { items: [] }, ['items:too_small']],
    [
      'a customer twice, once in capitals',
      {
        items: [
          { id: CUSTOMER_ID, updates: { notes: null } },
          { id: THIRD_ID, updates: { notes: null } },
          { id: CUSTOMER_ID.toUpperCase(), updates: { tags: [] } },
        ],
      },
      ['items.2.id:custom'],
    ],
    [
      'an item without changes',
      { items: [{ id: CUSTOMER_ID, updates: {} }] },
      ['items.0.updates:custom'],
    ],
    [
      'an item without its customer',
      { items: [{ updates: { notes: null } }] },
      ['items.0.id:invalid_type'],
    ],
    [
      'a change that breaks a rule of its shape',
      {
        items: [{ id: CUSTOMER_ID, updates: { email: 'x', loyaltyPoints: 1 } }],
      },
      [
        'items.0.updates.email:invalid_format',
        'items.0.updates.loyaltyPoints:unrecognized_keys',
      ],
    ],
    [
      'an item with another property',
      { items: [{ id: CUSTOMER_ID, updates: { notes: null }, version: 2 }] },
      ['items.0.version:unrecognized_keys'],
    ],
  ])('refuses a request with %s', async (_case, input, rules) => {
    const dependencies = updated

    const result = await new BulkUpdateCustomersUseCase(dependencies).execute(
      actors.admin,
      input,
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(callsOf(dependencies.customerRepository, 'updateMany')).toEqual([])
  })

  it('should say that an item names the customer of an earlier one', async () => {
    // Arrange
    const items = [
      { id: CUSTOMER_ID, updates: { notes: null } },
      { id: CUSTOMER_ID, updates: { tags: [] } },
    ]

    // Act
    const result = await new BulkUpdateCustomersUseCase(updated).execute(
      actors.admin,
      { items },
    )

    // Assert
    expect(result).toMatchObject({
      type: 'error',
      error: {
        issues: [
          { field: 'items.1.id', message: customerMessages.noRepeatedCustomer },
        ],
      },
    })
  })

  it('refuses a customer referred by themselves and a birth date in the future, at their items', async () => {
    const dependencies = updated

    const result = await new BulkUpdateCustomersUseCase(dependencies).execute(
      actors.admin,
      {
        items: [
          { id: CUSTOMER_ID, updates: { notes: null } },
          {
            id: THIRD_ID,
            updates: {
              birthDate: '2027-01-01',
              referredBy: THIRD_ID.toUpperCase(),
            },
          },
        ],
      },
    )

    expect(rulesOf(result)).toEqual([
      'items.1.updates.birthDate:too_big',
      'items.1.updates.referredBy:circular',
    ])
    expect(callsOf(dependencies.customerRepository, 'updateMany')).toEqual([])
  })

  it('answers not found with the first customer of the request that is missing', async () => {
    const result = await new BulkUpdateCustomersUseCase(
      updating({
        type: 'customersNotFound',
        missing: [OTHER_CUSTOMER_ID, THIRD_ID],
      }),
    ).execute(actors.admin, {
      items: [
        { id: CUSTOMER_ID, updates: { notes: null } },
        { id: THIRD_ID, updates: { notes: null } },
        { id: OTHER_CUSTOMER_ID, updates: { notes: null } },
      ],
    })

    expect(result).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.customer, THIRD_ID)),
    )
  })

  it('refuses every change whose referrer is missing, at its place', async () => {
    const result = await new BulkUpdateCustomersUseCase(
      updating({ type: 'referrersNotFound', missing: [OTHER_CUSTOMER_ID] }),
    ).execute(actors.admin, {
      items: [
        { id: CUSTOMER_ID, updates: { referredBy: REFERRER_ID } },
        { id: THIRD_ID, updates: { referredBy: OTHER_CUSTOMER_ID } },
        { id: REFERRER_ID, updates: { referredBy: null } },
      ],
    })

    expect(rulesOf(result)).toEqual(['items.1.updates.referredBy:not_found'])
  })

  it('passes a taken email and a failure of the database on', async () => {
    const items = [
      { id: CUSTOMER_ID, updates: { email: 'second@example.com' } },
    ]
    const taken = await new BulkUpdateCustomersUseCase(
      customerDependencies({ updateMany: vi.fn(async () => emailTaken) }),
    ).execute(actors.admin, { items })
    const down = await new BulkUpdateCustomersUseCase(
      customerDependencies({ updateMany: vi.fn(async () => databaseDown) }),
    ).execute(actors.admin, { items })

    expect(taken).toEqual(emailTaken)
    expect(down).toEqual(databaseDown)
  })
})

describe('BulkDeleteCustomersUseCase', () => {
  const deleting = (outcome: CustomerBulkDeletion) =>
    customerDependencies({
      deleteMany: vi.fn(async () => Result.success(outcome)),
    })

  it('deletes the customers and answers their IDs in the order of the request', async () => {
    const dependencies = deleting({ type: 'deleted' })

    const result = await new BulkDeleteCustomersUseCase(dependencies).execute(
      actors.ofSalon('manager'),
      { ids: [THIRD_ID.toUpperCase(), CUSTOMER_ID] },
    )

    expect(result).toEqual(Result.success({ deleted: [THIRD_ID, CUSTOMER_ID] }))
    expect(callsOf(dependencies.customerRepository, 'deleteMany')).toEqual([
      [[THIRD_ID, CUSTOMER_ID], USER_ID],
    ])
  })

  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['an owner', actors.ofSalon('owner')],
  ])('lets %s delete customers', async (_who, actor) => {
    const result = await new BulkDeleteCustomersUseCase(
      deleting({ type: 'deleted' }),
    ).execute(actor, { ids: [CUSTOMER_ID] })

    expect(result.type).toBe('success')
  })

  it.each<[string, Actor]>([
    ['a staff member', actors.ofSalon('staff')],
    ...strangers,
  ])('refuses %s before the request is read', async (_who, actor) => {
    const dependencies = deleting({ type: 'deleted' })

    const results = [
      await new BulkDeleteCustomersUseCase(dependencies).execute(actor, {
        ids: [CUSTOMER_ID],
      }),
      await new BulkDeleteCustomersUseCase(dependencies).execute(actor, null),
    ]

    expect(results).toEqual([forbidden, forbidden])
    expect(callsOf(dependencies.customerRepository, 'deleteMany')).toEqual([])
  })

  it.each<[string, unknown, string[]]>([
    [
      'no IDs',
      { customerIds: [CUSTOMER_ID] },
      ['ids:invalid_type', 'customerIds:unrecognized_keys'],
    ],
    ['an empty list', { ids: [] }, ['ids:too_small']],
    ['an ID twice', { ids: [CUSTOMER_ID, CUSTOMER_ID] }, ['ids.1:custom']],
  ])('refuses a request with %s', async (_case, input, rules) => {
    const dependencies = deleting({ type: 'deleted' })

    const result = await new BulkDeleteCustomersUseCase(dependencies).execute(
      actors.admin,
      input,
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(callsOf(dependencies.customerRepository, 'deleteMany')).toEqual([])
  })

  it('answers not found with the first customer of the request that is missing', async () => {
    const result = await new BulkDeleteCustomersUseCase(
      deleting({
        type: 'customersNotFound',
        missing: [THIRD_ID, OTHER_CUSTOMER_ID],
      }),
    ).execute(actors.admin, { ids: [CUSTOMER_ID, OTHER_CUSTOMER_ID, THIRD_ID] })

    expect(result).toEqual(
      Result.error(
        DomainErrors.notFound(entityMessages.customer, OTHER_CUSTOMER_ID),
      ),
    )
  })

  it('refuses customers whom unfinished bookings refer to, naming the first of the request', async () => {
    const result = await new BulkDeleteCustomersUseCase(
      deleting({
        type: 'bookingsUnfinished',
        customers: [THIRD_ID, OTHER_CUSTOMER_ID],
      }),
    ).execute(actors.admin, { ids: [CUSTOMER_ID, OTHER_CUSTOMER_ID, THIRD_ID] })

    expect(result).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Customer ${OTHER_CUSTOMER_ID} cannot be deleted: bookings that are not finished refer to it`,
        ),
      ),
    )
  })

  it('passes a failure of the database on', async () => {
    const result = await new BulkDeleteCustomersUseCase(
      customerDependencies({ deleteMany: vi.fn(async () => databaseDown) }),
    ).execute(actors.admin, { ids: [CUSTOMER_ID] })

    expect(result).toEqual(databaseDown)
  })
})
