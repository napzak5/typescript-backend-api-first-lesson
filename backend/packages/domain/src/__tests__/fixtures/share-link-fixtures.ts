import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { ShareLinkUseCaseDependencies } from '../../business-logic/share-link'
import type { DbAttachment } from '../../models/attachment'
import type { ApiShareLinkResponse, DbShareLink } from '../../models/share-link'
import type { IAttachmentRepository } from '../../repositories/attachment.repository'
import type {
  IShareLinkRepository,
  SharedAttachment,
  ShareLinkList,
} from '../../repositories/share-link.repository'
import type { IFileStorage } from '../../services/file-storage'
import type { IPasswordHasher } from '../../services/password-hasher'
import {
  ATTACHMENT_ID,
  attachmentDependencies,
  dbAttachment,
  UPLOADED,
} from './attachment-fixtures'
import {
  authDependencies,
  fakePasswordHasher,
  NOW,
  USER_ID,
} from './auth-fixtures'

export const SHARE_LINK_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7b01'
export const OTHER_SHARE_LINK_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7b02'

/** The token the issuer of the fixtures issues first, and what is stored of it. */
export const TOKEN = 'token-1'
export const TOKEN_HASH = 'sha256(token-1)'

/** A password a link may have, and what the hasher of the fixtures stores of it. */
export const SHARE_PASSWORD = 'violet tram 42'
export const SHARE_PASSWORD_HASH = `hashed:${SHARE_PASSWORD}`

/**
 * A row of `share_links` as the driver returns it: a link created at `NOW`
 * of the fixtures that ends seven days later, without a password or a
 * limit of downloads.
 */
export const dbShareLink = (
  overrides: Partial<DbShareLink> = {},
): DbShareLink => ({
  id: SHARE_LINK_ID,
  attachmentId: ATTACHMENT_ID,
  tokenHash: TOKEN_HASH,
  passwordHash: null,
  expiresAt: '2026-11-21 18:00:00+09',
  maxDownloads: null,
  downloadCount: 0,
  failedAttempts: 0,
  lockedUntil: null,
  createdBy: USER_ID,
  createdAt: '2026-11-14 18:00:00+09',
  updatedAt: '2026-11-14 18:00:00.123456+09',
  ...overrides,
})

/** The row of `dbShareLink()` as the API presents it. */
export const apiShareLink = (
  overrides: Partial<ApiShareLinkResponse> = {},
): ApiShareLinkResponse => ({
  id: SHARE_LINK_ID,
  attachmentId: ATTACHMENT_ID,
  expiresAt: '2026-11-21T09:00:00.000Z',
  maxDownloads: null,
  downloadCount: 0,
  hasPassword: false,
  createdBy: USER_ID,
  createdAt: '2026-11-14T09:00:00.000Z',
  updatedAt: '2026-11-14T09:00:00.123Z',
  ...overrides,
})

/** The uploaded attachment the link of the fixtures shows. */
export const sharedAttachment = (): DbAttachment => dbAttachment(UPLOADED)

/**
 * A repository that holds the link above, which works, and in which every
 * write succeeds; a test overrides what it needs.
 */
const shareLinkRepositoryWith = (
  overrides: Partial<IShareLinkRepository> = {},
): IShareLinkRepository => ({
  create: vi.fn(async () => Result.success(dbShareLink())),
  findById: vi.fn(async () =>
    Result.success<DbShareLink | null>(dbShareLink()),
  ),
  list: vi.fn(async () =>
    Result.success<ShareLinkList | null>({
      shareLinks: [dbShareLink()],
      total: 1,
      hasMore: false,
    }),
  ),
  remove: vi.fn(async () => Result.success(true)),
  findWorking: vi.fn(async () =>
    Result.success<SharedAttachment | null>({
      shareLink: dbShareLink(),
      attachment: sharedAttachment(),
    }),
  ),
  recordWrongPassword: vi.fn(async () => Result.success(null)),
  recordRightPassword: vi.fn(async () => Result.success(null)),
  countDownload: vi.fn(async () => Result.success(true)),
  ...overrides,
})

/**
 * Everything the use cases of the share links need, at the moment `NOW`:
 * the attachment of the fixtures is uploaded, the storage signs every URL,
 * and the hashes can be read (`hashed:<password>`, `sha256(<token>)`).
 */
export const shareLinkDependencies = (
  parts: {
    shareLinks?: Partial<IShareLinkRepository>
    attachments?: Partial<IAttachmentRepository>
    storage?: Partial<IFileStorage>
    hasher?: Partial<IPasswordHasher>
  } = {},
): ShareLinkUseCaseDependencies => {
  const { attachmentRepository, fileStorage } = attachmentDependencies({
    attachments: {
      findById: vi.fn(async () =>
        Result.success<DbAttachment | null>(sharedAttachment()),
      ),
      ...parts.attachments,
    },
    ...(parts.storage === undefined ? {} : { storage: parts.storage }),
  })

  return {
    shareLinkRepository: shareLinkRepositoryWith(parts.shareLinks),
    attachmentRepository,
    fileStorage,
    passwordHasher: fakePasswordHasher(parts.hasher),
    tokenIssuer: authDependencies().tokenIssuer,
    clock: () => NOW,
  }
}
