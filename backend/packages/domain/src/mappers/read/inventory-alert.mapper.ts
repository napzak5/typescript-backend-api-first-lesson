import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { InventoryAlert } from '../../business-logic/inventory-alert/_shared/alerts'
import type {
  ApiInventoryAlertAcknowledgementResponse,
  ApiInventoryAlertResponse,
  DbInventoryAlertAcknowledgement,
} from '../../models/inventory-alert'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

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

const MESSAGE = 'Stored inventory alert does not match the API model'

const convertedAlertSchema = z.object({
  currentStock: numericSchema,
  threshold: numericSchema.nullable(),
})

const convertedAcknowledgementSchema = z.object({
  threshold: numericSchema.nullable(),
  acknowledgedAt: timestampSchema,
})

const toApiAcknowledgement = (
  acknowledgement: DbInventoryAlertAcknowledgement,
): Result<ApiInventoryAlertAcknowledgementResponse, DomainError> =>
  Result.map(
    parseWith(convertedAcknowledgementSchema, acknowledgement, MESSAGE),
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
  const converted = parseWith(convertedAlertSchema, alert, MESSAGE)
  const acknowledgement =
    alert.acknowledgement === null
      ? Result.success(null)
      : toApiAcknowledgement(alert.acknowledgement)

  return Result.mapError(
    Result.flatMap(converted, (figures) =>
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
    ),
    // The request was fine; what the database told is not.
    (error) =>
      DomainErrors.database(
        `Inventory alert ${alert.alert} of ${alert.inventoryId ?? alert.productId} does not match the API model`,
        error,
      ),
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
}
