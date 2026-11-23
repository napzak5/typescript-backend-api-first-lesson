import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  type InventoryAlert,
  type InventoryAlertList,
  subjectIdOf,
} from '../../business-logic/inventory-alert/_shared/alerts'
import type {
  ApiInventoryAlertAcknowledgementResponse,
  ApiInventoryAlertResponse,
  ApiInventoryAlertSummaryResponse,
  DbInventoryAlertAcknowledgement,
  InventoryAlertSeverity,
} from '../../models/inventory-alert'
import type { ApiPage, Paging } from '../../models/page'
import { type DomainError, parseStored } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
import { toApiPageEndingAt } from './page'

/**
 * An alert of the stock, as it was worked out, → API response. What changes
 * is the representation of the stock figures, which are read as text and
 * returned as numbers, and of the time of the acknowledgement, from
 * PostgreSQL's text format to ISO 8601. The acknowledgement is a row of
 * `inventory_alert_acknowledgements` with every column, named as its
 * columns are.
 *
 * Every property is named: a column added to the table is not shown by
 * itself.
 */

const convertedAlertSchema = z.object({
  currentStock: numericSchema,
  threshold: numericSchema.nullable(),
}) satisfies z.ZodType<
  Pick<ApiInventoryAlertResponse, 'currentStock' | 'threshold'>
>

const convertedAcknowledgementSchema = z.object({
  threshold: numericSchema.nullable(),
  acknowledgedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiInventoryAlertAcknowledgementResponse, 'threshold' | 'acknowledgedAt'>
>

/** `description` says which alert the acknowledgement is read with. */
const toApiAcknowledgement = (
  acknowledgement: DbInventoryAlertAcknowledgement,
  description: string,
): Result<ApiInventoryAlertAcknowledgementResponse, DomainError> =>
  Result.map(
    parseStored(convertedAcknowledgementSchema, acknowledgement, description),
    (converted) => ({
      id: acknowledgement.id,
      salonId: acknowledgement.salonId,
      productId: acknowledgement.productId,
      inventoryId: acknowledgement.inventoryId,
      alert: acknowledgement.alert,
      severity: acknowledgement.severity,
      threshold: converted.threshold,
      expiryDate: acknowledgement.expiryDate,
      notes: acknowledgement.notes,
      acknowledgedBy: acknowledgement.acknowledgedBy,
      acknowledgedAt: converted.acknowledgedAt,
    }),
  )

const toApiInventoryAlert = (
  alert: InventoryAlert,
): Result<ApiInventoryAlertResponse, DomainError> => {
  // The request was fine; what the database told is not.
  const description = `Inventory alert ${alert.alert} of ${alert.inventoryId ?? alert.productId} does not match the API model`
  const converted = parseStored(convertedAlertSchema, alert, description)
  const acknowledgement =
    alert.acknowledgement === null
      ? Result.success(null)
      : toApiAcknowledgement(alert.acknowledgement, description)

  return Result.flatMap(converted, (figures) =>
    Result.map(acknowledgement, (acknowledged) => ({
      alert: alert.alert,
      severity: alert.severity,
      salonId: alert.salonId,
      productId: alert.productId,
      productCode: alert.productCode,
      productName: alert.productName,
      unit: alert.unit,
      inventoryId: alert.inventoryId,
      lotNumber: alert.lotNumber,
      expiryDate: alert.expiryDate,
      currentStock: figures.currentStock,
      threshold: figures.threshold,
      acknowledgement: acknowledged,
    })),
  )
}

export const InventoryAlertReadMapper = {
  toApiInventoryAlert,

  toApiInventoryAlerts(
    alerts: InventoryAlert[],
  ): Result<ApiInventoryAlertResponse[], DomainError> {
    const apiAlerts: ApiInventoryAlertResponse[] = []
    for (const alert of alerts) {
      const mapped = toApiInventoryAlert(alert)
      if (mapped.type === 'error') {
        return mapped
      }
      apiAlerts.push(mapped.data)
    }

    return Result.success(apiAlerts)
  },

  /**
   * The alerts of a page as a page of the list. The cursor of the page
   * after it is what its last alert is about: its stock row, or its
   * product.
   */
  toApiInventoryAlertPage(
    { alerts, total, hasMore }: InventoryAlertList,
    paging: Paging<string>,
  ): Result<ApiPage<ApiInventoryAlertResponse>, DomainError> {
    const last = alerts.at(-1)

    return Result.map(
      InventoryAlertReadMapper.toApiInventoryAlerts(alerts),
      (data) =>
        toApiPageEndingAt(
          data,
          { total, hasMore },
          paging,
          last === undefined ? null : subjectIdOf(last),
        ),
    )
  },

  /** The counts of the alerts of a salon: all of them, those of each severity, and those no acknowledgement holds for. */
  toApiInventoryAlertSummary(
    alerts: InventoryAlert[],
  ): ApiInventoryAlertSummaryResponse {
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
  },
}
