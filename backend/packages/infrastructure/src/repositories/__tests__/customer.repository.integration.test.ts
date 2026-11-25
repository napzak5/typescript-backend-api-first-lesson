import {
  customers,
  customerVersions,
  users,
} from '@beauty-salon-backend/database'
import {
  type CustomerFilters,
  type CustomerId,
  type CustomerListCriteria,
  type CustomerProfileWrite,
  customerIdSchema,
  type DbNewCustomer,
  type UserId,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { recordVersions } from '../_shared/customer-version-record'
import { CustomerRepository } from '../customer.repository.impl'
import {
  COMPLETED,
  insertBooking,
  insertCustomer,
  insertSalon,
  insertStaffMember,
  insertUser,
  newCustomer,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new CustomerRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** No filter: every customer who is not deleted. */
const NO_FILTERS: CustomerFilters = {
  search: null,
  phoneDigits: null,
  tags: [],
  registeredFrom: null,
  registeredTo: null,
  customerStatus: null,
  membershipTier: null,
}

/** The first page of 20 of the customers the filters pick. */
const criteriaOf = (
  overrides: Partial<CustomerListCriteria> = {},
): CustomerListCriteria => ({
  limit: 20,
  after: null,
  ...NO_FILTERS,
  ...overrides,
})

const { email: _email, ...newEntry } = newCustomer({
  lastName: '佐藤',
  firstName: '美咲',
})

/** A profile as the write mapper makes it of a request: the email is the account's. */
const PROFILE: CustomerProfileWrite = {
  newEntry,
  claim: { lastName: '佐藤', firstName: '美咲' },
}

/** A member of the staff who changes the ledger. */
const storedEditor = async (): Promise<UserId> =>
  userIdSchema.parse(
    (await insertUser(databases.database(), { role: 'staff' })).id,
  )

/** A customer in the table, as a repository is given them. */
const storedCustomer = async (
  overrides: Parameters<typeof insertCustomer>[1] = {},
): Promise<CustomerId> =>
  customerIdSchema.parse(
    (await insertCustomer(databases.database(), overrides)).id,
  )

/** The row of the customer as the table holds it. */
const customerOf = async (id: string) => {
  const [customer] = await databases
    .database()
    .select()
    .from(customers)
    .where(eq(customers.id, id))
  return customer
}

/** What each version of the customer was, and who made it, the first one first. */
const versionsOf = (customerId: string) =>
  databases
    .database()
    .select({
      operation: customerVersions.operation,
      changedBy: customerVersions.changedBy,
    })
    .from(customerVersions)
    .where(eq(customerVersions.customerId, customerId))
    .orderBy(asc(customerVersions.version))

/** The IDs of the customers of a list, in its order. */
const idsOf = (rows: readonly { id: string }[]): string[] =>
  rows.map(({ id }) => id)

/** A booking of the customer that is not finished, or that is when the test says so. */
const storedBookingOf = async (
  customerId: string,
  overrides: Parameters<typeof insertBooking>[2] = {},
) => {
  const db = databases.database()
  const { id: salonId } = await insertSalon(db)
  const { id: staffId } = await insertStaffMember(db, salonId)
  return insertBooking(db, { salonId, customerId, staffId }, overrides)
}

describe('CustomerRepository.create', () => {
  it('should create the customer, with the version of its registration', async () => {
    // Arrange
    const editor = await storedEditor()
    const referrer = await storedCustomer()
    const customer = newCustomer({
      referredBy: referrer,
      referralCode: 'HANAKO01',
    })

    // Act
    const created = await repository().create(customer, editor)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', customer },
    })
    expect(
      await versionsOf(
        created.type === 'success' && created.data.type === 'created'
          ? created.data.customer.id
          : UNKNOWN_ID,
      ),
    ).toEqual([{ operation: 'create', changedBy: editor }])
  })

  it('should create a customer with the email of a deleted one', async () => {
    // Arrange
    await storedCustomer({ email: 'hanako@example.com', deletedAt: DELETED_AT })

    // Act
    const created = await repository().create(
      newCustomer({ email: 'hanako@example.com' }),
      await storedEditor(),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', customer: { email: 'hanako@example.com' } },
    })
  })

  it.each<[string, () => Promise<string>]>([
    ['who is deleted', () => storedCustomer({ deletedAt: DELETED_AT })],
    ['of an ID that names none', async () => UNKNOWN_ID],
  ])(
    'should create no customer referred by a customer %s',
    async (_, arrange) => {
      // Arrange
      const referredBy = await arrange()

      // Act
      const created = await repository().create(
        newCustomer({ referredBy }),
        await storedEditor(),
      )

      // Assert
      expect(created).toEqual({
        type: 'success',
        data: { type: 'referrerNotFound' },
      })
    },
  )

  it.each<
    [string, Partial<DbNewCustomer>, Parameters<typeof insertCustomer>[1]]
  >([
    ['email', { email: 'hanako@example.com' }, { email: 'hanako@example.com' }],
    [
      'referralCode',
      { referralCode: 'HANAKO01' },
      { referralCode: 'HANAKO01', deletedAt: DELETED_AT },
    ],
  ])(
    'should refuse the %s another customer has',
    async (field, taken, other) => {
      // Arrange
      await storedCustomer(other)

      // Act
      const created = await repository().create(
        newCustomer(taken),
        await storedEditor(),
      )

      // Assert
      expect(created).toMatchObject({
        type: 'error',
        error: {
          type: 'alreadyExists',
          field,
          value: Object.values(taken)[0],
        },
      })
    },
  )

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    const editor = await storedEditor()
    await databases.skipWrites('customers', 'INSERT')

    // Act
    const created = await repository().create(newCustomer(), editor)

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of customer returned no row',
        cause: null,
      },
    })
  })
})

