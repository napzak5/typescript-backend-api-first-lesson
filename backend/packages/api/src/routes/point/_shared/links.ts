/**
 * Links of the points of a customer: their balance and their history.
 * A point transaction has no address of its own; it is read in the
 * history. `pointsPath` is where the point routes are mounted.
 */
export const customerPointsLinks = (
  pointsPath: string,
  customerId: string,
): { balance: string; transactions: string } => ({
  balance: `${pointsPath}/customer/${customerId}/balance`,
  transactions: `${pointsPath}/customer/${customerId}/transactions`,
})
