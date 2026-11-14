/** Links of a single customer; `collectionPath` is where the customer routes are mounted. */
export const customerLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
