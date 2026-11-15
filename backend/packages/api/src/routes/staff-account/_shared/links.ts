/**
 * Links of the account of a staff member. `accountPath` is where the
 * routes are mounted: the path of the staff member in the ledger, and
 * below it the one account they can have.
 */
export const staffAccountLinks = (
  accountPath: string,
): { self: string; staff: string } => ({
  self: accountPath,
  staff: accountPath.slice(0, accountPath.lastIndexOf('/')),
})
