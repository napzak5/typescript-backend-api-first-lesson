import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DomainError } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  attachmentMessages,
  authMessages,
  availableSlotMessages,
  bookingMessages,
  customerAllergyMessages,
  customerMessages,
  customerVersionMessages,
  inventoryAlertMessages,
  inventoryMessages,
  medicalChartMessages,
  paymentMethodMessages,
  pointMessages,
  productMessages,
  purchaseOrderMessages,
  reviewMessages,
  reviewReportMessages,
  saleMessages,
  salonMessages,
  serviceCategoryMessages,
  serviceMessages,
  shareLinkMessages,
  staffMessages,
  staffProfileMessages,
  treatmentRecordMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  decodeAttachmentDownloadQuery,
  decodeAttachmentSearchQuery,
} from '../attachment/_shared'
import { decodeSessionSearchQuery } from '../auth/_shared/query'
import { decodeAvailableSlotSearchQuery } from '../available-slot/_shared/query'
import { decodeBookingSearchQuery } from '../booking/_shared/query'
import {
  decodeCustomerExportQuery,
  decodeCustomerSearchQuery,
} from '../customer/_shared/query'
import { decodeCustomerHistoryQuery } from '../customer-version/_shared/query'
import {
  decodeExpiringSearchQuery,
  decodeInventorySearchQuery,
  decodeLowStockSearchQuery,
  decodeMovementSearchQuery,
} from '../inventory/_shared/query'
import { decodeInventoryAlertSearchQuery } from '../inventory-alert/_shared/query'
import {
  decodeCustomerAllergySearchQuery,
  decodeMedicalChartSearchQuery,
} from '../medical-chart/_shared/query'
import { decodePaymentMethodSearchQuery } from '../payment-method/_shared/query'
import {
  decodeExpiringPointsQuery,
  decodePointTransactionSearchQuery,
} from '../point/_shared/query'
import { decodeProductSearchQuery } from '../product/_shared/query'
import {
  decodePurchaseOrderSearchQuery,
  decodeReorderSuggestionSearchQuery,
} from '../purchase-order/_shared/query'
import { decodeReviewSearchQuery } from '../review/_shared/query'
import { decodeReviewReportSearchQuery } from '../review-report/_shared/query'
import { decodeSaleSearchQuery } from '../sale/_shared/query'
import { decodeSalonSearchQuery } from '../salon/_shared/query'
import { decodeServiceSearchQuery } from '../service/_shared/query'
import { decodeServiceCategorySearchQuery } from '../service-category/_shared/query'
import { decodeShareLinkSearchQuery } from '../share-link/_shared'
import { decodeStaffSearchQuery } from '../staff/_shared/query'
import { decodeStaffProfileSearchQuery } from '../staff-profile/_shared/query'
import { decodeTreatmentRecordSearchQuery } from '../treatment-record/_shared/query'

/*
 * A decoder gives the parameters of a query that are not text their types.
 * A query it cannot decode is a validation error, whose headline says which
 * request was wrong, in every language: a message of the domain.
 */

const ROUTES = join(import.meta.dirname, '..')

type Decoder = (query: unknown) => Result<unknown, DomainError>

