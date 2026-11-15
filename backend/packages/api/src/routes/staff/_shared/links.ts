/**
 * Links of a single staff member; `collectionPath` is where the routes are
 * mounted, which names the salon.
 */
export const staffLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
