import type { shareLinks } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import { type DeepRequired, Result } from '@beauty-salon-backend/utility'
import { shareLinkMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const shareLinkIdSchema = uuidSchema.brand<'ShareLinkId'>()
export type ShareLinkId = z.infer<typeof shareLinkIdSchema>

const shareLinkIdParameterSchema = z.object({
  shareLinkId: shareLinkIdSchema,
})

export const parseShareLinkId = (
  shareLinkId: unknown,
): Result<ShareLinkId, DomainError> =>
  Result.map(
    parseWith(
      shareLinkIdParameterSchema,
      { shareLinkId },
      shareLinkMessages.invalidShareLinkId,
    ),
    (parameters) => parameters.shareLinkId,
  )

// API types, generated from TypeSpec
export type ApiShareLinkResponse =
  components['schemas']['Models.ShareLinkResponse']
export type ApiShareLinkCreateRequest =
  components['schemas']['Models.ShareLinkCreateRequest']
export type ApiShareLinkCreateResponse =
  components['schemas']['Models.ShareLinkCreateResponse']
export type ApiShareLinkSearchRequest = NonNullable<
  operations['ShareLinkCrud_list']['parameters']['query']
>
export type ApiSharedFileResponse =
  components['schemas']['Models.SharedFileResponse']
export type ApiSharedFileGetRequest =
  components['schemas']['Models.SharedFileGetRequest']
export type ApiSharedFileDownloadUrlRequest =
  components['schemas']['Models.SharedFileDownloadUrlRequest']

// Database types, inferred from the Drizzle schema
export type DbShareLink = DeepRequired<typeof shareLinks.$inferSelect>

/**
 * What is written when a link is created. The times are those of the
 * moment the request was checked at, so that the link ends within the
 * limit of the moment it is created at; the database assigns the rest.
 */
export type DbNewShareLink = DeepRequired<
  Pick<
    typeof shareLinks.$inferInsert,
    | 'attachmentId'
    | 'tokenHash'
    | 'passwordHash'
    | 'expiresAt'
    | 'maxDownloads'
    | 'createdBy'
    | 'createdAt'
    | 'updatedAt'
  >
>
