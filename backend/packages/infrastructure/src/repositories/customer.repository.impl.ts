import { bookings, customers, users } from '@beauty-salon-backend/database'
import {
  type CustomerBulkCreation,
  type CustomerBulkDeletion,
  type CustomerBulkUpdate,
  type CustomerChange,
  type CustomerCreation,
  type CustomerDeletion,
  type CustomerId,
  type CustomerList,
  type CustomerListCriteria,
  type CustomerProfileCreation,
  type CustomerProfileWrite,
  type CustomerUpdate,
  type DbCustomer,
  type DbCustomerChanges,
  type DbNewCustomer,
  type DomainError,
  DomainErrors,
  type ICustomerRepository,
  type UserId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm'
import { match, P } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import { describeDatabaseError } from '../database/failure'
import type { Database, DatabaseExecutor } from '../database/index'
import { containing } from '../database/like'
import { userNotDeleted } from './account'
import {
  customersOfUnfinishedBookings,
  hasUnfinishedBooking,
} from './unfinished-bookings'

const emailTaken = {
  code: '23505',
  constraint_name: 'customers_email_unique',
}

const referralCodeTaken = {
  code: '23505',
  constraint_name: 'customers_referral_code_unique',
}

/** The values of a write that no other customer may have. */
type UniqueValues = {
  email: string | null
  referralCode: string | null
}

/**
 * Turns a failed write into a domain error. Two failures are expected: the
 * unique index on `email`, which covers the customers that are not deleted,
 * and the unique constraint on `referralCode`, which covers every customer.
 * drizzle wraps the driver error, so a violation is looked for on the error
 * and on its cause. Anything else is unexpected and keeps a description
 * that is safe to log.
 */
const toDomainError =
  (message: string, unique: () => UniqueValues) =>
  (cause: unknown): DomainError =>
    match({ cause, ...unique() })
      .with(
        {
          email: P.string,
          cause: P.union(emailTaken, { cause: emailTaken }),
        },
        ({ email }) => DomainErrors.alreadyExists('Customer', 'email', email),
      )
      .with(
        {
          referralCode: P.string,
          cause: P.union(referralCodeTaken, { cause: referralCodeTaken }),
        },
        ({ referralCode }) =>
          DomainErrors.alreadyExists('Customer', 'referralCode', referralCode),
      )
      .otherwise(() =>
        DomainErrors.database(message, describeDatabaseError(cause)),
      )

const attemptWrite = async <T>(
  message: string,
  unique: () => UniqueValues,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, unique),
  )

/**
 * Turns a failed creation of a profile into a domain error. One failure is
 * expected: the staff registered a customer with the account's email after
 * the ledger was searched for one. The next attempt finds that entry.
 */
const toProfileError = (cause: unknown): DomainError =>
  match(cause)
    .with(P.union(emailTaken, { cause: emailTaken }), () =>
      DomainErrors.conflict(
        'A customer with the email address of this account was registered at the same moment; try again',
      ),
    )
    .otherwise(() =>
      DomainErrors.database(
        'Failed to create customer profile',
        describeDatabaseError(cause),
      ),
    )

/** What of a change no other customer may have; null where it does not change. */
const uniqueValuesOf = (changes: DbCustomerChanges): UniqueValues => ({
  email: changes.email ?? null,
  referralCode: changes.referralCode ?? null,
})

const notDeleted = isNull(customers.deletedAt)

/** The referrers named that are not customers, or are deleted. */
const missingReferrers = async (
  executor: DatabaseExecutor,
  referrers: readonly (string | null | undefined)[],
): Promise<string[]> => {
  const named = [
    ...new Set(
      referrers.flatMap((referrer) =>
        referrer === undefined || referrer === null ? [] : [referrer],
      ),
    ),
  ]
  if (named.length === 0) {
    return []
  }
  const found = await executor
    .select({ id: customers.id })
    .from(customers)
    .where(and(inArray(customers.id, named), notDeleted))
  const foundIds = found.map(({ id }) => id)

  return named.filter((id) => !foundIds.includes(id))
}

