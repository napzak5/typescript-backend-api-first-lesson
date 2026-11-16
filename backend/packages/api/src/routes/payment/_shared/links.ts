/**
 * Links of a payment. A payment has no address of its own: it is read with
 * its sale, and the sales are served next to the payments. `paymentsPath`
 * is where the payment routes are mounted.
 */
export const paymentLinks = (
  paymentsPath: string,
  saleId: string,
): { sale: string } => ({
  sale: `${paymentsPath.slice(0, paymentsPath.lastIndexOf('/'))}/sales/${saleId}`,
})
