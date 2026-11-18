import {
  customerDeletionRequests,
  customers,
} from '@beauty-salon-backend/database'
import {
  type CustomerDeletionRequestCancelling,
  type CustomerDeletionRequesting,
  type CustomerDeletionRequestReading,
  type CustomerErasure,
  type CustomerId,
  type DbCustomerDeletionRequest,
  type DomainError,
  GRACE_PERIOD_HOURS,
  type ICustomerDeletionRequestRepository,
  type UserId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, desc, eq, isNull, lte, sql } from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { eraseCustomerOf } from './customer-erasure'

/**
 * Each write reads what is committed at each statement, so a write that
 * waited for a customer sees what the write it waited for left.
 */
const WRITE: PgTransactionConfig = { isolationLevel: 'read committed' }

/** The pending request of a customer. */
const pendingOf = (customerId: string) =>
  and(
    eq(customerDeletionRequests.customerId, customerId),
    eq(customerDeletionRequests.status, 'pending'),
  )

/**
 * Holds the customer with the ID, deleted or not, if `alive` is false, and
 * only one that is not deleted otherwise: a request and its cancelling are
 * written under it, and so is an erasure.
 */
const holdCustomer = async (
  tx: DatabaseExecutor,
  customerId: string,
  alive: boolean,
): Promise<boolean> => {
  const [held] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(
      alive
        ? and(eq(customers.id, customerId), isNull(customers.deletedAt))
        : eq(customers.id, customerId),
    )
    .for('update')
  return held !== undefined
}

export class CustomerDeletionRequestRepository
  implements ICustomerDeletionRequestRepository
{
  constructor(private readonly db: Database) {}

  async request(
    customerId: CustomerId,
    reason: string,
    requestedBy: UserId,
  ): Promise<Result<CustomerDeletionRequesting, DomainError>> {
    return attempt('Failed to take the deletion request', () =>
      this.db.transaction(async (tx): Promise<CustomerDeletionRequesting> => {
        if (!(await holdCustomer(tx, customerId, true))) {
          return { type: 'customerNotFound' }
        }
        const [pending] = await tx
          .select()
          .from(customerDeletionRequests)
          .where(pendingOf(customerId))
        if (pending !== undefined) {
          return { type: 'alreadyRequested', request: pending }
        }

        // The time is read once, after the customer is held, so that the
        // request falls due exactly the grace period after it.
        const [now] = await tx
          .select({ at: sql<string>`(${CLOCK})::text` })
          .from(customers)
          .where(eq(customers.id, customerId))
        if (now === undefined) {
          return { type: 'customerNotFound' }
        }
        const [taken] = await tx
          .insert(customerDeletionRequests)
          .values({
            customerId,
            reason,
            requestedBy,
            requestedAt: now.at,
            scheduledAt: sql`${now.at}::timestamptz + make_interval(hours => ${GRACE_PERIOD_HOURS})`,
          })
          .returning()
        return taken === undefined
          ? { type: 'customerNotFound' }
          : { type: 'requested', request: taken }
      }, WRITE),
    )
  }

  async latestOf(
    customerId: CustomerId,
  ): Promise<Result<CustomerDeletionRequestReading, DomainError>> {
    return attempt('Failed to read the deletion request', async () => {
      const [customer] = await this.db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
      if (customer === undefined) {
        return { type: 'customerNotFound' }
      }
      const [latest] = await this.db
        .select()
        .from(customerDeletionRequests)
        .where(eq(customerDeletionRequests.customerId, customerId))
        .orderBy(
          desc(customerDeletionRequests.requestedAt),
          desc(customerDeletionRequests.id),
        )
        .limit(1)
      return latest === undefined
        ? { type: 'noRequest' }
        : { type: 'found', request: latest }
    })
  }

  async cancel(
    customerId: CustomerId,
    cancelledBy: UserId,
  ): Promise<Result<CustomerDeletionRequestCancelling, DomainError>> {
    return attempt('Failed to cancel the deletion request', () =>
      this.db.transaction(
        async (tx): Promise<CustomerDeletionRequestCancelling> => {
          if (!(await holdCustomer(tx, customerId, false))) {
            return { type: 'customerNotFound' }
          }
          const [cancelled] = await tx
            .update(customerDeletionRequests)
            .set({ status: 'cancelled', cancelledBy, cancelledAt: CLOCK })
            .where(pendingOf(customerId))
            .returning()
          return cancelled === undefined
            ? { type: 'noPendingRequest' }
            : { type: 'cancelled', request: cancelled }
        },
        WRITE,
      ),
    )
  }

  async dueRequests(): Promise<
    Result<DbCustomerDeletionRequest['id'][], DomainError>
  > {
    return attempt(
      'Failed to find the deletion requests that are due',
      async () => {
        const due = await this.db
          .select({ id: customerDeletionRequests.id })
          .from(customerDeletionRequests)
          .where(
            and(
              eq(customerDeletionRequests.status, 'pending'),
              lte(customerDeletionRequests.scheduledAt, CLOCK),
            ),
          )
          .orderBy(
            asc(customerDeletionRequests.scheduledAt),
            asc(customerDeletionRequests.id),
          )
        return due.map(({ id }) => id)
      },
    )
  }

  async erase(
    id: DbCustomerDeletionRequest['id'],
    completedBy: UserId,
  ): Promise<Result<CustomerErasure, DomainError>> {
    return attempt('Failed to erase the data of the customer', () =>
      this.db.transaction((tx) => eraseCustomerOf(tx, id, completedBy), WRITE),
    )
  }
}