describe('CustomerRepository.findById', () => {
  it('should find the customer of the ID', async () => {
    // Arrange
    const id = await storedCustomer({ lastName: '佐藤' })

    // Act
    const found = await repository().findById(id)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { id, lastName: '佐藤' },
    })
  })

  it.each<[string, () => Promise<CustomerId>]>([
    ['who is deleted', () => storedCustomer({ deletedAt: DELETED_AT })],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should find no customer %s', async (_, arrange) => {
    // Arrange
    const id = await arrange()

    // Act
    const found = await repository().findById(id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('CustomerRepository.findByIds', () => {
  it('should find the customers of the IDs who are not deleted', async () => {
    // Arrange
    const first = await storedCustomer()
    const second = await storedCustomer()
    const deleted = await storedCustomer({ deletedAt: DELETED_AT })
    await storedCustomer()

    // Act
    const found = await repository().findByIds([
      first,
      deleted,
      customerIdSchema.parse(UNKNOWN_ID),
      second,
    ])

    // Assert
    expect(
      found.type === 'success' ? idsOf(found.data).toSorted() : found,
    ).toEqual([first, second].toSorted())
  })
})

describe('CustomerRepository.list', () => {
  /** Three customers, registered on the 1st, the 2nd and the 3rd of November, and one deleted on the 4th. */
  const storedThree = async (): Promise<CustomerId[]> => {
    const ids = [
      await storedCustomer({ createdAt: '2026-11-01T00:00:00Z' }),
      await storedCustomer({ createdAt: '2026-11-02T00:00:00Z' }),
      await storedCustomer({ createdAt: '2026-11-03T00:00:00Z' }),
    ]
    await storedCustomer({
      createdAt: '2026-11-04T00:00:00Z',
      deletedAt: DELETED_AT,
    })
    return ids
  }

  it('should list the customers who are not deleted, the newest registration first', async () => {
    // Arrange
    const [first, second, third] = await storedThree()

    // Act
    const listed = await repository().list(criteriaOf())

    // Assert
    expect(
      listed.type === 'success' && listed.data !== null
        ? { ...listed.data, customers: idsOf(listed.data.customers) }
        : listed,
    ).toEqual({
      customers: [third, second, first],
      total: 3,
      hasMore: false,
    })
  })

  it('should list a page at a time, the next page after the customer of the cursor, and no more after a last page that is full', async () => {
    // Arrange
    const [first, second, third] = await storedThree()

    // Act
    const page = await repository().list(criteriaOf({ limit: 2 }))
    const next = await repository().list(
      criteriaOf({ limit: 1, after: second ?? null }),
    )

    // Assert
    expect(
      page.type === 'success' && page.data !== null
        ? { ...page.data, customers: idsOf(page.data.customers) }
        : page,
    ).toEqual({ customers: [third, second], total: 3, hasMore: true })
    expect(
      next.type === 'success' && next.data !== null
        ? { ...next.data, customers: idsOf(next.data.customers) }
        : next,
    ).toEqual({ customers: [first], total: 3, hasMore: false })
  })

  it('should list the page after a customer who was deleted since', async () => {
    // Arrange
    const [first, second] = await storedThree()
    const deleted = await storedCustomer({
      createdAt: '2026-11-02T12:00:00Z',
      deletedAt: DELETED_AT,
    })

    // Act
    const listed = await repository().list(criteriaOf({ after: deleted }))

    // Assert
    expect(
      listed.type === 'success' && listed.data !== null
        ? idsOf(listed.data.customers)
        : listed,
    ).toEqual([second, first])
  })

  it('should find no page after a cursor that names no customer', async () => {
    // Act
    const listed = await repository().list(
      criteriaOf({ after: customerIdSchema.parse(UNKNOWN_ID) }),
    )

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })

  it.each<[string, string]>([
    ['the family name', '佐藤'],
    ['the given name', '美咲'],
    ['the family name in kana', 'サトウ'],
    ['the given name in kana', 'ミサキ'],
    ['the email, whatever the case', 'MISAKI.SATO'],
  ])(
    'should find the customers whose %s contains the keyword',
    async (_, search) => {
      // Arrange
      const found = await storedCustomer({
        lastName: '佐藤',
        firstName: '美咲',
        lastNameKana: 'サトウ',
        firstNameKana: 'ミサキ',
        email: 'misaki.sato@example.com',
      })
      await storedCustomer({ lastNameKana: 'ヤマダ', firstNameKana: 'ハナコ' })

      // Act
      const listed = await repository().list(criteriaOf({ search }))

      // Assert
      expect(listed).toMatchObject({
        type: 'success',
        data: { customers: [{ id: found }], total: 1 },
      })
    },
  )

  it('should find the customers whose phone number has the digits, whatever separates them', async () => {
    // Arrange
    const found = await storedCustomer({ phoneNumber: '090-1234-5678' })
    await storedCustomer({ phoneNumber: '03-9999-0000' })

    // Act
    const listed = await repository().list(
      criteriaOf({ phoneDigits: '12345678' }),
    )

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { customers: [{ id: found }], total: 1 },
    })
  })

  it('should find a customer by a keyword or by the digits of the phone number', async () => {
    // Arrange
    const byName = await storedCustomer({
      lastName: '佐藤',
      phoneNumber: '03-9999-0000',
    })
    const byPhone = await storedCustomer({ phoneNumber: '090-1234-5678' })
    await storedCustomer({ phoneNumber: '03-1111-2222' })

    // Act
    const listed = await repository().list(
      criteriaOf({ search: '佐藤', phoneDigits: '5678' }),
    )

    // Assert
    expect(
      listed.type === 'success' && listed.data !== null
        ? idsOf(listed.data.customers).toSorted()
        : listed,
    ).toEqual([byName, byPhone].toSorted())
  })

  it('should find the customers who have every tag of the filter', async () => {
    // Arrange
    const found = await storedCustomer({ tags: ['常連', 'カラー'] })
    await storedCustomer({ tags: ['カラー'] })

    // Act
    const both = await repository().list(
      criteriaOf({ tags: ['カラー', '常連'] }),
    )
    const none = await repository().list(criteriaOf({ tags: ['常連', 'VIP'] }))

    // Assert
    expect(both).toMatchObject({
      type: 'success',
      data: { customers: [{ id: found }], total: 1 },
    })
    expect(none).toMatchObject({
      type: 'success',
      data: { customers: [], total: 0 },
    })
  })

  it('should find the customers registered in the period, to the millisecond a response states', async () => {
    // Arrange
    await storedCustomer({ createdAt: '2026-11-09T23:59:59.999Z' })
    const atTheStart = await storedCustomer({
      createdAt: '2026-11-10T00:00:00.000Z',
    })
    const atTheEnd = await storedCustomer({
      createdAt: '2026-11-20T00:00:00.000900Z',
    })
    await storedCustomer({ createdAt: '2026-11-20T00:00:00.001Z' })

    // Act
    const listed = await repository().list(
      criteriaOf({
        registeredFrom: '2026-11-10T00:00:00.000Z',
        registeredTo: '2026-11-20T00:00:00.000Z',
      }),
    )

    // Assert
    expect(
      listed.type === 'success' && listed.data !== null
        ? idsOf(listed.data.customers)
        : listed,
    ).toEqual([atTheEnd, atTheStart])
  })

  it('should find the customers of the status and of the tier', async () => {
    // Arrange
    const found = await storedCustomer({
      customerStatus: 'vip',
      membershipTier: 'gold',
    })
    await storedCustomer({ customerStatus: 'vip', membershipTier: 'silver' })
    await storedCustomer({ customerStatus: 'active', membershipTier: 'gold' })

    // Act
    const listed = await repository().list(
      criteriaOf({ customerStatus: 'vip', membershipTier: 'gold' }),
    )

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { customers: [{ id: found }], total: 1 },
    })
  })
})

