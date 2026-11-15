/**
 * Links of the answer to a check; `slotsPath` is where the routes of the
 * slots are mounted, which names the salon.
 */
export const availableSlotCheckLinks = (
  slotsPath: string,
): { self: string; list: string } => ({
  self: `${slotsPath}/check`,
  list: slotsPath,
})
