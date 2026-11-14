import { customers } from '@beauty-salon-backend/database'
import {
  type CustomerCreation,
  type CustomerId,
  type CustomerList,
  type CustomerListCriteria,
  type CustomerUpdate,
  type DbCustomer,
  type DbCustomerChanges,
  type DbNewCustomer,
  type DomainError,
  DomainErrors,
  type ICustomerRepository,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  arrayContains,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
} from 'drizzle-orm'
import { match, P } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { describeDatabaseError } from '../database/failure'
import type { Database, DatabaseExecutor } from '../database/index'
import { containing } from '../database/like'

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
  (message: string, unique: UniqueValues) =>
  (cause: unknown): DomainError =>
    match({ cause, ...unique })
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
  unique: UniqueValues,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, unique),
  )

const notDeleted = isNull(customers.deletedAt)

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
      { email, referralCode },
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
      {
        email: changes.email ?? null,
        referralCode: changes.referralCode ?? null,
      },
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

  async delete(id: CustomerId): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to delete customer', async () => {
      const deleted = await this.db
        .update(customers)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(eq(customers.id, id), notDeleted))
        .returning({ id: customers.id })

      return deleted.length > 0
    })
  }
}