describe('CustomerRepository.exportMatching', () => {
  it('should export every customer the filters pick, the newest registration first', async () => {
    // Arrange
    const older = await storedCustomer({
      tags: ['常連'],
      createdAt: '2026-11-01T00:00:00Z',
    })
    const newer = await storedCustomer({
      tags: ['常連'],
      createdAt: '2026-11-02T00:00:00Z',
    })
    await storedCustomer({ tags: ['常連'], deletedAt: DELETED_AT })
    await storedCustomer()

    // Act
    const exported = await repository().exportMatching(
      { ...NO_FILTERS, tags: ['常連'] },
      2,
    )

    // Assert
    expect(
      exported.type === 'success' && exported.data.type === 'exported'
        ? idsOf(exported.data.customers)
        : exported,
    ).toEqual([newer, older])
  })

  it('should export nothing when more customers match than a file holds, and tell how many', async () => {
    // Arrange
    await storedCustomer()
    await storedCustomer()
    await storedCustomer()

    // Act
    const exported = await repository().exportMatching(NO_FILTERS, 2)

    // Assert
    expect(exported).toEqual({
      type: 'success',
      data: { type: 'tooMany', matching: 3 },
    })
  })
})

describe('CustomerRepository.update', () => {
  it('should write the change, with its version', async () => {
    // Arrange
    const id = await storedCustomer()
    const editor = await storedEditor()

    // Act
    const updated = await repository().update(
      id,
      { lastName: '佐藤', notes: '静かな席を希望' },
      editor,
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        customer: { id, lastName: '佐藤', notes: '静かな席を希望' },
      },
    })
    expect(await versionsOf(id)).toEqual([
      { operation: 'update', changedBy: editor },
    ])
  })

  it.each<[string, () => Promise<string | null>]>([
    ['a customer', () => storedCustomer()],
    ['nobody', async () => null],
  ])('should name %s as the referrer', async (_, arrange) => {
    // Arrange
    const id = await storedCustomer({ referredBy: await storedCustomer() })
    const referredBy = await arrange()

    // Act
    const updated = await repository().update(
      id,
      { referredBy },
      await storedEditor(),
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', customer: { referredBy } },
    })
  })

  it('should name no referrer who is deleted', async () => {
    // Arrange
    const id = await storedCustomer()
    const referredBy = await storedCustomer({ deletedAt: DELETED_AT })

    // Act
    const updated = await repository().update(
      id,
      { referredBy },
      await storedEditor(),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'referrerNotFound' },
    })
    expect(await customerOf(id)).toMatchObject({ referredBy: null })
  })

  it.each<[string, () => Promise<CustomerId>]>([
    ['who is deleted', () => storedCustomer({ deletedAt: DELETED_AT })],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should change no customer %s', async (_, arrange) => {
    // Arrange
    const id = await arrange()

    // Act
    const updated = await repository().update(
      id,
      { lastName: '佐藤' },
      await storedEditor(),
    )

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect(await versionsOf(id)).toEqual([])
  })

  it.each<
    [string, Partial<DbNewCustomer>, Parameters<typeof insertCustomer>[1]]
  >([
    ['email', { email: 'hanako@example.com' }, { email: 'hanako@example.com' }],
    [
      'referralCode',
      { referralCode: 'HANAKO01' },
      { referralCode: 'HANAKO01', deletedAt: DELETED_AT },
    ],
  ])(
    'should refuse the %s another customer has',
    async (field, taken, other) => {
      // Arrange
      await storedCustomer(other)
      const id = await storedCustomer()

      // Act
      const updated = await repository().update(id, taken, await storedEditor())

      // Assert
      expect(updated).toMatchObject({
        type: 'error',
        error: {
          type: 'alreadyExists',
          field,
          value: Object.values(taken)[0],
        },
      })
    },
  )

  it('should describe a failure that is neither, safely for the log', async () => {
    // Arrange
    const id = await storedCustomer()

    // Act
    const updated = await repository().update(
      id,
      { referredBy: id },
      await storedEditor(),
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: 'Failed to update customer',
        cause: {
          code: '23514',
          constraint: 'customers_not_referred_by_itself',
        },
      },
    })
  })

  it('should answer a database error when the update writes no row', async () => {
    // Arrange
    const id = await storedCustomer()
    const editor = await storedEditor()
    await databases.skipWrites('customers', 'UPDATE')

    // Act
    const updated = await repository().update(id, { lastName: '佐藤' }, editor)

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of customer returned no row',
        cause: null,
      },
    })
  })
})

