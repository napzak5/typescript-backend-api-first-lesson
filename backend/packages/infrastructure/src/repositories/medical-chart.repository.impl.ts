import {
  customerAllergies,
  customers,
  medicalCharts,
} from '@beauty-salon-backend/database'
import type {
  CustomerId,
  DbMedicalChartChanges,
  DbNewMedicalChart,
  DomainError,
  IMedicalChartRepository,
  MedicalChartChange,
  MedicalChartCreation,
  MedicalChartId,
  MedicalChartListCriteria,
  MedicalChartListing,
  MedicalChartOfCustomer,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNull,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { AnyPgColumn, PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { containing } from '../database/like'

/**
 * The charts that are shown: those of the customers who are not deleted. A
 * deleted customer keeps their chart, as their own row is kept.
 */
const ofCustomersNotDeleted = (executor: DatabaseExecutor): SQL =>
  exists(
    executor
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.id, medicalCharts.customerId),
          isNull(customers.deletedAt),
        ),
      ),
  )

/** A list of names of which one matches the pattern, in any case. */
const nameMatching = (names: AnyPgColumn, pattern: string): SQL =>
  sql`exists (select 1 from unnest(${names}) as product(name) where product.name ilike ${pattern})`

/**
 * The charts whose medical conditions, notes or names of products contain
 * the keyword, in any case.
 */
const mentioning = (keyword: string): SQL | undefined => {
  const pattern = containing(keyword)
  return or(
    ilike(medicalCharts.medicalConditions, pattern),
    ilike(medicalCharts.notes, pattern),
    nameMatching(medicalCharts.preferredProducts, pattern),
    nameMatching(medicalCharts.avoidProducts, pattern),
  )
}

/** The charts of the customers with an allergy, or without one. */
const ofAllergies = (
  executor: DatabaseExecutor,
  hasAllergies: boolean | null,
): SQL | undefined => {
  if (hasAllergies === null) {
    return undefined
  }
  const withAllergy = exists(
    executor
      .select({ id: customerAllergies.id })
      .from(customerAllergies)
      .where(eq(customerAllergies.customerId, medicalCharts.customerId)),
  )
  return hasAllergies ? withAllergy : not(withAllergy)
}

const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

export class MedicalChartRepository implements IMedicalChartRepository {
  constructor(private readonly db: Database) {}

  async create(
    chart: DbNewMedicalChart,
  ): Promise<Result<MedicalChartCreation, DomainError>> {
    return attempt('Failed to create medical chart', () =>
      this.db.transaction(
        async (tx): Promise<MedicalChartCreation> => {
          // The customer is held, so that their removal comes before this
          // or after it: a customer who is being removed is gone once this
          // statement returns.
          const [customer] = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.id, chart.customerId),
                isNull(customers.deletedAt),
              ),
            )
            .for('share')
          if (customer === undefined) {
            return { type: 'customerNotFound' }
          }

          const [stored] = await tx
            .insert(medicalCharts)
            .values({ ...chart, createdAt: CLOCK, updatedAt: CLOCK })
            .onConflictDoNothing({ target: medicalCharts.customerId })
            .returning()

          return stored === undefined
            ? { type: 'chartExists' }
            : { type: 'created', chart: stored }
        },
        // A request that waited for the customer sees what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findByCustomer(
    customerId: CustomerId,
  ): Promise<Result<MedicalChartOfCustomer, DomainError>> {
    return attempt(
      'Failed to find medical chart',
      async (): Promise<MedicalChartOfCustomer> => {
        // One statement reads the customer and the chart at one moment.
        const [found] = await this.db
          .select({ customerId: customers.id, chart: medicalCharts })
          .from(customers)
          .leftJoin(medicalCharts, eq(medicalCharts.customerId, customers.id))
          .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
        if (found === undefined) {
          return { type: 'customerNotFound' }
        }
        return found.chart === null
          ? { type: 'chartNotFound' }
          : { type: 'found', chart: found.chart }
      },
    )
  }

  async update(
    id: MedicalChartId,
    changes: DbMedicalChartChanges,
  ): Promise<Result<MedicalChartChange, DomainError>> {
    return attempt(
      'Failed to update medical chart',
      async (): Promise<MedicalChartChange> => {
        // One statement: two changes of a chart come one after the other,
        // the later one written over what the earlier one left.
        const [changed] = await this.db
          .update(medicalCharts)
          .set({ ...changes, updatedAt: CLOCK })
          .where(and(eq(medicalCharts.id, id), ofCustomersNotDeleted(this.db)))
          .returning()
        return changed === undefined
          ? { type: 'notFound' }
          : { type: 'changed', chart: changed }
      },
    )
  }

  async list({
    limit,
    after,
    search,
    hasAllergies,
  }: MedicalChartListCriteria): Promise<
    Result<MedicalChartListing, DomainError>
  > {
    return attempt('Failed to list medical charts', () =>
      this.db.transaction(async (tx): Promise<MedicalChartListing> => {
        const shown = ofCustomersNotDeleted(tx)
        const filters = and(
          shown,
          search === null ? undefined : mentioning(search),
          ofAllergies(tx, hasAllergies),
        )

        // Keyset pagination on (createdAt, id), downwards: the page starts
        // after the chart the cursor names, which has to be one that is
        // shown.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({ createdAt: medicalCharts.createdAt })
                .from(medicalCharts)
                .where(and(eq(medicalCharts.id, after), shown))
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          after === null || cursor === undefined
            ? undefined
            : sql`(${medicalCharts.createdAt}, ${medicalCharts.id}) < (${cursor.createdAt}::timestamptz, ${after}::uuid)`

        const found = await tx
          .select()
          .from(medicalCharts)
          .where(and(filters, afterCursor))
          .orderBy(desc(medicalCharts.createdAt), desc(medicalCharts.id))
          // One extra chart tells whether another page follows.
          .limit(limit + 1)
        const [matching] = await tx
          .select({ total: count() })
          .from(medicalCharts)
          .where(filters)

        return {
          type: 'listed',
          charts: found.slice(0, limit),
          total: matching?.total ?? 0,
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }
}
