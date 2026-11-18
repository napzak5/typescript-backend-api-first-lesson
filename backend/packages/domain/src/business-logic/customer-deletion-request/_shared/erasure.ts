import type { DbUser } from '../../../models/auth'
import type { DbBooking, DbBookingService } from '../../../models/booking'
import type { DbCustomer } from '../../../models/customer'
import type { PointWrite } from '../../../models/point'
import type { DbTreatmentRecord } from '../../../models/treatment-record'

/**
 * What the erasure of the data of a customer writes. A customer asks a
 * salon to erase their data (the Act on the Protection of Personal
 * Information, article 35), and the salon erases what identifies them.
 * The books and the records of the transactions are kept for seven years
 * (the Enforcement Regulation of the Corporation Tax Act, article 59, and
 * of the Income Tax Act, article 63), so the sales and the bookings they
 * come from stay, and the customer they name stays as a row that no longer
 * says who it was.
 */

/**
 * How long after a request the data may be erased: 14 days of 24 hours,
 * for a request made by mistake or taken back to be cancelled.
 */
export const GRACE_PERIOD_HOURS = 14 * 24

/** The domain no address is ever delivered to (RFC 2606). */
const NOWHERE = 'erased.invalid'

/**
 * The columns of the ledger that the erasure writes. The name, the email
 * address and the phone number cannot be empty, so they become values
 * that name nobody: the email address holds the ID, so it stays unique,
 * and the phone number has the digits a phone number needs. The rest that
 * says who the customer is, what they like and what the staff noted
 * becomes null or empty, and the customer agrees to nothing. The
 * membership tier, the status and the counts of the visits, which
 * describe what the bookings did, stay, as does the time of the creation.
 * The points are forfeit, and the account is no longer theirs.
 */
type ErasedLedger = Pick<
  DbCustomer,
  | 'userId'
  | 'firstName'
  | 'lastName'
  | 'firstNameKana'
  | 'lastNameKana'
  | 'email'
  | 'phoneNumber'
  | 'alternativePhone'
  | 'postalCode'
  | 'prefecture'
  | 'city'
  | 'address'
  | 'building'
  | 'birthDate'
  | 'gender'
  | 'occupation'
  | 'loyaltyPoints'
  | 'preferences'
  | 'notes'
  | 'internalNotes'
  | 'tags'
  | 'referredBy'
  | 'referralCode'
  | 'allowMarketing'
  | 'allowSms'
  | 'allowEmail'
  | 'isActive'
  | 'hairType'
  | 'hairThickness'
  | 'scalpCondition'
>

export const erasedLedgerOf = (
  customer: Pick<DbCustomer, 'id'>,
): ErasedLedger => ({
  userId: null,
  firstName: '顧客',
  lastName: '消去済み',
  firstNameKana: null,
  lastNameKana: null,
  email: `${customer.id}@${NOWHERE}`,
  phoneNumber: '0000000000',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  loyaltyPoints: 0,
  preferences: null,
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: false,
  allowSms: false,
  allowEmail: false,
  isActive: false,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
})

/**
 * The columns of an account of the customer that the erasure writes: the
 * account is deleted and can no longer sign in, its address names nobody,
 * and nothing is left of its password, its second factor, its tokens or
 * its sign-ins. Its role and the time of its creation stay.
 */
type ErasedAccount = Pick<
  DbUser,
  | 'email'
  | 'passwordHash'
  | 'status'
  | 'emailVerified'
  | 'emailVerificationTokenHash'
  | 'emailVerificationExpiry'
  | 'passwordResetTokenHash'
  | 'passwordResetExpiry'
  | 'lastPasswordChange'
  | 'twoFactorStatus'
  | 'twoFactorSecret'
  | 'backupCodes'
  | 'twoFactorLastUsedStep'
  | 'failedLoginAttempts'
  | 'lockedUntil'
  | 'lastLoginAt'
  | 'lastLoginIp'
  | 'customerId'
>

export const erasedAccountOf = (
  account: Pick<DbUser, 'id'>,
): ErasedAccount => ({
  email: `${account.id}@${NOWHERE}`,
  // No password is ever hashed to this: it is not a hash.
  passwordHash: 'erased',
  status: 'deleted',
  emailVerified: false,
  emailVerificationTokenHash: null,
  emailVerificationExpiry: null,
  passwordResetTokenHash: null,
  passwordResetExpiry: null,
  lastPasswordChange: null,
  twoFactorStatus: 'disabled',
  twoFactorSecret: null,
  backupCodes: null,
  twoFactorLastUsedStep: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  lastLoginIp: null,
  customerId: null,
})

/**
 * What a booking keeps of what the customer and the staff wrote, and of
 * where it was made from: nothing. Its times, its lines and its amounts
 * stay, for the sales.
 */
export const ERASED_BOOKING: Pick<
  DbBooking,
  | 'customerRequest'
  | 'internalNotes'
  | 'cancellationReason'
  | 'ipAddress'
  | 'userAgent'
> = {
  customerRequest: null,
  internalNotes: null,
  cancellationReason: null,
  ipAddress: null,
  userAgent: null,
}

/** What a line of a booking keeps of the notes of the staff: nothing. */
export const ERASED_BOOKING_LINE: Pick<DbBookingService, 'notes'> = {
  notes: null,
}

/**
 * What a treatment record keeps of what was observed and said of the
 * customer: nothing. What was done (the services, the techniques, the
 * time) and the materials used, which the stock counts, stay; the photos
 * go.
 */
export const ERASED_TREATMENT_RECORD: Pick<
  DbTreatmentRecord,
  | 'consultationNotes'
  | 'scalpCondition'
  | 'hairCondition'
  | 'colorFormula'
  | 'resultNotes'
  | 'nextRecommendedDate'
  | 'nextRecommendedServices'
  | 'homeCareSuggestions'
  | 'customerSatisfaction'
  | 'staffEvaluation'
> = {
  consultationNotes: null,
  scalpCondition: null,
  hairCondition: null,
  colorFormula: null,
  resultNotes: null,
  nextRecommendedDate: null,
  nextRecommendedServices: [],
  homeCareSuggestions: null,
  customerSatisfaction: null,
  staffEvaluation: null,
}

/**
 * The point transaction that forfeits the balance of a customer whose
 * data is erased, or null when there is none. The transactions before it
 * stay, as the sales do.
 */
export const forfeitOf = (
  customer: Pick<DbCustomer, 'id' | 'loyaltyPoints'>,
): PointWrite | null =>
  customer.loyaltyPoints === 0
    ? null
    : {
        customerId: customer.id,
        transactionType: 'expired',
        points: -customer.loyaltyPoints,
        balance: 0,
        description: 'データの消去による失効',
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      }
