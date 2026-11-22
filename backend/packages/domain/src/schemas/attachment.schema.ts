import { AttachmentContentTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import {
  hasExtensionOf,
  isRefusedInFilename,
  MOST_FILE_SIZE,
} from '../business-logic/attachment/_shared/file-rules'
import {
  type ApiAttachmentDownloadUrlRequest,
  type ApiAttachmentSearchRequest,
  type ApiAttachmentUploadUrlRequest,
  type AttachmentContentType,
  attachmentIdSchema,
} from '../models/attachment'
import { salonIdSchema } from '../models/salon'

/**
 * Validation of the requests of the attachments. The limits are those of
 * the database columns and of its CHECK constraints; the kinds of file and
 * the endings of their names are business rules.
 */

/** The most a file name holds, as the column allows. */
const MOST_FILENAME_LENGTH = 255

/**
 * A file name is a name and no path. It is never used as one: the file is
 * stored under a key of the server's, and the name comes back only as the
 * name a download is saved under.
 */
const namesNoPath = (context: z.core.ParsePayload<string>): void => {
  if ([...context.value].some(isRefusedInFilename)) {
    context.issues.push({
      code: 'custom',
      path: [],
      message: 'Must not contain a control character, / or \\',
      input: context.value,
    })
  }
}

const NAME_AND_KIND: PropertyKey[] = ['filename', 'contentType']

/**
 * The name ends as a file of the stated kind does. A name or a kind that
 * is refused for what it is has been reported, and the two are compared
 * only when neither is.
 */
const namedAsItsKind = (
  context: z.core.ParsePayload<{
    filename: string
    contentType: AttachmentContentType
  }>,
): void => {
  const oneIsRefused = context.issues.some(({ path }) =>
    NAME_AND_KIND.includes(path?.[0] ?? ''),
  )
  const { filename, contentType } = context.value
  if (oneIsRefused || hasExtensionOf(contentType, filename)) {
    return
  }
  context.issues.push({
    code: 'custom',
    path: ['filename'],
    message: `Must end as a file of the type ${contentType} does`,
    input: filename,
  })
}

/** What a client states of the file it is about to upload. */
export const attachmentUploadUrlRequestSchema = z
  .strictObject({
    filename: z.string().min(1).max(MOST_FILENAME_LENGTH).check(namesNoPath),
    contentType: AttachmentContentTypeSchema,
    size: z.number().int().min(1).max(MOST_FILE_SIZE),
    salonId: salonIdSchema.nullable(),
  })
  .check(namedAsItsKind) satisfies z.ZodType<ApiAttachmentUploadUrlRequest>

export const attachmentSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: attachmentIdSchema.exactOptional(),
  salonId: salonIdSchema.exactOptional(),
}) satisfies z.ZodType<ApiAttachmentSearchRequest>

export const attachmentDownloadUrlRequestSchema = z.strictObject({
  inline: z.boolean().exactOptional(),
}) satisfies z.ZodType<ApiAttachmentDownloadUrlRequest>

/** The requests that were checked: the IDs they name are IDs of what they name. */
export type AttachmentUploadUrlRequest = z.infer<
  typeof attachmentUploadUrlRequestSchema
>
export type AttachmentSearchRequest = z.infer<
  typeof attachmentSearchRequestSchema
>
