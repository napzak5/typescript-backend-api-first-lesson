/**
 * Links of a single treatment record; `collectionPath` is where the
 * treatment record routes are mounted.
 */
export const treatmentRecordLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})
