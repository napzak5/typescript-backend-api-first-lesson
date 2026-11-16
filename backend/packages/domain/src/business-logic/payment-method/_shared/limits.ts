/**
 * The limits of the amount of one payment that a payment method takes. A
 * limit that is null is no limit.
 */
export type AmountLimits = {
  minimumAmount: number | null
  maximumAmount: number | null
}

/** Whether the lower limit is not above the upper one. */
export const limitsAreInOrder = ({
  minimumAmount,
  maximumAmount,
}: AmountLimits): boolean =>
  minimumAmount === null ||
  maximumAmount === null ||
  minimumAmount <= maximumAmount

/**
 * The limits a payment method has after a change: those the change names,
 * and of the others what the payment method had. A change that names null
 * takes a limit away.
 */
export const limitsAfter = (
  current: AmountLimits,
  changes: Partial<AmountLimits>,
): AmountLimits => ({
  minimumAmount:
    changes.minimumAmount === undefined
      ? current.minimumAmount
      : changes.minimumAmount,
  maximumAmount:
    changes.maximumAmount === undefined
      ? current.maximumAmount
      : changes.maximumAmount,
})