describe('CustomerRepository.delete', () => {
  it('should delete the customer, with its version, and free the account of its profile', async () => {
    // Arrange
    const db = databases.database()
    const account = await insertUser(db, { role: 'customer' })
    const id = await storedCustomer({ userId: account.id })
    await db
      .update(users)
      .set({ customerId: id })
      .where(eq(users.id, account.id))
    await storedBookingOf(id, COMPLETED)
    const editor = await storedEditor()

    // Act
    const deleted = await repository().delete(id, editor)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    expect(await customerOf(id)).toMatchObject({
      userId: account.id,
      deletedAt: expect.any(String),
    })
    expect(await versionsOf(id)).toEqual([
      { operation: 'delete', changedBy: editor },
    ])
    const [freed] = await db
      .select({ customerId: users.customerId })
      .from(users)
      .where(eq(users.id, account.id))
    expect(freed).toEqual({ customerId: null })
  })

  it('should delete no customer who has a booking that is not finished', async () => {
    // Arrange
    const id = await storedCustomer()
    await storedBookingOf(id)

    // Act
    const deleted = await repository().delete(id, await storedEditor())

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'bookingsUnfinished' },
    })
    expect(await customerOf(id)).toMatchObject({ deletedAt: null })
  })

  it.each<[string, () => Promise<CustomerId>]>([
    ['who is deleted', () => storedCustomer({ deletedAt: DELETED_AT })],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should delete no customer %s', async (_, arrange) => {
    // Arrange
    const id = await arrange()

    // Act
    const deleted = await repository().delete(id, await storedEditor())

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
  })
})

