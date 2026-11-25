import { customers, customerVersions } from '@beauty-salon-backend/database'
import {
  type CustomerId,
  type CustomerVersionId,
  type CustomerVersionListCriteria,
  customerIdSchema,
  customerVersionIdSchema,
  type UserId,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { recordVersions } from '../_shared/customer-version-record'
import { CustomerVersionRepository } from '../customer-version.repository.impl'
import { insertCustomer, insertUser } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new CustomerVersionRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** A member of the staff who changes the ledger. */
const storedEditor = async (): Promise<UserId> =>
  userIdSchema.parse(
    (await insertUser(databases.database(), { role: 'staff' })).id,
  )

/**
 * A customer with a version for each of the names given: the first is the
 * registration, each next one a change of the first name to that name.
 */
const customerWithVersions = async (
  firstNames: readonly string[],
  overrides: Parameters<typeof insertCustomer>[1] = {},
): Promise<CustomerId> => {
  const db = databases.database()
  const editor = await storedEditor()
  const customer = await insertCustomer(db, overrides)
  for (const [index, firstName] of firstNames.entries()) {
    await recordVersions(
      db,
      await db
        .update(customers)
        .set({ firstName })
        .where(eq(customers.id, customer.id))
        .returning(),
      index === 0 ? 'create' : 'update',
      editor,
    )
  }
  return customerIdSchema.parse(customer.id)
}

/** The IDs of the versions of the customer, the first one first. */
const versionIdsOf = async (
  customerId: CustomerId,
): Promise<CustomerVersionId[]> =>
  (
    await databases
      .database()
      .select({ id: customerVersions.id })
      .from(customerVersions)
      .where(eq(customerVersions.customerId, customerId))
      .orderBy(asc(customerVersions.version))
  ).map(({ id }) => customerVersionIdSchema.parse(id))

/** A version ID that names no version. */
const UNKNOWN_VERSION = customerVersionIdSchema.parse(UNKNOWN_ID)

/** The versions of the customer, newest first, a page of 20. */
const criteriaOf = (
  customerId: CustomerId,
  overrides: Partial<CustomerVersionListCriteria> = {},
): CustomerVersionListCriteria => ({
  customerId,
  limit: 20,
  after: null,
  ...overrides,
})

describe('CustomerVersionRepository.list', () => {
  it('should list the versions newest first, each with the one before it', async () => {
    // Arrange
    const customerId = await customerWithVersions(['花子', '春子', '夏子'])

    // Act
    const listed = await repository().list(criteriaOf(customerId))

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: {
        type: 'listed',
        versions: [
          {
            version: { version: 3, operation: 'update', firstName: '夏子' },
            previous: { version: 2, firstName: '春子' },
          },
          {
            version: { version: 2, operation: 'update', firstName: '春子' },
            previous: { version: 1, firstName: '花子' },
          },
          {
            version: { version: 1, operation: 'create', firstName: '花子' },
            previous: null,
          },
        ],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should list the versions a page at a time, the next page after the cursor', async () => {
    // Arrange
    const customerId = await customerWithVersions(['花子', '春子', '夏子'])
    const [, second] = await versionIdsOf(customerId)

    // Act
    const first = await repository().list(criteriaOf(customerId, { limit: 2 }))
    const next = await repository().list(
      criteriaOf(customerId, { limit: 2, after: second ?? UNKNOWN_VERSION }),
    )

    // Assert
    expect(first).toMatchObject({
      type: 'success',
      data: {
        type: 'listed',
        versions: [{ version: { version: 3 } }, { version: { version: 2 } }],
        total: 3,
        hasMore: true,
      },
    })
    expect(next).toMatchObject({
      type: 'success',
      data: {
        type: 'listed',
        versions: [{ version: { version: 1 } }],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should list the versions of a deleted customer', async () => {
    // Arrange
    const customerId = await customerWithVersions(['花子'], {
      deletedAt: '2026-12-01T00:00:00.000Z',
    })

    // Act
    const listed = await repository().list(criteriaOf(customerId))

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { type: 'listed', total: 1 },
    })
  })

  it('should find no customer of an ID that names none', async () => {
    // Act
    const listed = await repository().list(
      criteriaOf(customerIdSchema.parse(UNKNOWN_ID)),
    )

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })

  it.each<[string, () => Promise<CustomerVersionId[]>]>([
    [
      'a version of another customer',
      async () => versionIdsOf(await customerWithVersions(['太郎'])),
    ],
    ['no version', async () => [UNKNOWN_VERSION]],
  ])('should find no page after %s', async (_, cursorOf) => {
    // Arrange
    const customerId = await customerWithVersions(['花子'])
    const [after = UNKNOWN_VERSION] = await cursorOf()

    // Act
    const listed = await repository().list(criteriaOf(customerId, { after }))

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'cursorNotFound' },
    })
  })
})

describe('CustomerVersionRepository.find', () => {
  it('should find the version of the number, made at the time the write gave the row', async () => {
    // Arrange
    const customerId = await customerWithVersions(['花子', '春子'], {
      updatedAt: '2026-11-01T03:00:00Z',
    })

    // Act
    const found = await repository().find(customerId, 1)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: {
        type: 'found',
        version: {
          customerId,
          version: 1,
          firstName: '花子',
          changedAt: '2026-11-01 03:00:00+00',
        },
      },
    })
  })

  it('should find no version of a number the customer has not reached', async () => {
    // Arrange
    const customerId = await customerWithVersions(['花子'])

    // Act
    const found = await repository().find(customerId, 2)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: { type: 'versionNotFound' },
    })
  })

  it('should find no customer of an ID that names none', async () => {
    // Act
    const found = await repository().find(customerIdSchema.parse(UNKNOWN_ID), 1)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })
})

describe('CustomerVersionRepository on a database that is gone', () => {
  const customerId = customerIdSchema.parse(UNKNOWN_ID)

  it.each<
    [string, (repository: CustomerVersionRepository) => Promise<unknown>]
  >([
    [
      'Failed to list customer versions',
      (gone) => gone.list(criteriaOf(customerId)),
    ],
    ['Failed to find customer version', (gone) => gone.find(customerId, 1)],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new CustomerVersionRepository(await databases.gone())

    // Act
    const result = await call(gone)

    // Assert
    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message,
        cause: expect.objectContaining({ code: 'CONNECTION_ENDED' }),
      },
    })
  })
})
