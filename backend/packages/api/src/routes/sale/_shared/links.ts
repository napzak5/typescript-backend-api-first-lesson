/** Links of a single sale; `collectionPath` is where the sale routes are mounted. */
export const saleLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

/**
 * Links of a payment of a sale. A payment has no address of its own: it is
 * read with its sale.
 */
export const paymentOfSaleLinks = (
  collectionPath: string,
  saleId: string,
): { sale: string } => ({ sale: `${collectionPath}/${saleId}` })
