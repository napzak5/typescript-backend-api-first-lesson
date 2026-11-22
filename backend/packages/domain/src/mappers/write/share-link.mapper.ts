import type { SharedFileCredentials } from '../../business-logic/share-link/_shared/open-shared-file'
import type { AttachmentId } from '../../models/attachment'
import type {
  ApiSharedFileDownloadUrlRequest,
  ApiSharedFileGetRequest,
  ApiShareLinkCreateRequest,
} from '../../models/share-link'
import type { ShareLinkListCriteria } from '../../repositories/share-link.repository'
import type { ShareLinkSearchRequest } from '../../schemas/share-link.schema'
import { toPaging } from './page'

/**
 * API request → what the use cases of a share link work with. Nothing is
 * converted. Neither a token nor a password is kept as it is presented:
 * the use case finds a link by the hash of its token, and stores and
 * compares the hash of its password.
 */
export const ShareLinkWriteMapper = {
  /** When a new link ends, how often it downloads, and the password that opens it. */
  fromCreateRequest(request: ApiShareLinkCreateRequest): {
    expiresAt: string
    maxDownloads: number | null
    password: string | null
  } {
    return {
      expiresAt: request.expiresAt,
      maxDownloads: request.maxDownloads,
      password: request.password,
    }
  },

  /** The links of the attachment of the path. */
  fromSearchRequest(
    request: ShareLinkSearchRequest,
    attachmentId: AttachmentId,
  ): ShareLinkListCriteria {
    return { attachmentId, ...toPaging(request) }
  },

  /** What a viewer presents to be told what the file is. */
  fromSharedFileGetRequest(
    request: ApiSharedFileGetRequest,
  ): SharedFileCredentials {
    return { token: request.token, password: request.password }
  },

  /** What a viewer presents to download the file, and whether it is shown in the browser. */
  fromSharedFileDownloadUrlRequest(
    request: ApiSharedFileDownloadUrlRequest,
  ): SharedFileCredentials & { inline: boolean } {
    return {
      token: request.token,
      password: request.password,
      inline: request.inline,
    }
  },
}
