import {
  customerPreferences,
  customers,
  salons,
  staff,
} from '@beauty-salon-backend/database'
import {
  type CustomerId,
  type CustomerPreferencesLookup,
  type CustomerPreferencesUpdate,
  customerPreferencesRuleIssues,
  type DbCustomerPreferences,
  type DbCustomerPreferencesChanges,
  type DomainError,
  DomainErrors,
  type ICustomerPreferencesRepository,
  noCustomerPreferences,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'

/** The columns that are the preferences; no other column of the row is read. */
const preferenceColumns = {
  preferredStaffId: customerPreferences.preferredStaffId,
  preferredTimeSlots: customerPreferences.preferredTimeSlots,
  avoidStaffIds: customerPreferences.avoidStaffIds,
  stylePreferences: customerPreferences.stylePreferences,
  communicationStyle: customerPreferences.communicationStyle,
  specialRequests: customerPreferences.specialRequests,
}

const customerNotDeleted = (customerId: CustomerId) =>
  and(eq(customers.id, customerId), isNull(customers.deletedAt))

/**
 * What is stored for the customer; the empty preferences when the customer
 * has no row.
 */
const storedPreferencesOf = async (
  db: DatabaseExecutor,
  customerId: CustomerId,
): Promise<DbCustomerPreferences> => {
  const [stored] = await db
    .select(preferenceColumns)
    .from(customerPreferences)
    .where(eq(customerPreferences.customerId, customerId))
    .limit(1)

  return stored ?? noCustomerPreferences()
}

/** The staff members a change names: the preferred one and the avoided ones. */
const staffNamedBy = ({
  preferredStaffId,
  avoidStaffIds = [],
}: DbCustomerPreferencesChanges): string[] => [
  ...(preferredStaffId === undefined || preferredStaffId === null
    ? []
    : [preferredStaffId]),
  ...avoidStaffIds,
]

/**
 * The IDs that name no staff member who is not deleted, of a salon that is
 * not deleted. The rows are not locked: a staff member who is deleted just
 * after this leaves what a deletion at any later time leaves.
 */
const notStaffMembersAmong = async (
  db: DatabaseExecutor,
  staffIds: string[],
): Promise<string[]> => {
  if (staffIds.length === 0) {
    return []
  }
  const found = await db
    .select({ id: staff.id })
    .from(staff)
    .innerJoin(salons, eq(salons.id, staff.salonId))
    .where(
      and(
        inArray(staff.id, staffIds),
        isNull(staff.deletedAt),
        isNull(salons.deletedAt),
      ),
    )
  const staffMembers = new Set(found.map(({ id }) => id))

  return staffIds.filter((staffId) => !staffMembers.has(staffId))
}

export class CustomerPreferencesRepository
  implements ICustomerPreferencesRepository
{
  constructor(private readonly db: Database) {}

  async findByCustomerId(
    customerId: CustomerId,
  ): Promise<Result<CustomerPreferencesLookup, DomainError>> {
    return attempt(
      'Failed to find customer preferences',
      async (): Promise<CustomerPreferencesLookup> => {
        // Two queries and no join: a customer without a row is still a
        // customer, and the columns of a row keep their types.
        const [customer] = await this.db
          .select({ id: customers.id })
          .from(customers)
          .where(customerNotDeleted(customerId))
          .limit(1)
        if (customer === undefined) {
          return { type: 'customerNotFound' }
        }

        return {
          type: 'found',
          preferences: await storedPreferencesOf(this.db, customerId),
        }
      },
    )
  }

  async update(
    customerId: CustomerId,
    changes: DbCustomerPreferencesChanges,
  ): Promise<Result<CustomerPreferencesUpdate, DomainError>> {
    const updated = await attempt('Failed to update customer preferences', () =>
      this.db.transaction(
        async (tx): Promise<CustomerPreferencesUpdate | null> => {
          // The row of the customer is locked: the customer is not deleted
          // before the change is written, and the changes of one customer
          // are made one after the other, each to what the one before left.
          const [locked] = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(customerNotDeleted(customerId))
            .for('update')
          if (locked === undefined) {
            return { type: 'customerNotFound' }
          }
          const staffIds = await notStaffMembersAmong(tx, staffNamedBy(changes))
          if (staffIds.length > 0) {
            return { type: 'staffNotFound', staffIds }
          }
          const after = {
            ...(await storedPreferencesOf(tx, customerId)),
            ...changes,
          }
          const issues = customerPreferencesRuleIssues(after)
          if (issues.length > 0) {
            return { type: 'invalid', issues }
          }

          // The first change of a customer creates the row, with every
          // column stated; a later one writes the columns it names.
          const [written] = await tx
            .insert(customerPreferences)
            .values({ customerId, ...after })
            .onConflictDoUpdate({
              target: customerPreferences.customerId,
              set: { ...changes, updatedAt: CLOCK },
            })
            .returning(preferenceColumns)

          return written === undefined
            ? null
            : { type: 'updated', preferences: written }
        },
      ),
    )

    return Result.flatMap(updated, (data) =>
      data === null
        ? Result.error(
            DomainErrors.database(
              'Write of customer preferences returned no row',
              null,
            ),
          )
        : Result.success(data),
    )
  }
}
