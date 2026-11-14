/**
 * Links of a single service category; `collectionPath` is where the routes
 * are mounted, which names the salon.
 */
export const serviceCategoryLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
