import { Result } from '@beauty-salon-backend/utility'
import type {
  ApiCustomerProfileResponse,
  DbCustomer,
} from '../../models/customer'
import type { DomainError } from '../../shared'
import { CustomerReadMapper } from './customer.mapper'

/**
 * Database row → the customer's own profile. The columns are converted as
 * for the ledger; the profile then names each property it shows, so a column
 * that is added to the ledger does not reach the customer by itself.
 */
export const CustomerProfileReadMapper = {
  toApiProfile(
    customer: DbCustomer,
  ): Result<ApiCustomerProfileResponse, DomainError> {
    return Result.map(
      CustomerReadMapper.toApiCustomer(customer),
      (entry): ApiCustomerProfileResponse => ({
        id: entry.id,
        firstName: entry.firstName,
        lastName: entry.lastName,
        firstNameKana: entry.firstNameKana,
        lastNameKana: entry.lastNameKana,
        email: entry.email,
        phoneNumber: entry.phoneNumber,
        alternativePhone: entry.alternativePhone,
        postalCode: entry.postalCode,
        prefecture: entry.prefecture,
        city: entry.city,
        address: entry.address,
        building: entry.building,
        birthDate: entry.birthDate,
        gender: entry.gender,
        occupation: entry.occupation,
        membershipTier: entry.membershipTier,
        loyaltyPoints: entry.loyaltyPoints,
        preferences: entry.preferences,
        referralCode: entry.referralCode,
        firstVisitDate: entry.firstVisitDate,
        lastVisitDate: entry.lastVisitDate,
        visitCount: entry.visitCount,
        allowMarketing: entry.allowMarketing,
        allowSms: entry.allowSms,
        allowEmail: entry.allowEmail,
        hairType: entry.hairType,
        hairThickness: entry.hairThickness,
        scalpCondition: entry.scalpCondition,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }),
    )
  },
}
