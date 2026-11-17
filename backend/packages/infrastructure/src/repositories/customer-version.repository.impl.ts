import { customers, customerVersions } from '@beauty-salon-backend/database'
import type {
  CustomerId,
  CustomerVersionListCriteria,
  CustomerVersionListing,
  CustomerVersionLookup,
  DomainError,
  ICustomerVersionRepository,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, count, desc, eq, lt, sql } from 'drizzle-orm'
import { alias, type PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import type { Database, DatabaseExecutor } from '../database/index'

/** A page and its total are read at one moment, and nothing is written. */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/** The version before the one a row of the history is. */
const previous = alias(customerVersions, 'previous')

/** Whether a customer has the ID, deleted or not: its versions are kept either way. */
const customerExists = async (
  executor: DatabaseExecutor,
  customerId: CustomerId,
): Promise<boolean> => {
  const [customer] = await executor
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
  return customer !== undefined
}

export class CustomerVersionRepository implements ICustomerVersionRepository {
  constructor(private readonly db: Database) {}

  async list({
    customerId,
    limit,
    after,
  }: CustomerVersionListCriteria): Promise<
    Result<CustomerVersionListing, DomainError>
  > {
    return attempt('Failed to list customer versions', () =>
      this.db.transaction(async (tx): Promise<CustomerVersionListing> => {
        if (!(await customerExists(tx, customerId))) {
          return { type: 'customerNotFound' }
        }
        const ofCustomer = eq(customerVersions.customerId, customerId)

        // Keyset pagination, newest first: the page starts after the
        // version the cursor names, which has to be one of the customer.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({ version: customerVersions.version })
                .from(customerVersions)
                .where(and(eq(customerVersions.id, after), ofCustomer))
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }

        const found = await tx
          .select({ version: customerVersions, previous })
          .from(customerVersions)
          .leftJoin(
            previous,
            and(
              eq(previous.customerId, customerVersions.customerId),
              eq(previous.version, sql`${customerVersions.version} - 1`),
            ),
          )
          .where(
            and(
              ofCustomer,
              cursor === undefined
                ? undefined
                : lt(customerVersions.version, cursor.version),
            ),
          )
          .orderBy(desc(customerVersions.version))
          // One extra version tells whether another page follows.
          .limit(limit + 1)
        const [counted] = await tx
          .select({ total: count() })
          .from(customerVersions)
          .where(ofCustomer)

        return {
          type: 'listed',
          versions: found.slice(0, limit),
          total: counted?.total ?? 0,
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async find(
    customerId: CustomerId,
    version: number,
  ): Promise<Result<CustomerVersionLookup, DomainError>> {
    return attempt('Failed to find customer version', () =>
      this.db.transaction(async (tx): Promise<CustomerVersionLookup> => {
        if (!(await customerExists(tx, customerId))) {
          return { type: 'customerNotFound' }
        }
        const [found] = await tx
          .select()
          .from(customerVersions)
          .where(
            and(
              eq(customerVersions.customerId, customerId),
              eq(customerVersions.version, version),
            ),
          )

        return found === undefined
          ? { type: 'versionNotFound' }
          : { type: 'found', version: found }
      }, AT_ONE_MOMENT),
    )
  }
}
