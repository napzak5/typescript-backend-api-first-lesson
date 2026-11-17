import { match, P } from 'ts-pattern'
import type {
  DbAcknowledgementOfAlert,
  DbInventoryAlertAcknowledgement,
  DbInventoryAlertFacts,
  DbNewInventoryAlertAcknowledgement,
  DbProductStockOfAlert,
  InventoryAlertPosition,
  InventoryAlertSeverity,
  InventoryAlertType,
} from '../../../models/inventory-alert'
import {
  EXPIRING_SOON_DAYS,
  lastExpiringDayOf,
} from '../../inventory/_shared/expiry'

/**
 * The alerts of the stock of a salon are not stored: they are worked out of
 * its products, its stock rows and their movements whenever they are read,
 * by the rules of the list of low stock and of the list of what expires. An
 * alert is about a product (its stock at the salon is at or below its
 * minimum, or above its maximum) or about a stock row (it expires soon, or
 * has expired). What is stored is that somebody acknowledged an alert; the
 * acknowledgement holds while what it was given for lasts.
 */

/**
 * The days that decide the alerts of the stock rows of a salon, as its
 * clocks tell them: today, and the last day that counts as expiring soon.
 */
export type AlertDays = { today: string; lastExpiringDay: string }

/** Null when the runtime does not know the time zone of the salon. */
export const alertDaysOf = (now: Date, timezone: string): AlertDays | null => {
  const today = lastExpiringDayOf(now, timezone, 0)
  const lastExpiringDay = lastExpiringDayOf(now, timezone, EXPIRING_SOON_DAYS)

  return today === null || lastExpiringDay === null
    ? null
    : { today, lastExpiringDay }
}

/**
 * A figure of the stock (`numeric(10, 2)`) as a number. Two such figures
 * compare as their numbers do: each is read as the number nearest to it,
 * and below 10^8 two figures that differ lie further apart than two
 * numbers there do.
 */
const figure = (text: string): number => Number(text)

/** What an alert is about: a product at a salon, or a stock row. */
export type AlertSubject = 'product' | 'stockRow'

export const subjectOf = (alert: InventoryAlertType): AlertSubject =>
  match(alert)
    .returnType<AlertSubject>()
    .with('low_stock', 'overstock', () => 'product')
    .with('expiring', 'expired', () => 'stockRow')
    .exhaustive()

type ProductAlert = {
  alert: 'low_stock' | 'overstock'
  severity: InventoryAlertSeverity
  threshold: string
}

/**
 * The alert of the stock of a product at a salon, if it has one. Its stock
 * at or below its minimum is low, critically when there is none; above its
 * maximum, when it has one, it is more than the salon keeps. The minimum is
 * at most the maximum, so a product has one of the two at most.
 */
export const productAlertOf = ({
  stock,
  minimumStock,
  maximumStock,
}: Pick<
  DbProductStockOfAlert,
  'stock' | 'minimumStock' | 'maximumStock'
>): ProductAlert | null => {
  if (figure(stock) <= figure(minimumStock)) {
    return {
      alert: 'low_stock',
      severity: figure(stock) === 0 ? 'critical' : 'warning',
      threshold: minimumStock,
    }
  }
  if (maximumStock !== null && figure(stock) > figure(maximumStock)) {
    return { alert: 'overstock', severity: 'info', threshold: maximumStock }
  }

  return null
}

type StockRowAlert = {
  alert: 'expiring' | 'expired'
  severity: InventoryAlertSeverity
}

/**
 * The alert of a stock row, if it has one: one with stock whose expiry date
 * is before today has expired, one whose expiry date is today or within the
 * days that count as expiring soon expires soon. A row without stock has
 * nothing to use or throw away.
 */
export const stockRowAlertOf = (
  { currentStock, expiryDate }: { currentStock: string; expiryDate: string },
  { today, lastExpiringDay }: AlertDays,
): StockRowAlert | null => {
  if (figure(currentStock) <= 0) {
    return null
  }
  // Dates as `yyyy-MM-dd` are in the order of their text.
  if (expiryDate < today) {
    return { alert: 'expired', severity: 'critical' }
  }
  if (expiryDate <= lastExpiringDay) {
    return { alert: 'expiring', severity: 'warning' }
  }

  return null
}

/**
 * Whether the latest acknowledgement of the alert of a product still holds:
 * its threshold is the one the product has now, and from the time of the
 * acknowledgement on the stock never left the alert nor made it more
 * severe than it was acknowledged at. A low stock acknowledged as a warning
 * no longer holds once the stock ran out.
 */
