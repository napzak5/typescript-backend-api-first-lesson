import {
  paymentMethods,
  paymentTransactions,
} from '@beauty-salon-backend/database'
import {
  type DbNewPaymentMethod,
  type DbPaymentMethod,
  type DbPaymentMethodChanges,
  type DomainError,
  DomainErrors,
  type IPaymentMethodRepository,
  limitsAfter,
  limitsAreInOrder,
  type PaymentMethodId,
  type PaymentMethodList,
  type PaymentMethodListCriteria,
  type PaymentMethodRemoval,
  type PaymentMethodUpdate,
  type SalonId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database } from '../database/index'

const ofSalon = (salonId: SalonId, id: PaymentMethodId) =>
  and(eq(paymentMethods.id, id), eq(paymentMethods.salonId, salonId))

export class PaymentMethodRepository implements IPaymentMethodRepository {
  constructor(private readonly db: Database) {}

  async create(
    salonId: SalonId,
    paymentMethod: DbNewPaymentMethod,
  ): Promise<Result<DbPaymentMethod, DomainError>> {
    const created = await attempt('Failed to create payment method', () =>
      this.db
        .insert(paymentMethods)
        .values({ ...paymentMethod, salonId })
        .returning(),
    )

    return Result.flatMap(created, ([inserted]) =>
      inserted === undefined
        ? Result.error(
            DomainErrors.database(
              'Insert of payment method returned no row',
              null,
            ),
          )
        : Result.success(inserted),
    )
  }

  async findById(
    salonId: SalonId,
    id: PaymentMethodId,
  ): Promise<Result<DbPaymentMethod | null, DomainError>> {
    return attempt('Failed to find payment method', async () => {
      const [paymentMethod] = await this.db
        .select()
        .from(paymentMethods)
        .where(ofSalon(salonId, id))
        .limit(1)

      return paymentMethod ?? null
    })
  }

  async list({
    salonId,
    limit,
    after,
    method,
    isActive,
  }: PaymentMethodListCriteria): Promise<
    Result<PaymentMethodList | null, DomainError>
  > {
    const filters = and(
      eq(paymentMethods.salonId, salonId),
      method === null ? undefined : eq(paymentMethods.method, method),
      isActive === null ? undefined : eq(paymentMethods.isActive, isActive),
    )

    return attempt('Failed to list payment methods', async () => {
      // Keyset pagination on (sortOrder, id): the page starts after the
      // payment method the cursor names, which must still be there to say
      // where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({
                sortOrder: paymentMethods.sortOrder,
                id: paymentMethods.id,
              })
              .from(paymentMethods)
              .where(ofSalon(salonId, after))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${paymentMethods.sortOrder}, ${paymentMethods.id}) > (${cursor.sortOrder}::integer, ${cursor.id}::uuid)`

      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(paymentMethods)
          .where(and(filters, afterCursor))
          .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(paymentMethods).where(filters),
      ])

      return {
        paymentMethods: page.slice(0, limit),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    salonId: SalonId,
    id: PaymentMethodId,
    changes: DbPaymentMethodChanges,
  ): Promise<Result<PaymentMethodUpdate, DomainError>> {
    return attempt('Failed to update payment method', () =>
      this.db.transaction(
        async (tx): Promise<PaymentMethodUpdate> => {
          // Held, the limits are what they are when the change is written:
          // a change of the other limit at the same moment has been written
          // by the time this statement returns the row.
          const [held] = await tx
            .select({
              minimumAmount: paymentMethods.minimumAmount,
              maximumAmount: paymentMethods.maximumAmount,
            })
            .from(paymentMethods)
            .where(ofSalon(salonId, id))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }
          if (!limitsAreInOrder(limitsAfter(held, changes))) {
            return { type: 'limitsOutOfOrder' }
          }

          const [updated] = await tx
            .update(paymentMethods)
            .set({ ...changes, updatedAt: CLOCK })
            .where(eq(paymentMethods.id, id))
            .returning()

          return updated === undefined
            ? { type: 'notFound' }
            : { type: 'updated', paymentMethod: updated }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async delete(
    salonId: SalonId,
    id: PaymentMethodId,
  ): Promise<Result<PaymentMethodRemoval, DomainError>> {
    return attempt('Failed to delete payment method', () =>
      this.db.transaction(
        async (tx): Promise<PaymentMethodRemoval> => {
          // The lock is the one that the foreign key of a payment waits
          // for: a payment that is being written with this payment method
          // is there by the time the next statement looks for one.
          const [held] = await tx
            .select({ id: paymentMethods.id })
            .from(paymentMethods)
            .where(ofSalon(salonId, id))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }

          const [payment] = await tx
            .select({ id: paymentTransactions.id })
            .from(paymentTransactions)
            .where(eq(paymentTransactions.paymentMethodId, id))
            .limit(1)
          if (payment !== undefined) {
            return { type: 'inUse' }
          }

          await tx.delete(paymentMethods).where(eq(paymentMethods.id, id))

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }
}
