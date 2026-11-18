import { match } from 'ts-pattern'
import type {
  AttachmentContentType,
  DbAttachment,
} from '../../../models/attachment'

/**
 * What a file must be to become an attachment, and how long the ways to
 * it stay open. The kinds are the photos of a treatment and the documents
 * a salon keeps; nothing a browser would run is among them.
 */

/** The most a file holds: 10 MiB. The column has the same limit. */
export const MOST_FILE_SIZE = 10 * 1024 * 1024

/** How long the URL that takes the upload works. */
export const UPLOAD_URL_MINUTES = 15

/** How long a URL that downloads the file works. */
export const DOWNLOAD_URL_MINUTES = 5

/**
 * How long after its upload URL ran out an upload can still be completed.
 * After that, an attachment that is still pending is purged.
 */
export const PENDING_KEPT_HOURS = 24

/** The endings a file name of a kind has, in lower case. */
export const extensionsOf = (contentType: AttachmentContentType): string[] =>
  match(contentType)
    .with('image/jpeg', () => ['.jpg', '.jpeg'])
    .with('image/png', () => ['.png'])
    .with('image/webp', () => ['.webp'])
    .with('application/pdf', () => ['.pdf'])
    .exhaustive()

/**
 * Whether a file name ends as its kind does, in whatever case, after at
 * least one more character.
 */
export const hasExtensionOf = (
  contentType: AttachmentContentType,
  filename: string,
): boolean => {
  const name = filename.toLowerCase()

  return extensionsOf(contentType).some(
    (extension) => name.length > extension.length && name.endsWith(extension),
  )
}

/**
 * Whether a character must not be part of a file name: a control character
 * (C0, DEL, C1), or one that separates the parts of a path.
 */
export const isRefusedInFilename = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0

  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    character === '/' ||
    character === '\\'
  )
}

/**
 * Where the file of an attachment is stored. The server decides it, and
 * nothing a user wrote is part of it.
 */
export const storageKeyOf = (id: DbAttachment['id']): string =>
  `attachments/${id}`

/** As many of the first bytes of a file as a signature takes at most. */
export const SIGNATURE_LENGTH = 12

const JPEG = [0xff, 0xd8, 0xff]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP = [0x57, 0x45, 0x42, 0x50]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]

const holds = (head: Uint8Array, signature: number[], offset: number) =>
  signature.every((byte, index) => head[offset + index] === byte)

/**
 * Whether a file begins as a file of its kind does. The kind a client
 * states is its word alone, and so is the type the storage holds, which
 * the client sent as well: the first bytes are what the file itself says.
 * A WebP file is a RIFF container whose form is WEBP, after the four bytes
 * of its length.
 */
export const beginsAs = (
  contentType: AttachmentContentType,
  head: Uint8Array,
): boolean =>
  match(contentType)
    .with('image/jpeg', () => holds(head, JPEG, 0))
    .with('image/png', () => holds(head, PNG, 0))
    .with('image/webp', () => holds(head, RIFF, 0) && holds(head, WEBP, 8))
    .with('application/pdf', () => holds(head, PDF, 0))
    .exhaustive()

const isPlain = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0

  return (
    code >= 0x20 &&
    code <= 0x7e &&
    character !== '"' &&
    character !== '\\' &&
    character !== '%'
  )
}

/** What `encodeURIComponent` leaves and RFC 8187 does not allow as it is. */
const LEFT_UNENCODED = /['()*]/g

const percentEncoded = (character: string): string =>
  `%${(character.codePointAt(0) ?? 0).toString(16).toUpperCase()}`

/**
 * The `Content-Disposition` a download of the file is answered with (RFC
 * 6266): shown in the browser or saved, under the name it was uploaded
 * with. The name is given twice: in ASCII for a client that knows nothing
 * else, with `_` for every other character, and in UTF-8 as RFC 8187
 * writes it.
 */
export const contentDispositionOf = (
  filename: string,
  inline: boolean,
): string => {
  const kind = inline ? 'inline' : 'attachment'
  const plain = [...filename]
    .map((character) => (isPlain(character) ? character : '_'))
    .join('')
  // A lone surrogate cannot be encoded: it is replaced first.
  const encoded = encodeURIComponent(filename.toWellFormed()).replace(
    LEFT_UNENCODED,
    percentEncoded,
  )

  return `${kind}; filename="${plain}"; filename*=UTF-8''${encoded}`
}
