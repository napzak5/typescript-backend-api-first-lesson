/** Links of a single customer; `collectionPath` is where the customer routes are mounted. */
export const customerLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

/**
 * Links of the signed-in customer's own profile. The profile has one
 * address, whoever asks: the account says whose it is.
 */
export const customerProfileLinks = (
  collectionPath: string,
): { self: string } => ({
  self: `${collectionPath}/me`,
})
