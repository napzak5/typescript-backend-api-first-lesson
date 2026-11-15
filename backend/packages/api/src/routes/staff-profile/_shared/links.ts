/** Links of the profile of a single staff member. */
export const staffProfileLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

/**
 * Links of the signed-in staff member's own profile. `self` is the one
 * address the staff member reads and writes it at, whoever they are: the
 * account says whose it is. `profile` is where customers read it.
 */
export const ownStaffProfileLinks = (
  collectionPath: string,
  id: string,
): { self: string; profile: string } => ({
  self: `${collectionPath}/me`,
  profile: `${collectionPath}/${id}`,
})
