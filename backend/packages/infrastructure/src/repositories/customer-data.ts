import {
  bookingServices,
  bookings,
  customerAllergies,
  customerPreferences,
  customers,
  customerVersions,
  medicalCharts,
  reviewHelpfulVotes,
  reviews,
  sales,
  salesDetails,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import type { CustomerData, CustomerId } from '@beauty-salon-backend/domain'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { DatabaseExecutor } from '../database/index'
import { bookingsWithServices } from './booking-services'
import { preferenceColumns } from './customer-preferences.repository.impl'
import { transactionsInOrder } from './point-transactions'
import { salesWithDetails } from './sale-details'
import { detailsOf } from './treatment-details'

/**
 * Everything held of a customer who is not deleted; null when there is no
 * such customer. The account is the one the customer names. Each list is
 * in the order its rows were written, by `createdAt` and then the ID, and
 * the versions are in the order of their numbers. The caller reads it in
 * one snapshot, so that it is of one moment.
 */
export const customerDataOf = async (
  tx: DatabaseExecutor,
  id: CustomerId,
): Promise<CustomerData | null> => {
  const [customer] = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
  if (customer === undefined) {
    return null
  }

  const [account] =
    customer.userId === null
      ? []
      : await tx.select().from(users).where(eq(users.id, customer.userId))
  const [preferences] = await tx
    .select(preferenceColumns)
    .from(customerPreferences)
    .where(eq(customerPreferences.customerId, id))
  const [medicalChart] = await tx
    .select()
    .from(medicalCharts)
    .where(eq(medicalCharts.customerId, id))
  const allergies = await tx
    .select()
    .from(customerAllergies)
    .where(eq(customerAllergies.customerId, id))
    .orderBy(asc(customerAllergies.createdAt), asc(customerAllergies.id))
  const bookingRows = await tx
    .select({ booking: bookings, service: bookingServices })
    .from(bookings)
    .leftJoin(bookingServices, eq(bookingServices.bookingId, bookings.id))
    .where(eq(bookings.customerId, id))
    .orderBy(
      asc(bookings.createdAt),
      asc(bookings.id),
      asc(bookingServices.sortOrder),
    )
  const saleRows = await tx
    .select({ sale: sales, detail: salesDetails })
    .from(sales)
    .leftJoin(salesDetails, eq(salesDetails.saleId, sales.id))
    .where(eq(sales.customerId, id))
    .orderBy(asc(sales.createdAt), asc(sales.id), asc(salesDetails.sortOrder))
  const pointTransactions = await transactionsInOrder(tx, id)
  const written = await tx
    .select()
    .from(reviews)
    .where(eq(reviews.customerId, id))
    .orderBy(asc(reviews.createdAt), asc(reviews.id))
  const helpful = await tx
    .select({ reviewId: reviewHelpfulVotes.reviewId })
    .from(reviewHelpfulVotes)
    .where(eq(reviewHelpfulVotes.customerId, id))
    .orderBy(asc(reviewHelpfulVotes.createdAt), asc(reviewHelpfulVotes.id))
  const records = await tx
    .select()
    .from(treatmentRecords)
    .where(eq(treatmentRecords.customerId, id))
    .orderBy(asc(treatmentRecords.createdAt), asc(treatmentRecords.id))
  const { materials, photos } = await detailsOf(
    tx,
    records.map((record) => record.id),
  )
  const versions = await tx
    .select()
    .from(customerVersions)
    .where(eq(customerVersions.customerId, id))
    .orderBy(asc(customerVersions.version))

  return {
    customer,
    account: account ?? null,
    preferences: preferences ?? null,
    medicalChart: medicalChart ?? null,
    allergies,
    bookings: bookingsWithServices(bookingRows),
    sales: await salesWithDetails(tx, saleRows),
    pointTransactions,
    reviews: written,
    helpfulReviewIds: helpful.map(({ reviewId }) => reviewId),
    treatmentRecords: records.map((record) => ({
      record,
      materials: materials.get(record.id) ?? [],
      photos: photos.get(record.id) ?? [],
    })),
    versions,
  }
}
