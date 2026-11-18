import type { IAttachmentRepository } from '../../../repositories/attachment.repository'
import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IFileStorage } from '../../../services/file-storage'

/** Everything the attachment use cases need from the outside. */
export interface AttachmentUseCaseDependencies {
  attachmentRepository: IAttachmentRepository
  /** Tells whether the salon a request names exists. */
  salonRepository: ISalonRepository
  /** Holds the files. */
  fileStorage: IFileStorage
  clock: () => Date
}
