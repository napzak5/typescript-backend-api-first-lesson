import type { ApiShareLinkSearchRequest } from '@beauty-salon-backend/domain'
import type { operations } from '@beauty-salon-backend/generated'
import { shareLinkMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import type { JsonBody } from '../../../shared/operation-types'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The attachment of a request to `/attachments/:attachmentId/share-links`. */
export type SharedAttachmentParams = { attachmentId: string }

/** The share link of a request to `/attachments/share-links/:shareLinkId`. */
export type ShareLinkParams = { shareLinkId: string }

export type CreateShareLinkResponse = JsonBody<
  operations['ShareLinkCrud_create']['responses'][201]['content']
>
export type ListShareLinksResponse = JsonBody<
  operations['ShareLinkCrud_list']['responses'][200]['content']
>
export type GetShareLinkResponse = JsonBody<
  operations['ShareLinkCrud_get']['responses'][200]['content']
>

/**
 * Links of a single share link; `attachmentsPath` is where the attachment
 * routes are mounted, which the routes of the share links are below.
 */
export const shareLinkLinks = (
  attachmentsPath: string,
  { id, attachmentId }: { id: string; attachmentId: string },
): { self: string; list: string; attachment: string } => ({
  self: `${attachmentsPath}/share-links/${id}`,
  list: `${attachmentsPath}/${attachmentId}/share-links`,
  attachment: `${attachmentsPath}/${attachmentId}`,
})

/** The parameter of the list of share links that is not text, as its type. */
export const decodeShareLinkSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiShareLinkSearchRequest, 'limit'>>,
  shareLinkMessages.invalidShareLinkSearch,
)
