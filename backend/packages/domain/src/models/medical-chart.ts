import type { medicalCharts } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import {
  customerMessages,
  medicalChartMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import { type CustomerId, customerIdSchema } from './customer'

// ID: a UUID that has been checked.
export const medicalChartIdSchema = uuidSchema.brand<'MedicalChartId'>()
export type MedicalChartId = z.infer<typeof medicalChartIdSchema>

const medicalChartIdParameterSchema = z.object({ id: medicalChartIdSchema })

export const parseMedicalChartId = (
  id: unknown,
): Result<MedicalChartId, DomainError> =>
  Result.map(
    parseWith(
      medicalChartIdParameterSchema,
      { id },
      medicalChartMessages.invalidMedicalChartId,
    ),
    (parameters) => parameters.id,
  )

const chartCustomerParameterSchema = z.object({ customerId: customerIdSchema })

/** The customer of a path whose chart is read, reported by its own name. */
export const parseChartCustomerId = (
  customerId: unknown,
): Result<CustomerId, DomainError> =>
  Result.map(
    parseWith(
      chartCustomerParameterSchema,
      { customerId },
      customerMessages.invalidCustomerId,
    ),
    (parameters) => parameters.customerId,
  )

// API types, generated from TypeSpec
export type ApiMedicalChartResponse =
  components['schemas']['Models.MedicalChartResponse']
export type ApiPreviousTreatment =
  components['schemas']['Models.PreviousTreatment']
export type ApiMedicalChartCreateRequest =
  components['schemas']['Models.MedicalChartCreateRequest']
export type ApiMedicalChartUpdateRequest =
  components['schemas']['Models.MedicalChartUpdateRequest']
export type ApiMedicalChartSearchRequest = NonNullable<
  operations['MedicalChartCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbMedicalChart = DeepRequired<typeof medicalCharts.$inferSelect>

/**
 * What a request writes of a chart: the database assigns the ID and the
 * times. The previous treatments are a jsonb column, written as the request
 * states them.
 */
export type DbNewMedicalChart = DeepRequired<
  Omit<
    typeof medicalCharts.$inferInsert,
    'id' | 'customerId' | 'previousTreatments' | 'createdAt' | 'updatedAt'
  >
> & {
  customerId: CustomerId
  previousTreatments: ApiPreviousTreatment[]
}

/** What an update can write of a chart: not its customer. */
export type DbMedicalChartChanges = Partial<
  Omit<DbNewMedicalChart, 'customerId'>
>
