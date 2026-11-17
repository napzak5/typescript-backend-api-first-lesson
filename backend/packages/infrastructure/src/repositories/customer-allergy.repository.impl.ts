import { customerAllergies, customers } from '@beauty-salon-backend/database'
import {
  type CustomerAllergyAddition,
  type CustomerAllergyChange,
  type CustomerAllergyId,
  type CustomerAllergyListCriteria,
  type CustomerAllergyListing,
  type CustomerAllergyRemoval,
  type CustomerId,
  type DbCustomerAllergyChanges,
  type DbNewCustomerAllergy,
  type DomainError,
  DomainErrors,
  type ICustomerAllergyRepository,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, desc, eq, exists, isNull, sql } from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { match, P } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import { describeDatabaseError } from '../database/failure'
import type { Database, DatabaseExecutor } from '../database/index'

const allergenUniqueViolation = {
  code: '23505',
  constraint_name: 'customer_allergies_customer_allergen_unique',
}

/**
 * Runs a change of an allergy. The unique constraint on the allergen of a
 * customer is the one expected failure, of a change that renames the
 * allergen to that of another allergy, and becomes `allergenExists`;
 * drizzle wraps the driver error, so the violation is looked for on the
 * error and on its cause. Anything else is unexpected and keeps a
 * description that is safe to log.
 */
const attemptChange = async (
  run: () => Promise<CustomerAllergyChange>,
): Promise<Result<CustomerAllergyChange, DomainError>> => {
  const outcome = await Result.fromPromise(run())
  if (outcome.type === 'success') {
    return outcome
  }
  const cause: unknown = outcome.error
  return match(cause)
    .returnType<Result<CustomerAllergyChange, DomainError>>()
    .with(
      P.union(allergenUniqueViolation, { cause: allergenUniqueViolation }),
      () => Result.success({ type: 'allergenExists' }),
    )
    .otherwise(() =>
      Result.error(
        DomainErrors.database(
          'Failed to update customer allergy',
          describeDatabaseError(cause),
        ),
      ),
    )
}

/** The customer, if they are there: not deleted. */
const customerShown = (customerId: CustomerId) =>
  and(eq(customers.id, customerId), isNull(customers.deletedAt))

/** Whether the customer is there, once a write of an allergy found nothing. */
const isCustomerShown = async (
  executor: DatabaseExecutor,
  customerId: CustomerId,
): Promise<boolean> => {
  const [customer] = await executor
    .select({ id: customers.id })
    .from(customers)
    .where(customerShown(customerId))
  return customer !== undefined
}

/** The allergy of the customer, while the customer is there. */
const allergyOfCustomerShown = (
  executor: DatabaseExecutor,
  customerId: CustomerId,
  id: CustomerAllergyId,
) =>
  and(
    eq(customerAllergies.id, id),
    eq(customerAllergies.customerId, customerId),
    exists(
      executor
        .select({ id: customers.id })
        .from(customers)
        .where(customerShown(customerId)),
    ),
  )

const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

export class CustomerAllergyRepository implements ICustomerAllergyRepository {
  constructor(private readonly db: Database) {}

  async add(
    customerId: CustomerId,
    allergy: DbNewCustomerAllergy,
  ): Promise<Result<CustomerAllergyAddition, DomainError>> {
    return attempt('Failed to add customer allergy', () =>
      this.db.transaction(
        async (tx): Promise<CustomerAllergyAddition> => {
          // The customer is held, so that their removal comes before this
          // or after it: a customer who is being removed is gone once this
          // statement returns.
          const [customer] = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(customerShown(customerId))
            .for('share')
          if (customer === undefined) {
            return { type: 'customerNotFound' }
          }

          // An allergy of the same allergen being written at this moment is
          // waited for; once it is there, nothing is written.
          const [stored] = await tx
            .insert(customerAllergies)
            .values({
              ...allergy,
              customerId,
              createdAt: CLOCK,
              updatedAt: CLOCK,
            })
            .onConflictDoNothing({
              target: [
                customerAllergies.customerId,
                customerAllergies.allergenName,
              ],
            })
            .returning()

          return stored === undefined
            ? { type: 'allergenExists' }
            : { type: 'added', allergy: stored }
        },
        // A request that waited for the customer sees what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async update(
    customerId: CustomerId,
    id: CustomerAllergyId,
    changes: DbCustomerAllergyChanges,
  ): Promise<Result<CustomerAllergyChange, DomainError>> {
    return attemptChange(async (): Promise<CustomerAllergyChange> => {
      // One statement: two changes of an allergy come one after the other,
      // the later one written over what the earlier one left.
      const [changed] = await this.db
        .update(customerAllergies)
        .set({ ...changes, updatedAt: CLOCK })
        .where(allergyOfCustomerShown(this.db, customerId, id))
        .returning()
      if (changed !== undefined) {
        return { type: 'changed', allergy: changed }
      }
      return (await isCustomerShown(this.db, customerId))
        ? { type: 'allergyNotFound' }
        : { type: 'customerNotFound' }
    })
  }

  async remove(
    customerId: CustomerId,
    id: CustomerAllergyId,
  ): Promise<Result<CustomerAllergyRemoval, DomainError>> {
    return attempt(
      'Failed to remove customer allergy',
      async (): Promise<CustomerAllergyRemoval> => {
        const [removed] = await this.db
          .delete(customerAllergies)
          .where(allergyOfCustomerShown(this.db, customerId, id))
          .returning({ id: customerAllergies.id })
        if (removed !== undefined) {
          return { type: 'removed' }
        }
        return (await isCustomerShown(this.db, customerId))
          ? { type: 'allergyNotFound' }
          : { type: 'customerNotFound' }
      },
    )
  }

  async list({
    customerId,
    limit,
    after,
  }: CustomerAllergyListCriteria): Promise<
    Result<CustomerAllergyListing, DomainError>
  > {
    return attempt('Failed to list customer allergies', () =>
      this.db.transaction(async (tx): Promise<CustomerAllergyListing> => {
        if (!(await isCustomerShown(tx, customerId))) {
          return { type: 'customerNotFound' }
        }
        const ofCustomer = eq(customerAllergies.customerId, customerId)

        // Keyset pagination, severest first and then in the order of the
        // records: the page starts after the allergy the cursor names, which
        // has to be one of the customer.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({
                  severityType: customerAllergies.severityType,
                  createdAt: customerAllergies.createdAt,
                })
                .from(customerAllergies)
                .where(and(eq(customerAllergies.id, after), ofCustomer))
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          after === null || cursor === undefined
            ? undefined
            : sql`(${customerAllergies.severityType} < ${cursor.severityType}::allergy_severity or (${customerAllergies.severityType} = ${cursor.severityType}::allergy_severity and (${customerAllergies.createdAt}, ${customerAllergies.id}) > (${cursor.createdAt}::timestamptz, ${after}::uuid)))`

        const found = await tx
          .select()
          .from(customerAllergies)
          .where(and(ofCustomer, afterCursor))
          // The levels of allergy_severity are declared mildest first.
          .orderBy(
            desc(customerAllergies.severityType),
            asc(customerAllergies.createdAt),
            asc(customerAllergies.id),
          )
          // One extra allergy tells whether another page follows.
          .limit(limit + 1)
        const [counted] = await tx
          .select({ total: count() })
          .from(customerAllergies)
          .where(ofCustomer)

        return {
          type: 'listed',
          allergies: found.slice(0, limit),
          total: counted?.total ?? 0,
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }
}
