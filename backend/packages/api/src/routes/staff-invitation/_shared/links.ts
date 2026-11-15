/**
 * Links of the invitation of a staff member. `invitationPath` is where the
 * routes are mounted: the path of the staff member in the ledger, and
 * below it the one invitation they can hold.
 */
export const staffInvitationLinks = (
  invitationPath: string,
): { self: string; staff: string } => ({
  self: invitationPath,
  staff: invitationPath.slice(0, invitationPath.lastIndexOf('/')),
})
