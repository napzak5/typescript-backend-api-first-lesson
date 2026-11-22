import { customerVersions } from '@beauty-salon-backend/database'
import type { DbCustomer, UserId } from '@beauty-salon-backend/domain'
import { sql } from 'drizzle-orm'
import type { DatabaseExecutor } from '../../database/index'

type NewVersion = typeof customerVersions.$inferInsert

/** The values of the ledger a version keeps: every one of them, stated. */
type LedgerValues = Required<
  Omit<
    NewVersion,
    'id' | 'customerId' | 'version' | 'operation' | 'changedBy' | 'changedAt'
  >
>

const ledgerValuesOf = (row: DbCustomer): LedgerValues => ({
  firstName: row.firstName,
  lastName: row.lastName,
  firstNameKana: row.firstNameKana,
  lastNameKana: row.lastNameKana,
  email: row.email,
  phoneNumber: row.phoneNumber,
  alternativePhone: row.alternativePhone,
  postalCode: row.postalCode,
  prefecture: row.prefecture,
  city: row.city,
  address: row.address,
  building: row.building,
  birthDate: row.birthDate,
  gender: row.gender,
  occupation: row.occupation,
  membershipTier: row.membershipTier,
  preferences: row.preferences,
  notes: row.notes,
  internalNotes: row.internalNotes,
  tags: row.tags,
  referredBy: row.referredBy,
  referralCode: row.referralCode,
  allowMarketing: row.allowMarketing,
  allowSms: row.allowSms,
  allowEmail: row.allowEmail,
  isActive: row.isActive,
  hairType: row.hairType,
  hairThickness: row.hairThickness,
  scalpCondition: row.scalpCondition,
  customerStatus: row.customerStatus,
})

/**
 * Keeps the version that a write made of each of these customers: the
 * values of the ledger in their rows after the write, at the time the
 * write gave the row. The write holds the rows until it commits, so the
 * number after the last version of each is not taken by another write.
 */
export const recordVersions = async (
  executor: DatabaseExecutor,
  rows: readonly DbCustomer[],
  operation: NewVersion['operation'],
  changedBy: UserId,
): Promise<void> => {
  if (rows.length === 0) {
    return
  }
  await executor.insert(customerVersions).values(
    rows.map((row) => ({
      customerId: row.id,
      version: sql`(SELECT coalesce(max(${customerVersions.version}), 0) + 1 FROM ${customerVersions} WHERE ${customerVersions.customerId} = ${row.id})`,
      operation,
      changedBy,
      changedAt: row.updatedAt,
      ...ledgerValuesOf(row),
    })),
  )
}
