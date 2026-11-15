/**
 * Links of the preferences of a customer. `preferencesPath` is where the
 * routes are mounted: the path of the customer, in the ledger or as "me",
 * and below it the one set of preferences a customer has.
 */
export const customerPreferencesLinks = (
  preferencesPath: string,
): { self: string; customer: string } => ({
  self: preferencesPath,
  customer: preferencesPath.slice(0, preferencesPath.lastIndexOf('/')),
})
