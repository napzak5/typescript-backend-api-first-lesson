import type { ApiPage, Paging } from '../../models/page'
import type { StaffId } from '../../models/staff'
import type {
  ApiStaffProfileResponse,
  DbStaffProfile,
} from '../../models/staff-profile'
import type { StaffProfileList } from '../../repositories/staff-profile.repository'
import { toApiPage } from './page'

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

  /** The profiles of a list as a page of it. */
  toApiStaffProfilePage(
    { profiles, total, hasMore }: StaffProfileList,
    paging: Paging<StaffId>,
  ): ApiPage<ApiStaffProfileResponse> {
    return toApiPage(
      profiles.map(StaffProfileReadMapper.toApiStaffProfile),
      { total, hasMore },
      paging,
    )
  },
}