/**
 * Locks the customers of the IDs that are not deleted, in the order of their
 * IDs: two bulk writes that name some of the same customers wait for each
 * other and do not deadlock. Resolves to the IDs that were not locked.
 */
const holdCustomers = async (
  executor: DatabaseExecutor,
  ids: readonly string[],
): Promise<string[]> => {
  const held = await executor
    .select({ id: customers.id })
    .from(customers)
    .where(and(inArray(customers.id, [...ids]), notDeleted))
    .orderBy(asc(customers.id))
    .for('update')
  const heldIds = held.map(({ id }) => id)

  return ids.filter((id) => !heldIds.includes(id))
}

/** Whether a customer may be named as a referrer: one that is not deleted. */
const referrerExists = async (
  executor: DatabaseExecutor,
  id: string,
): Promise<boolean> => {
  const [found] = await executor
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, id), notDeleted))
    .limit(1)

  return found !== undefined
}

/**
 * The digits of the stored phone number contain `digits`. The class is
 * spelled out because `\D` follows the locale of the database.
 */
const phoneNumberContaining = (digits: string) =>
  sql`regexp_replace(${customers.phoneNumber}, '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`

/**
 * When a customer was registered, as the API shows it. The column keeps
 * microseconds and a response milliseconds, so a customer would not be
 * found "until" the very time their own response states.
 */
const registeredAt = sql`date_trunc('milliseconds', ${customers.createdAt})`

