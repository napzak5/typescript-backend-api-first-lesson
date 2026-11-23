import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  attachmentMessages,
  authMessages,
  bookingMessages,
  customerAllergyMessages,
  customerMessages,
  inventoryMessages,
  medicalChartMessages,
  paymentMessages,
  paymentMethodMessages,
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
  treatmentRecordMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import type { DomainError } from '../../shared'
import { parseAttachmentId } from '../attachment'
import { parseSessionId, parseUserId } from '../auth'
import {
  parseBookingId,
  parseBookingIdOfPath,
  parseBookingServiceId,
} from '../booking'
import { parseCustomerId } from '../customer'
import {
  parseAllergyCustomerId,
  parseCustomerAllergyIds,
} from '../customer-allergy'
import { parseInventoryId } from '../inventory'
import { parseChartCustomerId, parseMedicalChartId } from '../medical-chart'
import { parsePaymentId } from '../payment'
import { parsePaymentMethodId } from '../payment-method'
import { parseProductId } from '../product'
import { parsePurchaseOrderId } from '../purchase-order'
import { parseReviewId } from '../review'
import { parseReviewReportId } from '../review-report'
import { parseSaleId } from '../sale'
import { parseSalonId, parseSalonIdOfPath } from '../salon'
import { parseServiceId } from '../service'
import { parseCategoryId } from '../service-category'
import { parseShareLinkId } from '../share-link'
import { parseStaffId, parseStaffIdOfPath } from '../staff'
import {
  parseTreatmentPhotoIds,
  parseTreatmentRecordId,
} from '../treatment-record'

/*
 * What is no ID is a validation error, whose headline says which ID was
 * wrong, in every language: a message of the domain of what the ID names.
 */

const MODELS = join(import.meta.dirname, '..')

/** Every function that reads IDs, given what is none, and what is then wrong. */
const PARSERS: [string, () => Result<unknown, DomainError>, LocalizedText][] = [
  [
    'parseAllergyCustomerId',
    () => parseAllergyCustomerId('latest'),
    customerMessages.invalidCustomerId,
  ],
  [
    'parseAttachmentId',
    () => parseAttachmentId('latest'),
    attachmentMessages.invalidAttachmentId,
  ],
  [
    'parseBookingId',
    () => parseBookingId('latest'),
    bookingMessages.invalidBookingId,
  ],
  [
    'parseBookingIdOfPath',
    () => parseBookingIdOfPath('latest'),
    bookingMessages.invalidBookingId,
  ],
  [
    'parseBookingServiceId',
    () => parseBookingServiceId('latest'),
    bookingMessages.invalidBookingServiceId,
  ],
  [
    'parseCategoryId',
    () => parseCategoryId('latest'),
    serviceCategoryMessages.invalidServiceCategoryId,
  ],
  [
    'parseChartCustomerId',
    () => parseChartCustomerId('latest'),
    customerMessages.invalidCustomerId,
  ],
  [
    'parseCustomerAllergyIds',
    () => parseCustomerAllergyIds('latest', 'latest'),
    customerAllergyMessages.invalidCustomerAllergyId,
  ],
  [
    'parseCustomerId',
    () => parseCustomerId('latest'),
    customerMessages.invalidCustomerId,
  ],
  [
    'parseInventoryId',
    () => parseInventoryId('latest'),
    inventoryMessages.invalidInventoryId,
  ],
  [
    'parseMedicalChartId',
    () => parseMedicalChartId('latest'),
    medicalChartMessages.invalidMedicalChartId,
  ],
  [
    'parsePaymentId',
    () => parsePaymentId('latest'),
    paymentMessages.invalidPaymentId,
  ],
  [
    'parsePaymentMethodId',
    () => parsePaymentMethodId('latest'),
    paymentMethodMessages.invalidPaymentMethodId,
  ],
  [
    'parseProductId',
    () => parseProductId('latest'),
    productMessages.invalidProductId,
  ],
  [
    'parsePurchaseOrderId',
    () => parsePurchaseOrderId('latest'),
    purchaseOrderMessages.invalidPurchaseOrderId,
  ],
  [
    'parseReviewId',
    () => parseReviewId('latest'),
    reviewMessages.invalidReviewId,
  ],
  [
    'parseReviewReportId',
    () => parseReviewReportId('latest'),
    reviewReportMessages.invalidReviewReportId,
  ],
  ['parseSaleId', () => parseSaleId('latest'), saleMessages.invalidSaleId],
  ['parseSalonId', () => parseSalonId('latest'), salonMessages.invalidSalonId],
  [
    'parseSalonIdOfPath',
    () => parseSalonIdOfPath('latest'),
    salonMessages.invalidSalonId,
  ],
  [
    'parseServiceId',
    () => parseServiceId('latest'),
    serviceMessages.invalidServiceId,
  ],
  [
    'parseSessionId',
    () => parseSessionId('latest'),
    authMessages.invalidSessionId,
  ],
  [
    'parseShareLinkId',
    () => parseShareLinkId('latest'),
    shareLinkMessages.invalidShareLinkId,
  ],
  ['parseStaffId', () => parseStaffId('latest'), staffMessages.invalidStaffId],
  [
    'parseStaffIdOfPath',
    () => parseStaffIdOfPath('latest'),
    staffMessages.invalidStaffId,
  ],
  [
    'parseTreatmentPhotoIds',
    () => parseTreatmentPhotoIds('latest', 'latest'),
    treatmentRecordMessages.invalidTreatmentPhotoId,
  ],
  [
    'parseTreatmentRecordId',
    () => parseTreatmentRecordId('latest'),
    treatmentRecordMessages.invalidTreatmentRecordId,
  ],
  ['parseUserId', () => parseUserId('latest'), authMessages.invalidUserId],
]

/** The functions of the models that read IDs. */
const parsersOfTheModels = (): string[] =>
  readdirSync(MODELS)
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) =>
      [
        ...readFileSync(join(MODELS, file), 'utf8').matchAll(
          /export const (parse\w+) = /g,
        ),
      ].map(([, name]) => name ?? ''),
    )

describe('the functions that read IDs', () => {
  it.each(PARSERS)(
    'should say which ID was wrong: %s',
    (_name, parse, message) => {
      // Act
      const parsed = parse()

      // Assert
      expect(parsed).toMatchObject({
        type: 'error',
        error: { type: 'validation', message },
      })
    },
  )

  it('should have a row in this test for every function of the models that reads IDs', () => {
    // Act
    const parsers = parsersOfTheModels()

    // Assert
    expect(PARSERS.map(([name]) => name).toSorted()).toEqual(parsers.toSorted())
  })
})
