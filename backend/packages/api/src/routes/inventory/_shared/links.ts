/**
 * Links of a single stock row; `collectionPath` is where the inventory
 * routes are mounted.
 */
export const inventoryLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