describe('CustomerRepository.restore', () => {
  it.each<[string, readonly ('create' | 'merge' | 'delete')[]]>([
    ['a customer whose latest version is the deletion', ['create', 'delete']],
    ['a customer kept in a merge and deleted since', ['merge', 'delete']],
    ['a customer who has no version', []],
  ])(
    'should restore %s, without the account they were the profile of',
    async (_, operations) => {
      // Arrange
      const db = databases.database()
      const editor = await storedEditor()
      const account = await insertUser(db, { role: 'customer' })
      const customer = await insertCustomer(db, {
        userId: account.id,
        deletedAt: DELETED_AT,
      })
      for (const operation of operations) {
        await recordVersions(db, [customer], operation, editor)
      }
      const id = customerIdSchema.parse(customer.id)

      // Act
      const restored = await repository().restore(id, editor)

      // Assert
      expect(restored).toMatchObject({
        type: 'success',
        data: {
          type: 'restored',
          customer: { id, deletedAt: null, userId: null },
        },
      })
      expect(await versionsOf(id)).toEqual(
        [...operations, 'restore'].map((operation) => ({
          operation,
          changedBy: editor,
        })),
      )
    },
  )

  it.each<['merge' | 'erase', string]>([
    ['merge', 'mergedAway'],
    ['erase', 'erased'],
  ])(
    'should restore no customer whose latest version is a %s',
    async (operation, type) => {
      // Arrange
      const db = databases.database()
      const editor = await storedEditor()
      const customer = await insertCustomer(db, { deletedAt: DELETED_AT })
      await recordVersions(db, [customer], operation, editor)

      // Act
      const restored = await repository().restore(
        customerIdSchema.parse(customer.id),
        editor,
      )

      // Assert
      expect(restored).toEqual({ type: 'success', data: { type } })
      expect(await customerOf(customer.id)).toMatchObject({
        deletedAt: '2026-12-01 00:00:00+00',
      })
    },
  )

  it('should restore no customer who is not deleted', async () => {
    // Arrange
    const id = await storedCustomer()

    // Act
    const restored = await repository().restore(id, await storedEditor())

    // Assert
    expect(restored).toEqual({ type: 'success', data: { type: 'notDeleted' } })
  })

  it('should restore no customer of an ID that names none', async () => {
    // Act
    const restored = await repository().restore(
      customerIdSchema.parse(UNKNOWN_ID),
      await storedEditor(),
    )

    // Assert
    expect(restored).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should restore no customer whose email another customer has taken since', async () => {
    // Arrange
    const id = await storedCustomer({
      email: 'hanako@example.com',
      deletedAt: DELETED_AT,
    })
    await storedCustomer({ email: 'hanako@example.com' })

    // Act
    const restored = await repository().restore(id, await storedEditor())

    // Assert
    expect(restored).toMatchObject({
      type: 'error',
      error: {
        type: 'alreadyExists',
        field: 'email',
        value: 'hanako@example.com',
      },
    })
  })

  it('should answer a database error when the update writes no row', async () => {
    // Arrange
    const id = await storedCustomer({ deletedAt: DELETED_AT })
    const editor = await storedEditor()
    await databases.skipWrites('customers', 'UPDATE')

    // Act
    const restored = await repository().restore(id, editor)

    // Assert
    expect(restored).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of restored customer returned no row',
        cause: null,
      },
    })
  })
})

