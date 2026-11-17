/**
 * Links of a single product; `collectionPath` is where the routes are
 * mounted, which names the salon.
 */
export const productLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
