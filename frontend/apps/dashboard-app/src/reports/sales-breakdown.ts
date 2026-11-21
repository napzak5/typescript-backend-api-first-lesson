/*
 * How the sales of the members of the staff and of the kinds of service
 * are compared: the share a bar draws, and the sales of one service of a
 * kind.
 */

/**
 * A share of the largest, in percent from 0 to 100: what a bar draws of
 * its whole length. 0 when the largest is nothing.
 */
export const percentOfMost = (value: number, largest: number): number =>
  largest > 0 ? Math.min(100, Math.max(0, (value * 100) / largest)) : 0

/**
 * The sales of one service of a kind: its sales over the number of its
 * services, without the part of a yen, as the API cuts its averages. 0
 * when none was sold.
 */
export const perServiceOf = (amount: number, count: number): number =>
  count > 0 ? Math.floor(amount / count) : 0
