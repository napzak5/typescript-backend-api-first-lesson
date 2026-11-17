/**
 * Links of a single stock row; `collectionPath` is where the inventory
 * routes are mounted.
 */
export const inventoryLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

/**
 * Links of a stock movement: its stock row and the row's history. A
 * movement has no address of its own; it is read in the history.
 */
export const movementLinks = (
  collectionPath: string,
  inventoryId: string,
): { inventory: string; movements: string } => ({
  inventory: `${collectionPath}/${inventoryId}`,
  movements: `${collectionPath}/${inventoryId}/movements`,
})
