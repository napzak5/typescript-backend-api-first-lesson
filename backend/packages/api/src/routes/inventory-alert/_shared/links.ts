/**
 * Links of an alert of the stock of a salon; `collectionPath` is where the
 * alert routes are mounted. An alert has no path of its own: it is listed
 * and counted with the others of its salon.
 */
export const inventoryAlertLinks = (
  collectionPath: string,
  salonId: string,
): { list: string; summary: string } => ({
  list: `${collectionPath}?salonId=${salonId}`,
  summary: `${collectionPath}/summary?salonId=${salonId}`,
})
