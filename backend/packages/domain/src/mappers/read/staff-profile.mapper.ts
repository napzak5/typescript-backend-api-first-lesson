import type {
  ApiStaffProfileResponse,
  DbStaffProfile,
} from '../../models/staff-profile'

/**
 * A row of `staff` → the profile customers are shown. Every property is
 * named here: a column that is added to the table, or a row that carries
 * more than the profile, does not reach a customer by itself. Property
 * names are the column names, and no column changes its representation, so
 * nothing can fail.
 */
export const StaffProfileReadMapper = {
  toApiStaffProfile(profile: DbStaffProfile): ApiStaffProfileResponse {
    return {
      id: profile.id,
      salonId: profile.salonId,
      displayName: profile.displayName,
      level: profile.level,
      position: profile.position,
      specialties: profile.specialties,
      bio: profile.bio,
      imageUrl: profile.imageUrl,
      yearsOfExperience: profile.yearsOfExperience,
      certifications: profile.certifications,
      canReceiveBookings: profile.canReceiveBookings,
    }
  },
}
