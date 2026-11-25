import type { StoredFile } from '@beauty-salon-backend/domain'

/** What the storage answered a read of the leading bytes of a file with. */
type RangeAnswer = {
  /** `bytes <first>-<last>/<size>`: the part of the file the answer holds. */
  ContentRange?: string | undefined
  ContentLength?: number | undefined
  Body?: { transformToByteArray(): Promise<Uint8Array> } | undefined
}

/**
 * The size of a file and its leading bytes, from the answer to a read of
 * them. The size is the one the range of the answer names. A storage may
 * ignore the range and answer with the whole file (RFC 9110, 14.2): the
 * size is then the length of the answer. An answer that names neither
 * says that the file is empty, and one without a body holds no byte.
 */
export const storedFileOf = async ({
  ContentRange,
  ContentLength,
  Body,
}: RangeAnswer): Promise<StoredFile> => {
  const total = ContentRange?.match(/\/(\d+)$/)?.[1]

  return {
    size: total === undefined ? (ContentLength ?? 0) : Number(total),
    head: (await Body?.transformToByteArray()) ?? new Uint8Array(),
  }
}
