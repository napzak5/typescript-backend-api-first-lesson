/**
 * Makes the numbers by which people name a sale, on a receipt and at the
 * counter. Like a booking number, a sale number tells nothing about how
 * many sales there are, so it is drawn at random and not counted up;
 * `saleNumberFrom` says what it looks like.
 */
export interface ISaleNumberIssuer {
  issue(): string
}
