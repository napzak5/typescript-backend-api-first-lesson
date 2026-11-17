/**
 * Links of a single medical chart, which is read by its customer;
 * `collectionPath` is where the medical chart routes are mounted.
 */
export const medicalChartLinks = (
  collectionPath: string,
  customerId: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/customer/${customerId}`,
  list: collectionPath,
})
