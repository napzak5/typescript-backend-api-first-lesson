/**
 * Makes the numbers by which people name a purchase order, to the supplier
 * and when the goods arrive. Like a sale number it tells nothing about how
 * many orders a salon places, so it is drawn at random and not counted up;
 * `purchaseOrderNumberFrom` says what it looks like.
 */
export interface IPurchaseOrderNumberIssuer {
  issue(): string
}
