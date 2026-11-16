/** Links of a single sale; `collectionPath` is where the sale routes are mounted. */
export const saleLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
