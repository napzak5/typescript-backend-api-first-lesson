import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { AttachmentUseCaseDependencies } from '../../business-logic/attachment'
import type {
  ApiAttachmentResponse,
  DbAttachment,
} from '../../models/attachment'
import type {
  AttachmentList,
  AttachmentPurge,
  IAttachmentRepository,
} from '../../repositories/attachment.repository'
import type { ISalonRepository } from '../../repositories/salon.repository'
import type {
  IFileStorage,
  StoredFile,
  UploadTicket,
} from '../../services/file-storage'
import { NOW, USER_ID } from './auth-fixtures'
import { SALON_ID, salonRepositoryWith } from './fixtures'

export const ATTACHMENT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7a01'
export const OTHER_ATTACHMENT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7a02'

export const UPLOAD_URL = 'https://storage.salon.example/upload?signature=1'
export const DOWNLOAD_URL = 'https://storage.salon.example/download?signature=2'

/** How a PNG image begins. */
export const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** As many bytes as given that begin with those given. */
export const bytesOf = (begin: number[], length: number): Uint8Array => {
  const bytes = new Uint8Array(length).fill(7)
  bytes.set(begin.slice(0, length))
  return bytes
}

/** A row of `attachments` as the driver returns it: a pending PNG image of 64 bytes. */
export const dbAttachment = (
  overrides: Partial<DbAttachment> = {},
): DbAttachment => ({
  id: ATTACHMENT_ID,
  salonId: SALON_ID,
  filename: '施術前.png',
  contentType: 'image/png',
  size: 64,
  status: 'pending',
  uploadedBy: USER_ID,
  uploadExpiresAt: '2026-11-18 11:15:00.654321+09',
  uploadedAt: null,
  deletedAt: null,
  createdAt: '2026-11-18 11:00:00.654321+09',
  updatedAt: '2026-11-18 11:00:00.654321+09',
  ...overrides,
})

/** What makes the row above an uploaded one. */
export const UPLOADED: Partial<DbAttachment> = {
  status: 'uploaded',
  uploadedAt: '2026-11-18 11:05:00.123456+09',
  updatedAt: '2026-11-18 11:05:00.123457+09',
}

/** The row of `dbAttachment()` as the API presents it. */
export const apiAttachment = (
  overrides: Partial<ApiAttachmentResponse> = {},
): ApiAttachmentResponse => ({
  id: ATTACHMENT_ID,
  salonId: SALON_ID,
  filename: '施術前.png',
  contentType: 'image/png',
  size: 64,
  status: 'pending',
  uploadedBy: USER_ID,
  uploadExpiresAt: '2026-11-18T02:15:00.654Z',
  uploadedAt: null,
  createdAt: '2026-11-18T02:00:00.654Z',
  updatedAt: '2026-11-18T02:00:00.654Z',
  ...overrides,
})

/** The row of `dbAttachment(UPLOADED)` as the API presents it. */
export const apiUploadedAttachment = (): ApiAttachmentResponse =>
  apiAttachment({
    status: 'uploaded',
    uploadedAt: '2026-11-18T02:05:00.123Z',
    updatedAt: '2026-11-18T02:05:00.123Z',
  })

/**
 * A repository that holds the pending attachment above, in which every
 * write succeeds and nothing is to be purged; a test overrides what it
 * needs.
 */
const attachmentRepositoryWith = (
  overrides: Partial<IAttachmentRepository> = {},
): IAttachmentRepository => ({
  create: vi.fn(async () => Result.success(dbAttachment())),
  findById: vi.fn(async () =>
    Result.success<DbAttachment | null>(dbAttachment()),
  ),
  list: vi.fn(async () =>
    Result.success<AttachmentList | null>({
      attachments: [dbAttachment(UPLOADED)],
      total: 1,
      hasMore: false,
    }),
  ),
  markUploaded: vi.fn(async () =>
    Result.success<DbAttachment | null>(dbAttachment(UPLOADED)),
  ),
  markDeleted: vi.fn(async () => Result.success(true)),
  purgeable: vi.fn(async () => Result.success<string[]>([])),
  purge: vi.fn(async () => Result.success<AttachmentPurge>({ type: 'purged' })),
  ...overrides,
})

/**
 * A storage that holds the file of the attachment above as it was
 * announced, and in which every call succeeds; a test overrides what it
 * needs.
 */
const fileStorageWith = (
  overrides: Partial<IFileStorage> = {},
): IFileStorage => ({
  issueUpload: vi.fn(async () =>
    Result.success<UploadTicket>({
      url: UPLOAD_URL,
      headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
    }),
  ),
  inspect: vi.fn(async () =>
    Result.success<StoredFile | null>({ size: 64, head: bytesOf(PNG, 12) }),
  ),
  issueDownload: vi.fn(async () => Result.success(DOWNLOAD_URL)),
  remove: vi.fn(async () => Result.success(null)),
  ...overrides,
})

/** Everything the use cases of the attachments need, at the moment `NOW`. */
export const attachmentDependencies = (
  parts: {
    attachments?: Partial<IAttachmentRepository>
    storage?: Partial<IFileStorage>
    salons?: Partial<ISalonRepository>
  } = {},
): AttachmentUseCaseDependencies => ({
  attachmentRepository: attachmentRepositoryWith(parts.attachments),
  salonRepository: salonRepositoryWith(parts.salons),
  fileStorage: fileStorageWith(parts.storage),
  clock: () => NOW,
})
