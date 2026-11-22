import type {
  ApiAttachmentDownloadUrlRequest,
  ApiAttachmentSearchRequest,
} from '@beauty-salon-backend/domain'
import type { operations } from '@beauty-salon-backend/generated'
import { attachmentMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import type { JsonBody } from '../../../shared/operation-types'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The attachment of a request to `/attachments/:attachmentId`. */
export type AttachmentParams = { attachmentId: string }

export type IssueAttachmentUploadUrlResponse = JsonBody<
  operations['AttachmentCrud_getUploadUrl']['responses'][201]['content']
>
export type CompleteAttachmentResponse = JsonBody<
  operations['AttachmentCrud_complete']['responses'][200]['content']
>
export type ListAttachmentsResponse = JsonBody<
  operations['AttachmentCrud_list']['responses'][200]['content']
>
export type GetAttachmentResponse = JsonBody<
  operations['AttachmentCrud_get']['responses'][200]['content']
>
export type IssueAttachmentDownloadUrlResponse = JsonBody<
  operations['AttachmentCrud_getDownloadUrl']['responses'][200]['content']
>
export type PurgeAttachmentsResponse = JsonBody<
  operations['AttachmentCrud_purge']['responses'][200]['content']
>

/**
 * Links of a single attachment; `collectionPath` is where the attachment
 * routes are mounted.
 */
export const attachmentLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

/** The parameter of the list of attachments that is not text, as its type. */
export const decodeAttachmentSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiAttachmentSearchRequest, 'limit'>>,
  attachmentMessages.invalidAttachmentSearch,
)

/** The parameter of a download that is not text, as its type. */
export const decodeAttachmentDownloadQuery = queryDecoder(
  z.looseObject({
    inline: booleanParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiAttachmentDownloadUrlRequest, 'inline'>>,
  attachmentMessages.invalidAttachmentDownload,
)
