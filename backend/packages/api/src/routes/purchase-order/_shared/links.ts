/**
 * Links of a single purchase order; `collectionPath` is where the purchase
 * order routes are mounted.
 */
export const purchaseOrderLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
