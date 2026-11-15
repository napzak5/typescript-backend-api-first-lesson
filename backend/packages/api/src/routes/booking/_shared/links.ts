/** Links of a single booking; `collectionPath` is where the booking routes are mounted. */
export const bookingLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
