import type {
  ApiAttachmentDownloadUrlRequest,
  DbNewAttachment,
} from '../../models/attachment'
import type { UserId } from '../../models/auth'
import type { LedgerReach } from '../../models/booking'
import type { SalonId } from '../../models/salon'
import type { AttachmentListCriteria } from '../../repositories/attachment.repository'
import type {
  AttachmentSearchRequest,
  AttachmentUploadUrlRequest,
} from '../../schemas/attachment.schema'
import { toPaging } from './page'

/**
 * API request → what an attachment is written and read with. Property
 * names are the column names and nothing is converted.
 */
export const AttachmentWriteMapper = {
  /**
   * The pending attachment of the file a client is about to upload: what
   * the request states of the file, and who asks. The salon stays the ID
   * of a salon, for the use case asks whether there is one.
   */
  fromUploadUrlRequest(
    request: AttachmentUploadUrlRequest,
    uploadedBy: UserId,
  ): DbNewAttachment & { salonId: SalonId | null } {
    return {
      salonId: request.salonId,
      filename: request.filename,
      contentType: request.contentType,
      size: request.size,
      uploadedBy,
    }
  },

  /**
   * The attachments the reader reaches (`reach`); a salon the request does
   * not name does not restrict the list.
   */
  fromSearchRequest(
    request: AttachmentSearchRequest,
    reach: LedgerReach,
  ): AttachmentListCriteria {
    return { reach, ...toPaging(request), salonId: request.salonId ?? null }
  },

  /**
   * Whether the file is shown in the browser: it is saved under its name
   * unless the request asks for that.
   */
  fromDownloadUrlRequest(request: ApiAttachmentDownloadUrlRequest): {
    inline: boolean
  } {
    return { inline: request.inline ?? false }
  },
}
