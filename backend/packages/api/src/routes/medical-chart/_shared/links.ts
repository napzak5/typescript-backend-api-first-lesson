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

/**
 * Where the allergies of a customer are listed; `collectionPath` is where
 * the medical chart routes are mounted. One allergy has no route of its
 * own to read it.
 */
export const customerAllergiesPath = (
  collectionPath: string,
  customerId: string,
): string => `${collectionPath}/customer/${customerId}/allergies`
