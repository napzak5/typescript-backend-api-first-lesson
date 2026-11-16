/**
 * Makes the numbers by which people name a payment, on a receipt and when
 * one is to be refunded. Like a sale number it tells nothing about how
 * many payments there are, so it is drawn at random and not counted up;
 * `paymentNumberFrom` says what it looks like.
 */
export interface IPaymentNumberIssuer {
  issue(): string
}
