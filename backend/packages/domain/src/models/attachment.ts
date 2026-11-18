import type { attachments } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import { type DeepRequired, Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const attachmentIdSchema = uuidSchema.brand<'AttachmentId'>()
export type AttachmentId = z.infer<typeof attachmentIdSchema>

const attachmentIdParameterSchema = z.object({
  attachmentId: attachmentIdSchema,
})

export const parseAttachmentId = (
  attachmentId: unknown,
): Result<AttachmentId, DomainError> =>
  Result.map(
    parseWith(
      attachmentIdParameterSchema,
      { attachmentId },
      'Invalid attachment ID',
    ),
    (parameters) => parameters.attachmentId,
  )

// API types, generated from TypeSpec
export type ApiAttachmentResponse =
  components['schemas']['Models.AttachmentResponse']
export type ApiAttachmentUploadUrlRequest =
  components['schemas']['Models.AttachmentUploadUrlRequest']
export type ApiAttachmentUploadUrlResponse =
  components['schemas']['Models.AttachmentUploadUrlResponse']
export type ApiAttachmentDownloadUrlResponse =
  components['schemas']['Models.AttachmentDownloadUrlResponse']
export type ApiAttachmentPurgeResponse =
  components['schemas']['Models.AttachmentPurgeResponse']
export type ApiAttachmentSearchRequest = NonNullable<
  operations['AttachmentCrud_list']['parameters']['query']
>
export type ApiAttachmentDownloadUrlRequest = NonNullable<
  operations['AttachmentCrud_getDownloadUrl']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbAttachment = DeepRequired<typeof attachments.$inferSelect>

/** The kinds of file an attachment can be. */
export type AttachmentContentType = DbAttachment['contentType']

/**
 * What is written when an upload is announced: what the request states of
 * the file, and who asks. The database assigns the rest.
 */
export type DbNewAttachment = DeepRequired<
  Pick<
    typeof attachments.$inferInsert,
    'salonId' | 'filename' | 'contentType' | 'size' | 'uploadedBy'
  >
>