export const productAcknowledgementHolds = (
  alert: ProductAlert,
  {
    acknowledgement,
    lowestStock,
    highestStock,
  }: Extract<DbAcknowledgementOfAlert, { type: 'product' }>,
): boolean => {
  if (
    acknowledgement.threshold === null ||
    figure(acknowledgement.threshold) !== figure(alert.threshold)
  ) {
    return false
  }

  return match(alert.alert)
    .returnType<boolean>()
    .with(
      'low_stock',
      () =>
        figure(highestStock) <= figure(alert.threshold) &&
        (acknowledgement.severity === 'critical' || figure(lowestStock) > 0),
    )
    .with('overstock', () => figure(lowestStock) > figure(alert.threshold))
    .exhaustive()
}

/**
 * Whether the latest acknowledgement of the alert of a stock row still
 * holds: the row expires on the day it was acknowledged for, and no
 * movement since left it without stock. A row that has expired since it
 * was acknowledged as expiring has another alert, which nobody has
 * acknowledged yet.
 */
export const stockRowAcknowledgementHolds = (
  expiryDate: string,
  {
    acknowledgement,
    lowestStock,
  }: Extract<DbAcknowledgementOfAlert, { type: 'stockRow' }>,
): boolean =>
  acknowledgement.expiryDate === expiryDate &&
  (lowestStock === null || figure(lowestStock) > 0)

/** An alert of the stock of a salon, worked out. */
export type InventoryAlert = {
  alert: InventoryAlertType
  severity: InventoryAlertSeverity
  salonId: string
  productId: string
  productCode: string
  productName: string
  unit: string
  inventoryId: string | null
  lotNumber: string | null
  expiryDate: string | null
  currentStock: string
  threshold: string | null
  /** The acknowledgement that still holds for it. */
  acknowledgement: DbInventoryAlertAcknowledgement | null
  position: InventoryAlertPosition
}

/**
 * An alert is known by its type and by what it is about: the product or
 * the stock row. No product and stock row share an ID.
 */
const keyOf = (alert: InventoryAlertType, subjectId: string): string =>
  `${alert}:${subjectId}`

/** The ID that tells an alert from the others of its type. */
export const subjectIdOf = ({
  productId,
  inventoryId,
}: {
  productId: string
  inventoryId: string | null
}): string => inventoryId ?? productId

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

/**
 * The order of the alerts: by the place of the product, the alert of the
 * product before those of its stock rows, and those by expiry date and ID.
 */
export const comparePositions = (
  a: InventoryAlertPosition,
  b: InventoryAlertPosition,
): number =>
  a.place - b.place ||
  Number(a.inventoryId !== null) - Number(b.inventoryId !== null) ||
  compareText(a.expiryDate ?? '', b.expiryDate ?? '') ||
  compareText(a.inventoryId ?? '', b.inventoryId ?? '')

/**
 * The alerts that the facts of a salon, or of one of its products or stock
 * rows, come to, each with the acknowledgement that still holds for it, in
 * their order.
 */
export const alertsOf = (
  { products, rows, acknowledgements }: DbInventoryAlertFacts,
  days: AlertDays,
): InventoryAlert[] => {
  const latest = new Map(
    acknowledgements.map((fact) => [
      keyOf(fact.acknowledgement.alert, subjectIdOf(fact.acknowledgement)),
      fact,
    ]),
  )

  const ofProducts = products.flatMap((product): InventoryAlert[] => {
    const alert = productAlertOf(product)
    if (alert === null) {
      return []
    }
    const acknowledgement = match(
      latest.get(keyOf(alert.alert, product.productId)),
    )
      .returnType<DbInventoryAlertAcknowledgement | null>()
      .with({ type: 'product' }, (fact) =>
        productAcknowledgementHolds(alert, fact) ? fact.acknowledgement : null,
      )
      .with({ type: 'stockRow' }, P.nullish, () => null)
      .exhaustive()

    return [
      {
        ...alert,
        salonId: product.salonId,
        productId: product.productId,
        productCode: product.productCode,
        productName: product.productName,
        unit: product.unit,
        inventoryId: null,
        lotNumber: null,
        expiryDate: null,
        currentStock: product.stock,
        acknowledgement,
        position: { place: product.place, inventoryId: null, expiryDate: null },
      },
    ]
  })

  const ofRows = rows.flatMap((row): InventoryAlert[] => {
    const alert = stockRowAlertOf(row, days)
    if (alert === null) {
      return []
    }
    const acknowledgement = match(
      latest.get(keyOf(alert.alert, row.inventoryId)),
    )
      .returnType<DbInventoryAlertAcknowledgement | null>()
      .with({ type: 'stockRow' }, (fact) =>
        stockRowAcknowledgementHolds(row.expiryDate, fact)
          ? fact.acknowledgement
          : null,
      )
      .with({ type: 'product' }, P.nullish, () => null)
      .exhaustive()

    return [
      {
        ...alert,
        salonId: row.salonId,
        productId: row.productId,
        productCode: row.productCode,
        productName: row.productName,
        unit: row.unit,
        inventoryId: row.inventoryId,
        lotNumber: row.lotNumber,
        expiryDate: row.expiryDate,
        currentStock: row.currentStock,
        threshold: null,
        acknowledgement,
        position: {
          place: row.place,
          inventoryId: row.inventoryId,
          expiryDate: row.expiryDate,
        },
      },
    ]
  })

  return [...ofProducts, ...ofRows].sort((a, b) =>
    comparePositions(a.position, b.position),
  )
}

