/** Links of a single sale; `collectionPath` is where the sale routes are mounted. */
export const saleLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

/** Links of the receipt of a sale: the receipt and the sale it is made from. */
export const saleReceiptLinks = (
  collectionPath: string,
  saleId: string,
): { self: string; sale: string } => ({
  self: `${collectionPath}/${saleId}/receipt`,
  sale: `${collectionPath}/${saleId}`,
})

/**
 * Links of a calculation, which has no address of its own: where it is
 * asked for, and the sales it is a calculation of.
 */
export const saleCalculationLinks = (
  collectionPath: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/calculate`,
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