/** Every decoder, with a query it cannot decode and what is then wrong. */
const DECODERS: [string, Decoder, Record<string, unknown>, LocalizedText][] = [
  [
    'decodeAttachmentDownloadQuery',
    decodeAttachmentDownloadQuery,
    { inline: 'yes' },
    attachmentMessages.invalidAttachmentDownload,
  ],
  [
    'decodeAttachmentSearchQuery',
    decodeAttachmentSearchQuery,
    { limit: 'ten' },
    attachmentMessages.invalidAttachmentSearch,
  ],
  [
    'decodeAvailableSlotSearchQuery',
    decodeAvailableSlotSearchQuery,
    { limit: 'ten' },
    availableSlotMessages.invalidAvailableSlotSearch,
  ],
  [
    'decodeBookingSearchQuery',
    decodeBookingSearchQuery,
    { limit: 'ten' },
    bookingMessages.invalidBookingSearch,
  ],
  [
    'decodeCustomerAllergySearchQuery',
    decodeCustomerAllergySearchQuery,
    { limit: 'ten' },
    customerAllergyMessages.invalidCustomerAllergySearch,
  ],
  [
    'decodeCustomerExportQuery',
    decodeCustomerExportQuery,
    { tags: { first: 'vip' } },
    customerMessages.invalidCustomerExport,
  ],
  [
    'decodeCustomerHistoryQuery',
    decodeCustomerHistoryQuery,
    { limit: 'ten' },
    customerVersionMessages.invalidCustomerHistorySearch,
  ],
  [
    'decodeCustomerSearchQuery',
    decodeCustomerSearchQuery,
    { limit: 'ten' },
    customerMessages.invalidCustomerSearch,
  ],
  [
    'decodeExpiringPointsQuery',
    decodeExpiringPointsQuery,
    { days: 'ten' },
    pointMessages.invalidExpiringPointsSearch,
  ],
  [
    'decodeExpiringSearchQuery',
    decodeExpiringSearchQuery,
    { limit: 'ten' },
    inventoryMessages.invalidExpiringSearch,
  ],
  [
    'decodeInventoryAlertSearchQuery',
    decodeInventoryAlertSearchQuery,
    { limit: 'ten' },
    inventoryAlertMessages.invalidInventoryAlertSearch,
  ],
  [
    'decodeInventorySearchQuery',
    decodeInventorySearchQuery,
    { limit: 'ten' },
    inventoryMessages.invalidInventorySearch,
  ],
  [
    'decodeLowStockSearchQuery',
    decodeLowStockSearchQuery,
    { limit: 'ten' },
    inventoryMessages.invalidLowStockSearch,
  ],
  [
    'decodeMedicalChartSearchQuery',
    decodeMedicalChartSearchQuery,
    { limit: 'ten' },
    medicalChartMessages.invalidMedicalChartSearch,
  ],
  [
    'decodeMovementSearchQuery',
    decodeMovementSearchQuery,
    { limit: 'ten' },
    inventoryMessages.invalidStockMovementSearch,
  ],
  [
    'decodePaymentMethodSearchQuery',
    decodePaymentMethodSearchQuery,
    { limit: 'ten' },
    paymentMethodMessages.invalidPaymentMethodSearch,
  ],
  [
    'decodePointTransactionSearchQuery',
    decodePointTransactionSearchQuery,
    { limit: 'ten' },
    pointMessages.invalidPointTransactionSearch,
  ],
  [
    'decodeProductSearchQuery',
    decodeProductSearchQuery,
    { limit: 'ten' },
    productMessages.invalidProductSearch,
  ],
  [
    'decodePurchaseOrderSearchQuery',
    decodePurchaseOrderSearchQuery,
    { limit: 'ten' },
    purchaseOrderMessages.invalidPurchaseOrderSearch,
  ],
  [
    'decodeReorderSuggestionSearchQuery',
    decodeReorderSuggestionSearchQuery,
    { limit: 'ten' },
    purchaseOrderMessages.invalidReorderSuggestionSearch,
  ],
  [
    'decodeReviewReportSearchQuery',
    decodeReviewReportSearchQuery,
    { limit: 'ten' },
    reviewReportMessages.invalidReviewReportSearch,
  ],
  [
    'decodeReviewSearchQuery',
    decodeReviewSearchQuery,
    { limit: 'ten' },
    reviewMessages.invalidReviewSearch,
  ],
  [
    'decodeSaleSearchQuery',
    decodeSaleSearchQuery,
    { limit: 'ten' },
    saleMessages.invalidSaleSearch,
  ],
  [
    'decodeSalonSearchQuery',
    decodeSalonSearchQuery,
    { limit: 'ten' },
    salonMessages.invalidSalonSearch,
  ],
  [
    'decodeServiceCategorySearchQuery',
    decodeServiceCategorySearchQuery,
    { limit: 'ten' },
    serviceCategoryMessages.invalidServiceCategorySearch,
  ],
  [
    'decodeServiceSearchQuery',
    decodeServiceSearchQuery,
    { limit: 'ten' },
    serviceMessages.invalidServiceSearch,
  ],
  [
    'decodeSessionSearchQuery',
    decodeSessionSearchQuery,
    { limit: 'ten' },
    authMessages.invalidSessionSearch,
  ],
  [
    'decodeShareLinkSearchQuery',
    decodeShareLinkSearchQuery,
    { limit: 'ten' },
    shareLinkMessages.invalidShareLinkSearch,
  ],
  [
    'decodeStaffProfileSearchQuery',
    decodeStaffProfileSearchQuery,
    { limit: 'ten' },
    staffProfileMessages.invalidStaffProfileSearch,
  ],
  [
    'decodeStaffSearchQuery',
    decodeStaffSearchQuery,
    { limit: 'ten' },
    staffMessages.invalidStaffSearch,
  ],
  [
    'decodeTreatmentRecordSearchQuery',
    decodeTreatmentRecordSearchQuery,
    { limit: 'ten' },
    treatmentRecordMessages.invalidTreatmentRecordSearch,
  ],
]

/** The decoders that the sources of the routes make. */
const decodersOfTheRoutes = (): string[] =>
  readdirSync(ROUTES, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.includes('__tests__'))
    .flatMap((file) =>
      [
        ...readFileSync(join(ROUTES, file), 'utf8').matchAll(
          /export const (\w+) = queryDecoder\(/g,
        ),
      ].map(([, name]) => name ?? ''),
    )

describe('the decoders of the queries', () => {
  it.each(DECODERS)(
    'should say which request was wrong: %s',
    (_name, decode, query, message) => {
      // Act
      const decoded = decode(query)

      // Assert
      expect(decoded).toMatchObject({
        type: 'error',
        error: { type: 'validation', message },
      })
    },
  )

  it('should have a query in this test for every decoder of the routes', () => {
    // Act
    const decoders = decodersOfTheRoutes()

    // Assert
    expect(DECODERS.map(([name]) => name).toSorted()).toEqual(
      decoders.toSorted(),
    )
  })
})
