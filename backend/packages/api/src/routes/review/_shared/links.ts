/** Links of a single review; `collectionPath` is where the review routes are mounted. */
export const reviewLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

/**
 * Links of what the reviews of a salon or of a staff member come to;
 * `reviewsPath` is where the routes of their reviews are mounted, which
 * names them. The reviews themselves are listed with a filter of the
 * review list.
 */
export const reviewSummaryLinks = (reviewsPath: string): { self: string } => ({
  self: `${reviewsPath}/summary`,
})
