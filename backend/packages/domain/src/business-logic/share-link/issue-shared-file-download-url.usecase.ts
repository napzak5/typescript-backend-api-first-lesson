import { Result } from '@beauty-salon-backend/utility'
import { addMinutes, min, parseISO } from 'date-fns'
import { AttachmentReadMapper } from '../../mappers/read/attachment.mapper'
import { ShareLinkWriteMapper } from '../../mappers/write/share-link.mapper'
import type { ApiAttachmentDownloadUrlResponse } from '../../models/attachment'
import { sharedFileDownloadUrlRequestSchema } from '../../schemas/share-link.schema'
import { type DomainError, parseWith } from '../../shared'
import {
  contentDispositionOf,
  DOWNLOAD_URL_MINUTES,
  storageKeyOf,
} from '../attachment/_shared/file-rules'
import type { ShareLinkUseCaseDependencies } from './_shared/dependencies'
import { noSharedFile } from './_shared/link-rules'
import { openSharedFile } from './_shared/open-shared-file'

export class IssueSharedFileDownloadUrlUseCase {
  constructor(private readonly dependencies: ShareLinkUseCaseDependencies) {}

  /**
   * Issues a viewer a URL that downloads the file of a link, as the
   * members of the salon are issued one, and counts it as a download of
   * the link. The URL works for a short while and no longer than the link
   * does.
   *
   * The URL is signed before the download is counted, so that one that
   * cannot be signed costs the link nothing. Counting decides: when the
   * link stopped working meanwhile, or requests at the same moment took
   * the downloads it had left, the URL is not answered.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiAttachmentDownloadUrlResponse, DomainError>> {
    const request = parseWith(
      sharedFileDownloadUrlRequestSchema,
      input,
      'Invalid shared file download',
    )
    if (request.type === 'error') {
      return request
    }

    const { inline, ...credentials } =
      ShareLinkWriteMapper.fromSharedFileDownloadUrlRequest(request.data)

    const { shareLinkRepository, fileStorage, clock } = this.dependencies
    const now = clock()
    const opened = await openSharedFile(this.dependencies, credentials, now)
    if (opened.type === 'error') {
      return opened
    }
    const { shareLink, attachment } = opened.data

    const expiresAt = min([
      addMinutes(now, DOWNLOAD_URL_MINUTES),
      parseISO(shareLink.expiresAt),
    ])
    const issued = await fileStorage.issueDownload(
      {
        key: storageKeyOf(attachment.id),
        contentType: attachment.contentType,
        contentDisposition: contentDispositionOf(attachment.filename, inline),
      },
      expiresAt,
    )
    if (issued.type === 'error') {
      return issued
    }
    const counted = await shareLinkRepository.countDownload(shareLink.id, now)
    if (counted.type === 'error') {
      return counted
    }
    if (!counted.data) {
      return Result.error(noSharedFile)
    }

    return Result.success(
      AttachmentReadMapper.toApiDownloadUrl(issued.data, expiresAt),
    )
  }
}
