import {
  type DomainError,
  DomainErrors,
  type FileDownload,
  type FileUpload,
  type IFileStorage,
  type StoredFile,
  type UploadTicket,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'

/** Where the URLs of the storage of the tests point. */
export const STORAGE_URL = 'https://storage.salon.example'

type Call = 'issueUpload' | 'inspect' | 'issueDownload' | 'remove'

/**
 * A file storage that keeps its files in memory. What a client does with
 * an upload URL at the real storage, a test does by `files.set`: the API
 * sees nothing of that transfer either. A test makes a call fail with
 * `failing`, and holds a removal with `beforeRemove`.
 */
export class InMemoryFileStorage implements IFileStorage {
  /** The files stored, by their key. */
  readonly files = new Map<string, Uint8Array>()
  /** Every upload a URL was issued for, in the order of the calls. */
  readonly uploads: { file: FileUpload; expiresAt: Date }[] = []
  /** Every download a URL was issued for, in the order of the calls. */
  readonly downloads: { file: FileDownload; expiresAt: Date }[] = []
  /** Every call that was made, in order: its name and the key of its file. */
  readonly calls: string[] = []
  /** The calls that fail as those to a storage that is down do. */
  readonly failing = new Set<Call>()
  /** Awaited before a file is removed. */
  beforeRemove: (key: string) => Promise<void> = async () => {}

  private begin(call: Call, key: string): Result<null, DomainError> {
    this.calls.push(`${call} ${key}`)

    return this.failing.has(call)
      ? Result.error(
          DomainErrors.storage(`The storage of the tests fails to ${call}`, {
            name: 'Down',
          }),
        )
      : Result.success(null)
  }

  async issueUpload(
    file: FileUpload,
    expiresAt: Date,
  ): Promise<Result<UploadTicket, DomainError>> {
    return Result.map(this.begin('issueUpload', file.key), () => {
      this.uploads.push({ file, expiresAt })

      return {
        url: `${STORAGE_URL}/${file.key}?upload-until=${expiresAt.toISOString()}`,
        headers: { 'Content-Type': file.contentType, 'If-None-Match': '*' },
      }
    })
  }

  async inspect(
    key: string,
    leadingBytes: number,
  ): Promise<Result<StoredFile | null, DomainError>> {
    return Result.map(this.begin('inspect', key), () => {
      const bytes = this.files.get(key)

      return bytes === undefined
        ? null
        : { size: bytes.length, head: bytes.subarray(0, leadingBytes) }
    })
  }

  async issueDownload(
    file: FileDownload,
    expiresAt: Date,
  ): Promise<Result<string, DomainError>> {
    return Result.map(this.begin('issueDownload', file.key), () => {
      this.downloads.push({ file, expiresAt })

      return `${STORAGE_URL}/${file.key}?download-until=${expiresAt.toISOString()}`
    })
  }

  async remove(key: string): Promise<Result<null, DomainError>> {
    const begun = this.begin('remove', key)
    if (begun.type === 'error') {
      return begun
    }
    await this.beforeRemove(key)
    this.files.delete(key)

    return Result.success(null)
  }
}