/** What a list of alerts is narrowed to; null leaves it as it is. */
export type InventoryAlertFilter = {
  alert: InventoryAlertType | null
  severity: InventoryAlertSeverity | null
  acknowledged: boolean | null
}

export const matchesFilter = (
  { alert, severity, acknowledgement }: InventoryAlert,
  filter: InventoryAlertFilter,
): boolean =>
  (filter.alert === null || alert === filter.alert) &&
  (filter.severity === null || severity === filter.severity) &&
  (filter.acknowledged === null ||
    (acknowledgement !== null) === filter.acknowledged)

/**
 * The alerts of a page: those after the position of the cursor, at most
 * the limit of them, and whether more follow.
 */
export const pageOfAlerts = (
  alerts: InventoryAlert[],
  after: InventoryAlertPosition | null,
  limit: number,
): { alerts: InventoryAlert[]; hasMore: boolean } => {
  const following =
    after === null
      ? alerts
      : alerts.filter(({ position }) => comparePositions(position, after) > 0)

  return {
    alerts: following.slice(0, limit),
    hasMore: following.length > limit,
  }
}

/** The counts of the alerts of a salon. */
export const summaryOf = (
  alerts: InventoryAlert[],
): {
  totalAlerts: number
  criticalAlerts: number
  warningAlerts: number
  infoAlerts: number
  unacknowledged: number
} => {
  const counted = (severity: InventoryAlertSeverity): number =>
    alerts.filter((alert) => alert.severity === severity).length

  return {
    totalAlerts: alerts.length,
    criticalAlerts: counted('critical'),
    warningAlerts: counted('warning'),
    infoAlerts: counted('info'),
    unacknowledged: alerts.filter(
      ({ acknowledgement }) => acknowledgement === null,
    ).length,
  }
}

/** What a request to acknowledge an alert names, and who asks. */
export type AlertAcknowledgement = {
  alert: InventoryAlertType
  productId: string
  inventoryId: string | null
  notes: string | null
  acknowledgedBy: string | null
}

export type AcknowledgementDecision =
  | { type: 'notActive' }
  | { type: 'alreadyAcknowledged' }
  | {
      type: 'acknowledge'
      alert: InventoryAlert
      acknowledgement: DbNewInventoryAlertAcknowledgement
    }

/**
 * Whether the alert a request names is there to acknowledge, decided on the
 * facts of its product or stock row: it is not there when its product or
 * row does not have it now, and it is acknowledged already when an
 * acknowledgement of it still holds. The acknowledgement keeps what the
 * alert is like now.
 */
export const decideAcknowledgement = (
  facts: DbInventoryAlertFacts,
  days: AlertDays,
  request: AlertAcknowledgement,
): AcknowledgementDecision => {
  const alert = alertsOf(facts, days).find(
    (candidate) =>
      candidate.alert === request.alert &&
      candidate.productId === request.productId &&
      candidate.inventoryId === request.inventoryId,
  )
  if (alert === undefined) {
    return { type: 'notActive' }
  }
  if (alert.acknowledgement !== null) {
    return { type: 'alreadyAcknowledged' }
  }

  return {
    type: 'acknowledge',
    alert,
    acknowledgement: {
      salonId: alert.salonId,
      productId: alert.productId,
      inventoryId: alert.inventoryId,
      alert: alert.alert,
      severity: alert.severity,
      threshold: alert.threshold,
      expiryDate: alert.expiryDate,
      notes: request.notes,
      acknowledgedBy: request.acknowledgedBy,
    },
  }
}
