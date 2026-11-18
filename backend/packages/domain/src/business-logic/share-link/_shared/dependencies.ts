import type { IAttachmentRepository } from '../../../repositories/attachment.repository'
import type { IShareLinkRepository } from '../../../repositories/share-link.repository'
import type { IFileStorage } from '../../../services/file-storage'
import type { IPasswordHasher } from '../../../services/password-hasher'
import type { ITokenIssuer } from '../../../services/token-issuer'

/** Everything the share link use cases need from the outside. */
export interface ShareLinkUseCaseDependencies {
  shareLinkRepository: IShareLinkRepository
  /** Tells whether the attachment a request names is one its actor reaches. */
  attachmentRepository: IAttachmentRepository
  /** Signs the URL that downloads a shared file. */
  fileStorage: IFileStorage
  /** Hashes the password of a link, as the password of an account is. */
  passwordHasher: IPasswordHasher
  /** Makes the token of a link, and the hash it is stored and found by. */
  tokenIssuer: ITokenIssuer
  clock: () => Date
}
