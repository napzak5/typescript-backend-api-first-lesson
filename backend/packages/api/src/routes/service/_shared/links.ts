/**
 * Links of a single service; `collectionPath` is where the routes are
 * mounted, which names the salon.
 */
export const serviceLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
