import { Result } from '@beauty-salon-backend/utility'
import {
  customerAllergyMessages,
  customerMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiCustomerAllergy,
  CUSTOMER_ALLERGY_ID,
  customerAllergyCreateRequest,
  customerAllergyDependencies,
  dbCustomerAllergy,
  OTHER_CUSTOMER_ALLERGY_ID,
} from '../../../__tests__/fixtures/customer-allergy-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type {
  CustomerAllergyAddition,
  CustomerAllergyChange,
  CustomerAllergyListing,
  CustomerAllergyRemoval,
} from '../../../repositories/customer-allergy.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  AddCustomerAllergyUseCase,
  type CustomerAllergyUseCaseDependencies,
  ListCustomerAllergiesUseCase,
  RemoveCustomerAllergyUseCase,
  UpdateCustomerAllergyUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether the repository was asked nothing. */
const untouched = ({
  customerAllergyRepository,
}: CustomerAllergyUseCaseDependencies): boolean =>
  Object.values(customerAllergyRepository).every(
    (method) => vi.mocked(method).mock.calls.length === 0,
  )

/** Everyone who keeps the allergies: the customer ledger is one for every salon. */
const keepers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
  ['a staff member of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
]

/** Actors who reach no allergies at all. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

describe('AddCustomerAllergyUseCase', () => {
  const add = (
    dependencies: CustomerAllergyUseCaseDependencies,
    actor: Actor = actors.admin,
    customerId: unknown = CUSTOMER_ID,
    input: unknown = customerAllergyCreateRequest(),
  ) =>
    new AddCustomerAllergyUseCase(dependencies).execute(
      actor,
      customerId,
      input,
    )

  const adding = (outcome: CustomerAllergyAddition) =>
    customerAllergyDependencies({
      add: vi.fn(async () => Result.success(outcome)),
    })

  it.each(keepers)(
    'writes the allergy for %s as the request states it, for the customer of the path',
    async (_who, actor) => {
      const dependencies = customerAllergyDependencies()

      expect(await add(dependencies, actor)).toEqual(
        Result.success(apiCustomerAllergy),
      )
      expect(dependencies.customerAllergyRepository.add).toHaveBeenCalledWith(
        CUSTOMER_ID,
        customerAllergyCreateRequest(),
      )
    },
  )

  it('reads a customer ID in upper case as the same customer', async () => {
    const dependencies = customerAllergyDependencies()

    await add(dependencies, actors.admin, CUSTOMER_ID.toUpperCase())

    expect(dependencies.customerAllergyRepository.add).toHaveBeenCalledWith(
      CUSTOMER_ID,
      customerAllergyCreateRequest(),
    )
  })

  it.each(outsiders)(
    'refuses %s before the customer ID and the request are read',
    async (_who, actor) => {
      const dependencies = customerAllergyDependencies()

      expect(await add(dependencies, actor, 'customer-1', null)).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a customer ID that is no UUID before the request, by the name of the path', async () => {
    const dependencies = customerAllergyDependencies()

    const result = await add(dependencies, actors.admin, 'customer-1', null)

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: customerMessages.invalidCustomerId,
      },
    })
    expect(rulesOf(result)).toEqual(['customerId:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a request that breaks a rule of its own, before anything is looked for', async () => {
    const dependencies = customerAllergyDependencies()

    const result = await add(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      customerAllergyCreateRequest({ allergenName: ' ', notes: '' }),
    )

    expect(rulesOf(result)).toEqual([
      'allergenName:invalid_format',
      'notes:invalid_format',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a day of confirmation after the UTC day after the clock, before anything is looked for', async () => {
    const dependencies = customerAllergyDependencies()

    const result = await add(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      customerAllergyCreateRequest({ confirmedDate: '2026-11-16' }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(
          customerAllergyMessages.invalidCustomerAllergy,
          [
            {
              field: 'confirmedDate',
              rule: 'too_big',
              message: 'Must not be in the future',
            },
          ],
        ),
      ),
    )
    expect(untouched(dependencies)).toBe(true)
  })

  it('answers a customer who is not there as not found', async () => {
    expect(await add(adding({ type: 'customerNotFound' }))).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('refuses a second allergy of one allergen as a conflict', async () => {
    expect(await add(adding({ type: 'allergenExists' }))).toEqual(
      Result.error(
        DomainErrors.conflict(
          'The customer has an allergy of that allergen already; an allergen is recorded once',
        ),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = customerAllergyDependencies({
      add: vi.fn(async () => databaseDown),
    })

    expect(await add(dependencies)).toEqual(databaseDown)
  })
})

describe('UpdateCustomerAllergyUseCase', () => {
  const update = (
    dependencies: CustomerAllergyUseCaseDependencies,
    actor: Actor = actors.admin,
    customerId: unknown = CUSTOMER_ID,
    allergyId: unknown = CUSTOMER_ALLERGY_ID,
    input: unknown = { severityType: 'life_threatening', notes: null },
  ) =>
    new UpdateCustomerAllergyUseCase(dependencies).execute(
      actor,
      customerId,
      allergyId,
      input,
    )

  const changing = (outcome: CustomerAllergyChange) =>
    customerAllergyDependencies({
      update: vi.fn(async () => Result.success(outcome)),
    })

  it.each(keepers)(
    'writes only what the request names for %s',
    async (_who, actor) => {
      const dependencies = customerAllergyDependencies()

      expect(await update(dependencies, actor)).toEqual(
        Result.success(apiCustomerAllergy),
      )
      expect(
        dependencies.customerAllergyRepository.update,
      ).toHaveBeenCalledWith(CUSTOMER_ID, CUSTOMER_ALLERGY_ID, {
        severityType: 'life_threatening',
        notes: null,
      })
    },
  )

  it('reads the IDs in upper case as the same customer and allergy', async () => {
    const dependencies = customerAllergyDependencies()

    await update(
      dependencies,
      actors.admin,
      CUSTOMER_ID.toUpperCase(),
      CUSTOMER_ALLERGY_ID.toUpperCase(),
    )

    expect(dependencies.customerAllergyRepository.update).toHaveBeenCalledWith(
      CUSTOMER_ID,
      CUSTOMER_ALLERGY_ID,
      { severityType: 'life_threatening', notes: null },
    )
  })

  it.each(outsiders)(
    'refuses %s before the IDs are read',
    async (_who, actor) => {
      const dependencies = customerAllergyDependencies()

      expect(
        await update(dependencies, actor, 'customer-1', 'allergy-1', null),
      ).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses IDs that are no UUIDs before the request, each by its name', async () => {
    const dependencies = customerAllergyDependencies()

    const result = await update(
      dependencies,
      actors.admin,
      'customer-1',
      'allergy-1',
      {},
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: customerAllergyMessages.invalidCustomerAllergyId,
      },
    })
    expect(rulesOf(result)).toEqual([
      'customerId:invalid_format',
      'allergyId:invalid_format',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each<[string, object, string[]]>([
    ['a request that names nothing', {}, [':custom']],
    [
      'the customer of the allergy',
      { customerId: CUSTOMER_ID },
      ['customerId:unrecognized_keys'],
    ],
    ['a level as null', { severityType: null }, ['severityType:invalid_value']],
    [
      'a day of confirmation later than the clock allows',
      { confirmedDate: '2026-11-16' },
      ['confirmedDate:too_big'],
    ],
  ])('refuses %s, and writes nothing', async (_case, input, rules) => {
    const dependencies = customerAllergyDependencies()

    const result = await update(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      CUSTOMER_ALLERGY_ID,
      input,
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(untouched(dependencies)).toBe(true)
  })

  it.each<[string, CustomerAllergyChange, DomainError]>([
    [
      'a customer who is not there',
      { type: 'customerNotFound' },
      DomainErrors.notFound('Customer', CUSTOMER_ID),
    ],
    [
      'an allergy the customer does not have',
      { type: 'allergyNotFound' },
      DomainErrors.notFound('CustomerAllergy', CUSTOMER_ALLERGY_ID),
    ],
  ])('answers %s as not found', async (_case, outcome, error) => {
    expect(await update(changing(outcome))).toEqual(Result.error(error))
  })

  it('refuses the allergen of another allergy of the customer as a conflict', async () => {
    expect(await update(changing({ type: 'allergenExists' }))).toEqual(
      Result.error(
        DomainErrors.conflict(
          'Another allergy of the customer has that allergen; an allergen is recorded once',
        ),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = customerAllergyDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })
})

describe('RemoveCustomerAllergyUseCase', () => {
  const remove = (
    dependencies: CustomerAllergyUseCaseDependencies,
    actor: Actor = actors.admin,
    customerId: unknown = CUSTOMER_ID,
    allergyId: unknown = CUSTOMER_ALLERGY_ID,
  ) =>
    new RemoveCustomerAllergyUseCase(dependencies).execute(
      actor,
      customerId,
      allergyId,
    )

  const removing = (outcome: CustomerAllergyRemoval) =>
    customerAllergyDependencies({
      remove: vi.fn(async () => Result.success(outcome)),
    })

  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ])('removes the allergy for %s', async (_who, actor) => {
    const dependencies = customerAllergyDependencies()

    expect(
      await remove(
        dependencies,
        actor,
        CUSTOMER_ID.toUpperCase(),
        CUSTOMER_ALLERGY_ID.toUpperCase(),
      ),
    ).toEqual(Result.success(CUSTOMER_ALLERGY_ID))
    expect(dependencies.customerAllergyRepository.remove).toHaveBeenCalledWith(
      CUSTOMER_ID,
      CUSTOMER_ALLERGY_ID,
    )
  })

  it.each<[string, Actor]>([
    ['a staff member', actors.ofSalon('staff')],
    ...outsiders,
  ])('refuses %s before the IDs are read', async (_who, actor) => {
    const dependencies = customerAllergyDependencies()

    expect(await remove(dependencies, actor, 'customer-1', 'a-1')).toEqual(
      forbidden,
    )
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses an allergy ID that is no UUID, and removes nothing', async () => {
    const dependencies = customerAllergyDependencies()

    const result = await remove(dependencies, actors.admin, CUSTOMER_ID, 'a-1')

    expect(rulesOf(result)).toEqual(['allergyId:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each<[string, CustomerAllergyRemoval, DomainError]>([
    [
      'a customer who is not there',
      { type: 'customerNotFound' },
      DomainErrors.notFound('Customer', CUSTOMER_ID),
    ],
    [
      'an allergy the customer does not have',
      { type: 'allergyNotFound' },
      DomainErrors.notFound('CustomerAllergy', CUSTOMER_ALLERGY_ID),
    ],
  ])('answers %s as not found', async (_case, outcome, error) => {
    expect(await remove(removing(outcome))).toEqual(Result.error(error))
  })

  it('passes on a failure of the database', async () => {
    const dependencies = customerAllergyDependencies({
      remove: vi.fn(async () => databaseDown),
    })

    expect(await remove(dependencies)).toEqual(databaseDown)
  })
})

describe('ListCustomerAllergiesUseCase', () => {
  const list = (
    dependencies: CustomerAllergyUseCaseDependencies,
    actor: Actor = actors.admin,
    customerId: unknown = CUSTOMER_ID,
    query: Result<unknown, DomainError> = Result.success({}),
  ) =>
    new ListCustomerAllergiesUseCase(dependencies).execute(
      actor,
      customerId,
      query,
    )

  const listing = (outcome: CustomerAllergyListing) =>
    customerAllergyDependencies({
      list: vi.fn(async () => Result.success(outcome)),
    })

  it.each(keepers)(
    'lists the allergies of the customer for %s, 20 a page unless the query says otherwise',
    async (_who, actor) => {
      const dependencies = customerAllergyDependencies()

      expect(await list(dependencies, actor)).toEqual(
        Result.success({
          data: [apiCustomerAllergy],
          meta: {
            total: 1,
            limit: 20,
            hasMore: false,
            cursor: null,
            nextCursor: null,
            prevCursor: null,
          },
        }),
      )
      expect(dependencies.customerAllergyRepository.list).toHaveBeenCalledWith({
        customerId: CUSTOMER_ID,
        limit: 20,
        after: null,
      })
    },
  )

  it('passes the page, and gives the last allergy of a page as the next cursor', async () => {
    const dependencies = listing({
      type: 'listed',
      allergies: [
        dbCustomerAllergy(),
        dbCustomerAllergy({ id: OTHER_CUSTOMER_ALLERGY_ID }),
      ],
      total: 5,
      hasMore: true,
    })

    const result = await list(
      dependencies,
      actors.ofSalon('staff'),
      CUSTOMER_ID.toUpperCase(),
      Result.success({ limit: 2, cursor: CUSTOMER_ALLERGY_ID.toUpperCase() }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: CUSTOMER_ALLERGY_ID,
          nextCursor: OTHER_CUSTOMER_ALLERGY_ID,
          prevCursor: null,
        },
      },
    })
    expect(dependencies.customerAllergyRepository.list).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      limit: 2,
      after: CUSTOMER_ALLERGY_ID,
    })
  })

  it.each(outsiders)(
    'refuses %s before the customer ID and the query are looked at, even a query that could not be read',
    async (_who, actor) => {
      const dependencies = customerAllergyDependencies()

      expect(
        await list(
          dependencies,
          actor,
          'customer-1',
          Result.error(DomainErrors.validation('Invalid query', [])),
        ),
      ).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a customer ID that is no UUID before the query, by the name of the path', async () => {
    const dependencies = customerAllergyDependencies()

    const result = await list(
      dependencies,
      actors.admin,
      'customer-1',
      Result.error(DomainErrors.validation('Invalid query', [])),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: customerMessages.invalidCustomerId,
      },
    })
    expect(rulesOf(result)).toEqual(['customerId:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('answers a query that could not be read as it was told', async () => {
    const unreadable = Result.error(
      DomainErrors.validation(
        customerAllergyMessages.invalidCustomerAllergySearch,
        [
          {
            field: 'limit',
            rule: 'invalid_format',
            message: 'Must be a number',
          },
        ],
      ),
    )
    const dependencies = customerAllergyDependencies()

    expect(
      await list(dependencies, actors.admin, CUSTOMER_ID, unreadable),
    ).toEqual(unreadable)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a query that breaks a rule, and looks for nothing', async () => {
    const dependencies = customerAllergyDependencies()

    const result = await list(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      Result.success({ limit: 0, cursor: 'c' }),
    )

    expect(rulesOf(result)).toEqual([
      'limit:too_small',
      'cursor:invalid_format',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('answers a customer who is not there as not found', async () => {
    expect(await list(listing({ type: 'customerNotFound' }))).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('refuses a cursor that names no allergy of the customer', async () => {
    expect(
      await list(
        listing({ type: 'cursorNotFound' }),
        actors.admin,
        CUSTOMER_ID,
        Result.success({ cursor: OTHER_CUSTOMER_ALLERGY_ID }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.validation(
          customerAllergyMessages.invalidCustomerAllergySearch,
          [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name an allergy of the customer',
            },
          ],
        ),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = customerAllergyDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })
})
