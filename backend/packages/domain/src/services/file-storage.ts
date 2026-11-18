import type { Result } from '@beauty-salon-backend/utility'
import type { DomainError } from '../shared'

/** A file that a client is to upload: where it goes and what it must be. */
export type FileUpload = {
  key: string
  contentType: string
  /** In bytes. */
  size: number
}

/** Where a client sends a file, and the headers its request must carry. */
export type UploadTicket = {
  url: string
  headers: Record<string, string>
}

/** What is stored under a key: its size in bytes and its first bytes. */
export type StoredFile = {
  size: number
  head: Uint8Array
}

/** A stored file, and how the URL that downloads it answers. */
export type FileDownload = {
  key: string
  contentType: string
  contentDisposition: string
}

/**
 * The object storage that holds the files of the attachments. The server
 * never carries a file: a client sends and fetches it itself, with a URL
 * that is signed for that one file and runs out.
 *
 * A call that fails resolves to a `storage` error.
 */
export interface IFileStorage {
  /**
   * A URL that takes one upload of exactly this type and size under the
   * key, at least until the moment given and no more than seconds longer.
   * While something is stored under the key, the URL takes nothing more.
   */
  issueUpload(
    file: FileUpload,
    expiresAt: Date,
  ): Promise<Result<UploadTicket, DomainError>>

  /**
   * The size of what is stored under a key and its first bytes, at most as
   * many as asked for; null when nothing is stored.
   */
  inspect(
    key: string,
    leadingBytes: number,
  ): Promise<Result<StoredFile | null, DomainError>>

  /**
   * A URL that answers what is stored under the key, at least until the
   * moment given and no more than seconds longer. Whether anything is
   * stored is not looked at.
   */
  issueDownload(
    file: FileDownload,
    expiresAt: Date,
  ): Promise<Result<string, DomainError>>

  /** Removes what is stored under a key. Nothing stored is not a failure. */
  remove(key: string): Promise<Result<null, DomainError>>
}