describe('CustomerRepository.createMany', () => {
  it('should create every customer, each with the version of its registration', async () => {
    // Arrange
    const editor = await storedEditor()
    const referrer = await storedCustomer()
    const rows = [
      newCustomer({ referredBy: referrer }),
      newCustomer({ referredBy: referrer }),
      newCustomer(),
    ]

    // Act
    const created = await repository().createMany(rows, editor)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        customers: rows.map(({ email }) => ({ email })),
      },
    })
    const ids =
      created.type === 'success' && created.data.type === 'created'
        ? idsOf(created.data.customers)
        : []
    for (const id of ids) {
      expect(await versionsOf(id)).toEqual([
        { operation: 'create', changedBy: editor },
      ])
    }
  })

  it('should create none when a referrer is not a customer, and name each once', async () => {
    // Arrange
    const deleted = await storedCustomer({ deletedAt: DELETED_AT })

    // Act
    const created = await repository().createMany(
      [
        newCustomer({ referredBy: UNKNOWN_ID }),
        newCustomer({ referredBy: await storedCustomer() }),
        newCustomer({ referredBy: deleted }),
        newCustomer({ referredBy: UNKNOWN_ID }),
      ],
      await storedEditor(),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'referrersNotFound', missing: [UNKNOWN_ID, deleted] },
    })
  })

  it('should create none when a row takes the email of an earlier one, and say whose', async () => {
    // Act
    const created = await repository().createMany(
      [
        newCustomer({ email: 'hanako@example.com' }),
        newCustomer({ email: 'hanako@example.com', referralCode: 'HANAKO01' }),
      ],
      await storedEditor(),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'error',
      error: {
        type: 'alreadyExists',
        field: 'email',
        value: 'hanako@example.com',
      },
    })
    expect(
      await databases
        .database()
        .select()
        .from(customers)
        .where(eq(customers.email, 'hanako@example.com')),
    ).toEqual([])
  })
})

describe('CustomerRepository.updateMany', () => {
  it('should write every change in the order of the request, each with its version', async () => {
    // Arrange
    const editor = await storedEditor()
    const first = await storedCustomer()
    const second = await storedCustomer()
    const referrer = await storedCustomer()

    // Act
    const updated = await repository().updateMany(
      [
        { id: second, changes: { referredBy: referrer } },
        { id: first, changes: { lastName: '佐藤' } },
      ],
      editor,
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        customers: [
          { id: second, referredBy: referrer },
          { id: first, lastName: '佐藤' },
        ],
      },
    })
    expect(await versionsOf(first)).toEqual([
      { operation: 'update', changedBy: editor },
    ])
  })

  it('should change none when a customer is not found, and name the first of the request', async () => {
    // Arrange
    const found = await storedCustomer()
    const deleted = await storedCustomer({ deletedAt: DELETED_AT })

    // Act
    const updated = await repository().updateMany(
      [
        { id: found, changes: { lastName: '佐藤' } },
        { id: deleted, changes: { lastName: '佐藤' } },
        { id: customerIdSchema.parse(UNKNOWN_ID), changes: {} },
      ],
      await storedEditor(),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'customerNotFound', id: deleted },
    })
    expect(await customerOf(found)).toMatchObject({ lastName: '山田' })
  })

  it('should change none when a referrer is not a customer', async () => {
    // Arrange
    const id = await storedCustomer()

    // Act
    const updated = await repository().updateMany(
      [{ id, changes: { referredBy: UNKNOWN_ID } }],
      await storedEditor(),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'referrersNotFound', missing: [UNKNOWN_ID] },
    })
  })

  it('should let a change take the email an earlier change of the request gave up', async () => {
    // Arrange
    const first = await storedCustomer()
    const second = await storedCustomer({ email: 'hanako@example.com' })

    // Act
    const updated = await repository().updateMany(
      [
        { id: second, changes: { email: 'haruko@example.com' } },
        { id: first, changes: { email: 'hanako@example.com' } },
      ],
      await storedEditor(),
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        customers: [
          { id: second, email: 'haruko@example.com' },
          { id: first, email: 'hanako@example.com' },
        ],
      },
    })
  })

  it('should change none when a change takes the email of another customer, and say whose', async () => {
    // Arrange
    const first = await storedCustomer()
    const second = await storedCustomer()
    await storedCustomer({ email: 'hanako@example.com' })

    // Act
    const updated = await repository().updateMany(
      [
        { id: first, changes: { lastName: '佐藤' } },
        { id: second, changes: { email: 'hanako@example.com' } },
      ],
      await storedEditor(),
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'error',
      error: {
        type: 'alreadyExists',
        field: 'email',
        value: 'hanako@example.com',
      },
    })
    expect(await customerOf(first)).toMatchObject({ lastName: '山田' })
  })
})

