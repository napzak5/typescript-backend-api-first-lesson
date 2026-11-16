/**
 * Links of a single payment method; `collectionPath` is where the routes
 * are mounted, which names the salon.
 */
export const paymentMethodLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
