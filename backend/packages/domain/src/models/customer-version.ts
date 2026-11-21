import type { customerVersions } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import type { DeepRequired } from '@beauty-salon-backend/utility'
import type { z } from 'zod'
import { uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const customerVersionIdSchema = uuidSchema.brand<'CustomerVersionId'>()
export type CustomerVersionId = z.infer<typeof customerVersionIdSchema>

// API types, generated from TypeSpec. A version is what the ledger wrote of
// a customer at one write: the history lists the versions, a version is
// read on its own.
export type ApiCustomerVersionResponse =
  components['schemas']['Models.CustomerVersionResponse']
export type ApiCustomerHistoryEntryResponse =
  components['schemas']['Models.CustomerHistoryEntryResponse']
export type ApiCustomerVersionChangeResponse =
  components['schemas']['Models.CustomerVersionChangeResponse']
export type ApiCustomerVersionSearchRequest = NonNullable<
  operations['CustomerCrud_getHistory']['parameters']['query']
>
export type ApiCustomerVersionPathParameters =
  operations['CustomerCrud_getVersion']['parameters']['path']

// Database types, inferred from the Drizzle schema
export type DbCustomerVersion = DeepRequired<
  typeof customerVersions.$inferSelect
>
