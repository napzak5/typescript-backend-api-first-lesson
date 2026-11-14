/** Links of a single salon; `collectionPath` is where the salon routes are mounted. */
export const salonLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