export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly db: Database) {}

  async create(
    customer: DbNewCustomer,
  ): Promise<Result<CustomerCreation, DomainError>> {
    const { email, referralCode, referredBy } = customer

    const created = await attemptWrite(
      'Failed to create customer',
      () => ({ email, referralCode }),
      async (): Promise<CustomerCreation | null> => {
        // A referrer who is deleted a moment later is a referrer all the
        // same, so the two statements need no transaction.
        if (
          referredBy !== null &&
          !(await referrerExists(this.db, referredBy))
        ) {
          return { type: 'referrerNotFound' }
        }
        const [inserted] = await this.db
          .insert(customers)
          .values(customer)
          .returning()

        return inserted === undefined
          ? null
          : { type: 'created', customer: inserted }
      },
    )

    return Result.flatMap(created, (data) =>
      data === null
        ? Result.error(
            DomainErrors.database('Insert of customer returned no row', null),
          )
        : Result.success(data),
    )
  }

  async findById(
    id: CustomerId,
  ): Promise<Result<DbCustomer | null, DomainError>> {
    return attempt('Failed to find customer', async () => {
      const [customer] = await this.db
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), notDeleted))
        .limit(1)

      return customer ?? null
    })
  }

  async list({
    limit,
    after,
    search,
    phoneDigits,
    tags,
    registeredFrom,
    registeredTo,
    customerStatus,
    membershipTier,
  }: CustomerListCriteria): Promise<Result<CustomerList | null, DomainError>> {
    const keyword = [
      ...(search === null
        ? []
        : [
            ilike(customers.lastName, containing(search)),
            ilike(customers.firstName, containing(search)),
            ilike(customers.lastNameKana, containing(search)),
            ilike(customers.firstNameKana, containing(search)),
            ilike(customers.email, containing(search)),
          ]),
      ...(phoneDigits === null ? [] : [phoneNumberContaining(phoneDigits)]),
    ]

    const filters = and(
      notDeleted,
      keyword.length === 0 ? undefined : or(...keyword),
      tags.length === 0 ? undefined : arrayContains(customers.tags, tags),
      registeredFrom === null
        ? undefined
        : sql`${registeredAt} >= ${registeredFrom}::timestamptz`,
      registeredTo === null
        ? undefined
        : sql`${registeredAt} <= ${registeredTo}::timestamptz`,
      customerStatus === null
        ? undefined
        : eq(customers.customerStatus, customerStatus),
      membershipTier === null
        ? undefined
        : eq(customers.membershipTier, membershipTier),
    )

    return attempt('Failed to list customers', async () => {
      // Keyset pagination on (createdAt, id): the page starts after the
      // customer the cursor names. A deleted customer keeps its row, so it
      // still says where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ createdAt: customers.createdAt, id: customers.id })
              .from(customers)
              .where(eq(customers.id, after))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${customers.createdAt}, ${customers.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`

      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(customers)
          .where(and(filters, afterCursor))
          .orderBy(desc(customers.createdAt), desc(customers.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(customers).where(filters),
      ])

      return {
        customers: page.slice(0, limit),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    id: CustomerId,
    changes: DbCustomerChanges,
  ): Promise<Result<CustomerUpdate, DomainError>> {
    const { referredBy } = changes

    return attemptWrite(
      'Failed to update customer',
      () => uniqueValuesOf(changes),
      () =>
        this.db.transaction(async (tx): Promise<CustomerUpdate> => {
          // The row is locked: a customer who is found here is not deleted
          // before the change is written.
          const [locked] = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.id, id), notDeleted))
            .for('update')
          if (locked === undefined) {
            return { type: 'notFound' }
          }
          if (
            referredBy !== undefined &&
            referredBy !== null &&
            !(await referrerExists(tx, referredBy))
          ) {
            return { type: 'referrerNotFound' }
          }

          const [updated] = await tx
            .update(customers)
            .set({ ...changes, updatedAt: sql`now()` })
            .where(eq(customers.id, id))
            .returning()

          return updated === undefined
            ? { type: 'notFound' }
            : { type: 'updated', customer: updated }
        }),
    )
  }

  async delete(id: CustomerId): Promise<Result<CustomerDeletion, DomainError>> {
    return attempt('Failed to delete customer', () =>
      this.db.transaction(
        async (tx): Promise<CustomerDeletion> => {
          // An entry of a booking holds the row of its customer until the
          // booking is written: the look for bookings is after this lock.
          const [held] = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.id, id), notDeleted))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }
          if (await hasUnfinishedBooking(tx, eq(bookings.customerId, id))) {
            return { type: 'bookingsUnfinished' }
          }

          await tx
            .update(customers)
            .set({ deletedAt: CLOCK, updatedAt: CLOCK })
            .where(eq(customers.id, id))
          // The account is without a profile from now on and may create one.
          // The deleted row keeps naming the account it was the profile of.
          await tx
            .update(users)
            .set({ customerId: null, updatedAt: CLOCK })
            .where(eq(users.customerId, id))

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findByIds(
    ids: readonly CustomerId[],
  ): Promise<Result<DbCustomer[], DomainError>> {
    return attempt('Failed to find customers', () =>
      this.db
        .select()
        .from(customers)
        .where(and(inArray(customers.id, [...ids]), notDeleted)),
    )
  }

  async createMany(
    rows: readonly DbNewCustomer[],
  ): Promise<Result<CustomerBulkCreation, DomainError>> {
    // The customer being written, for the error of a write that is refused.
    let writing: UniqueValues = { email: null, referralCode: null }

    return attemptWrite(
      'Failed to create customers',
      () => writing,
      () =>
        this.db.transaction(async (tx): Promise<CustomerBulkCreation> => {
          const missing = await missingReferrers(
            tx,
            rows.map(({ referredBy }) => referredBy),
          )
          if (missing.length > 0) {
            return { type: 'referrersNotFound', missing }
          }

          // One at a time: a refused write tells whose email or referral
          // code is taken, by a customer who is there or by an earlier one.
          const created: DbCustomer[] = []
          for (const row of rows) {
            writing = uniqueValuesOf(row)
            created.push(
              ...(await tx.insert(customers).values(row).returning()),
            )
          }
          return { type: 'created', customers: created }
        }),
    )
  }

  async updateMany(
    changes: readonly CustomerChange[],
  ): Promise<Result<CustomerBulkUpdate, DomainError>> {
    // The customer being written, for the error of a write that is refused.
    let writing: UniqueValues = { email: null, referralCode: null }

    return attemptWrite(
      'Failed to update customers',
      () => writing,
      () =>
        this.db.transaction(async (tx): Promise<CustomerBulkUpdate> => {
          const missing = await holdCustomers(
            tx,
            changes.map(({ id }) => id),
          )
          if (missing.length > 0) {
            return { type: 'customersNotFound', missing }
          }
          const missingOfReferrers = await missingReferrers(
            tx,
            changes.map((change) => change.changes.referredBy),
          )
          if (missingOfReferrers.length > 0) {
            return { type: 'referrersNotFound', missing: missingOfReferrers }
          }

          // One at a time, in the order of the request: a refused write
          // tells whose email or referral code is taken.
          const updated: DbCustomer[] = []
          for (const { id, changes: change } of changes) {
            writing = uniqueValuesOf(change)
            updated.push(
              ...(await tx
                .update(customers)
                .set({ ...change, updatedAt: sql`now()` })
                .where(eq(customers.id, id))
                .returning()),
            )
          }
          return { type: 'updated', customers: updated }
        }),
    )
  }

  async deleteMany(
    ids: readonly CustomerId[],
  ): Promise<Result<CustomerBulkDeletion, DomainError>> {
    return attempt('Failed to delete customers', () =>
      this.db.transaction(
        async (tx): Promise<CustomerBulkDeletion> => {
          // As for a single delete, the bookings are looked for after the
          // customers are held, in a statement of their own.
          const missing = await holdCustomers(tx, ids)
          if (missing.length > 0) {
            return { type: 'customersNotFound', missing }
          }
          const referred = await customersOfUnfinishedBookings(tx, ids)
          if (referred.length > 0) {
            return { type: 'bookingsUnfinished', customers: referred }
          }

          await tx
            .update(customers)
            .set({ deletedAt: CLOCK, updatedAt: CLOCK })
            .where(inArray(customers.id, [...ids]))
          await tx
            .update(users)
            .set({ customerId: null, updatedAt: CLOCK })
            .where(inArray(users.customerId, [...ids]))

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async createProfile(
    userId: UserId,
    { newEntry, claim }: CustomerProfileWrite,
  ): Promise<Result<CustomerProfileCreation, DomainError>> {
    const created = await Result.fromPromise(
      this.db.transaction(
        async (tx): Promise<CustomerProfileCreation | null> => {
          // The account is locked: of two requests of one account the
          // second sees the profile of the first.
          const [account] = await tx
            .select({
              role: users.role,
              email: users.email,
              emailVerified: users.emailVerified,
              customerId: users.customerId,
            })
            .from(users)
            .where(and(eq(users.id, userId), userNotDeleted))
            .for('update')
          if (account === undefined || account.role !== 'customer') {
            return { type: 'notACustomerAccount' }
          }
          if (account.customerId !== null) {
            return { type: 'alreadyHasProfile' }
          }
          if (!account.emailVerified) {
            return { type: 'emailNotVerified' }
          }

          // The entry is locked: it is not deleted, and not taken by
          // another account, before it is linked.
          const [entry] = await tx
            .select({ id: customers.id, userId: customers.userId })
            .from(customers)
            .where(and(eq(customers.email, account.email), notDeleted))
            .for('update')
          if (
            entry !== undefined &&
            entry.userId !== null &&
            entry.userId !== userId
          ) {
            return { type: 'entryOfAnotherAccount' }
          }

          const [profile] =
            entry === undefined
              ? await tx
                  .insert(customers)
                  .values({ ...newEntry, email: account.email, userId })
                  .returning()
              : await tx
                  .update(customers)
                  .set({ ...claim, userId, updatedAt: sql`now()` })
                  .where(eq(customers.id, entry.id))
                  .returning()
          if (profile === undefined) {
            return null
          }
          await tx
            .update(users)
            .set({ customerId: profile.id, updatedAt: sql`now()` })
            .where(eq(users.id, userId))

          return { type: 'created', customer: profile }
        },
      ),
    )

    return Result.flatMap(Result.mapError(created, toProfileError), (data) =>
      data === null
        ? Result.error(
            DomainErrors.database(
              'Write of customer profile returned no row',
              null,
            ),
          )
        : Result.success(data),
    )
  }
}
