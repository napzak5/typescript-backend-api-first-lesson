import type {
  ApiCustomerProfileCreateRequest,
  ApiCustomerProfileUpdateRequest,
  CustomerProfileWrite,
  DbCustomerProfile,
  DbCustomerProfileChanges,
} from '../../models/customer'

/**
 * API request of a customer's own profile → what is written to `customers`.
 * Property names are the column names and nothing is converted. What the
 * mapper adds is what a customer does not state.
 */

/**
 * The properties that say something. In an entry that the ledger already
 * has, a null of the request leaves what the staff recorded as it is.
 */
const statedProperties = (
  profile: DbCustomerProfile,
): DbCustomerProfileChanges => {
  const {
    firstNameKana,
    lastNameKana,
    alternativePhone,
    postalCode,
    prefecture,
    city,
    address,
    building,
    birthDate,
    gender,
    occupation,
    preferences,
    ...alwaysStated
  } = profile

  return {
    ...alwaysStated,
    ...(firstNameKana === null ? {} : { firstNameKana }),
    ...(lastNameKana === null ? {} : { lastNameKana }),
    ...(alternativePhone === null ? {} : { alternativePhone }),
    ...(postalCode === null ? {} : { postalCode }),
    ...(prefecture === null ? {} : { prefecture }),
    ...(city === null ? {} : { city }),
    ...(address === null ? {} : { address }),
    ...(building === null ? {} : { building }),
    ...(birthDate === null ? {} : { birthDate }),
    ...(gender === null ? {} : { gender }),
    ...(occupation === null ? {} : { occupation }),
    ...(preferences === null ? {} : { preferences }),
  }
}

export const CustomerProfileWriteMapper = {
  /**
   * A new entry starts as the staff would register a customer who states
   * nothing more: a regular member, active, without notes, tags, referrer or
   * referral code.
   */
  fromCreateRequest(
    request: ApiCustomerProfileCreateRequest,
  ): CustomerProfileWrite {
    return {
      newEntry: {
        ...request,
        membershipTier: 'regular',
        notes: null,
        internalNotes: null,
        tags: [],
        referredBy: null,
        referralCode: null,
        isActive: true,
        hairType: null,
        hairThickness: null,
        scalpCondition: null,
        customerStatus: 'active',
      },
      claim: statedProperties(request),
    }
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(
    request: ApiCustomerProfileUpdateRequest,
  ): DbCustomerProfileChanges {
    return request
  },
}