describe('CustomerRepository.deleteMany', () => {
  it('should delete every customer, each with its version, and free their accounts', async () => {
    // Arrange
    const db = databases.database()
    const editor = await storedEditor()
    const account = await insertUser(db, { role: 'customer' })
    const first = await storedCustomer({ userId: account.id })
    await db
      .update(users)
      .set({ customerId: first })
      .where(eq(users.id, account.id))
    const second = await storedCustomer()
    const kept = await storedCustomer()

    // Act
    const deleted = await repository().deleteMany([first, second], editor)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    for (const id of [first, second]) {
      expect(await customerOf(id)).toMatchObject({
        deletedAt: expect.any(String),
      })
      expect(await versionsOf(id)).toEqual([
        { operation: 'delete', changedBy: editor },
      ])
    }
    expect(await customerOf(kept)).toMatchObject({ deletedAt: null })
    const [freed] = await db
      .select({ customerId: users.customerId })
      .from(users)
      .where(eq(users.id, account.id))
    expect(freed).toEqual({ customerId: null })
  })

  it('should delete none when a customer is not found', async () => {
    // Arrange
    const found = await storedCustomer()

    // Act
    const deleted = await repository().deleteMany(
      [found, customerIdSchema.parse(UNKNOWN_ID)],
      await storedEditor(),
    )

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'customerNotFound', id: UNKNOWN_ID },
    })
    expect(await customerOf(found)).toMatchObject({ deletedAt: null })
  })

  it('should delete none when a customer has a booking that is not finished, and name the first of the request', async () => {
    // Arrange
    const free = await storedCustomer()
    const second = await storedCustomer()
    const third = await storedCustomer()
    await storedBookingOf(third)
    await storedBookingOf(second)

    // Act
    const deleted = await repository().deleteMany(
      [free, second, third],
      await storedEditor(),
    )

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'bookingsUnfinished', customer: second },
    })
    expect(await customerOf(free)).toMatchObject({ deletedAt: null })
  })
})

describe('CustomerRepository.createProfile', () => {
  /** An account of a customer, with its address of mail confirmed unless the test says otherwise. */
  const storedAccount = async (
    overrides: Parameters<typeof insertUser>[1] = {},
  ) => {
    const account = await insertUser(databases.database(), {
      role: 'customer',
      ...overrides,
    })
    return { id: userIdSchema.parse(account.id), email: account.email }
  }

  /** The profile of the account in the table. */
  const profileOf = async (id: string) => {
    const [account] = await databases
      .database()
      .select({ customerId: users.customerId })
      .from(users)
      .where(eq(users.id, id))
    return account?.customerId
  }

  it('should create the entry of the profile, with the email of the account', async () => {
    // Arrange
    const account = await storedAccount()

    // Act
    const created = await repository().createProfile(account.id, PROFILE)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        customer: {
          email: account.email,
          userId: account.id,
          lastName: '佐藤',
        },
      },
    })
    const customerId = await profileOf(account.id)
    expect(customerId).toEqual(expect.any(String))
    expect(await versionsOf(customerId ?? UNKNOWN_ID)).toEqual([
      { operation: 'create', changedBy: account.id },
    ])
  })

  it.each<[string, (userId: UserId) => Parameters<typeof insertCustomer>[1]]>([
    ['that names no account', () => ({})],
    ['that names this account', (userId) => ({ userId })],
  ])(
    'should take the entry of the email %s as the profile',
    async (_, columnsOf) => {
      // Arrange
      const account = await storedAccount()
      const entry = await storedCustomer({
        email: account.email,
        notes: '静かな席を希望',
        ...columnsOf(account.id),
      })

      // Act
      const created = await repository().createProfile(account.id, PROFILE)

      // Assert
      expect(created).toMatchObject({
        type: 'success',
        data: {
          type: 'created',
          customer: {
            id: entry,
            userId: account.id,
            lastName: '佐藤',
            notes: '静かな席を希望',
          },
        },
      })
      expect(await profileOf(account.id)).toBe(entry)
      expect(await versionsOf(entry)).toEqual([
        { operation: 'update', changedBy: account.id },
      ])
    },
  )

  it('should create a new entry when the entry of the email is deleted', async () => {
    // Arrange
    const account = await storedAccount()
    const deleted = await storedCustomer({
      email: account.email,
      deletedAt: DELETED_AT,
    })

    // Act
    const created = await repository().createProfile(account.id, PROFILE)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', customer: { email: account.email } },
    })
    const customerId = await profileOf(account.id)
    expect(customerId).not.toBe(deleted)
    expect(await customerOf(deleted)).toMatchObject({ userId: null })
  })

  it('should not take the entry of the email of another account', async () => {
    // Arrange
    const account = await storedAccount()
    const other = await storedAccount()
    await storedCustomer({ email: account.email, userId: other.id })

    // Act
    const created = await repository().createProfile(account.id, PROFILE)

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'entryOfAnotherAccount' },
    })
    expect(await profileOf(account.id)).toBeNull()
  })

  it.each<[string, () => Promise<UserId>]>([
    [
      'of a member of the staff',
      async () => (await storedAccount({ role: 'staff' })).id,
    ],
    [
      'that is deleted',
      async () => (await storedAccount({ deletedAt: DELETED_AT })).id,
    ],
    ['that is none', async () => userIdSchema.parse(UNKNOWN_ID)],
  ])('should create no profile of an account %s', async (_, arrange) => {
    // Arrange
    const userId = await arrange()

    // Act
    const created = await repository().createProfile(userId, PROFILE)

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'notACustomerAccount' },
    })
  })

  it('should create no second profile of an account', async () => {
    // Arrange
    const account = await storedAccount()
    const db = databases.database()
    await db
      .update(users)
      .set({ customerId: await storedCustomer({ userId: account.id }) })
      .where(eq(users.id, account.id))

    // Act
    const created = await repository().createProfile(account.id, PROFILE)

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'alreadyHasProfile' },
    })
  })

  it('should create no profile of an account whose email is not confirmed', async () => {
    // Arrange
    const account = await storedAccount({ emailVerified: false })

    // Act
    const created = await repository().createProfile(account.id, PROFILE)

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'emailNotVerified' },
    })
  })

  it('should answer a conflict when the staff register the email at the same moment', async () => {
    // Arrange
    const account = await storedAccount()

    // Act
    const created = await databases.whileHeld(
      (sql) =>
        sql`insert into customers ("firstName", "lastName", email, "phoneNumber", tags) values ('花子', '山田', ${account.email}, '090-1234-5678', '{}')`,
      (sql) => sql`select 1`,
      () => repository().createProfile(account.id, PROFILE),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'error',
      error: { type: 'conflict' },
    })
    expect(await profileOf(account.id)).toBeNull()
  })

  it('should answer a database error when the write returns no row', async () => {
    // Arrange
    const account = await storedAccount()
    await databases.skipWrites('customers', 'INSERT')

    // Act
    const created = await repository().createProfile(account.id, PROFILE)

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Write of customer profile returned no row',
        cause: null,
      },
    })
  })
})

describe('CustomerRepository on a database that is gone', () => {
  const id = customerIdSchema.parse(UNKNOWN_ID)
  const userId = userIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (repository: CustomerRepository) => Promise<unknown>]>([
    ['Failed to create customer', (gone) => gone.create(newCustomer(), userId)],
    ['Failed to find customer', (gone) => gone.findById(id)],
    ['Failed to list customers', (gone) => gone.list(criteriaOf())],
    [
      'Failed to update customer',
      (gone) => gone.update(id, { lastName: '佐藤' }, userId),
    ],
    ['Failed to delete customer', (gone) => gone.delete(id, userId)],
    ['Failed to restore customer', (gone) => gone.restore(id, userId)],
    [
      'Failed to merge customers',
      (gone) =>
        gone.merge(
          {
            primaryCustomerId: id,
            secondaryCustomerId: id,
            conflictResolution: 'keep_primary',
          },
          userId,
        ),
    ],
    [
      'Failed to export customers',
      (gone) => gone.exportMatching(NO_FILTERS, 10),
    ],
    ['Failed to read the data of customer', (gone) => gone.dataOf(id)],
    ['Failed to find customers', (gone) => gone.findByIds([id])],
    [
      'Failed to create customers',
      (gone) => gone.createMany([newCustomer()], userId),
    ],
    [
      'Failed to update customers',
      (gone) => gone.updateMany([{ id, changes: {} }], userId),
    ],
    ['Failed to delete customers', (gone) => gone.deleteMany([id], userId)],
    [
      'Failed to create customer profile',
      (gone) => gone.createProfile(userId, PROFILE),
    ],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new CustomerRepository(await databases.gone())

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
