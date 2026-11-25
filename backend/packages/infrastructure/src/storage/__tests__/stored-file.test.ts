import { describe, expect, it } from 'vitest'
import { storedFileOf } from '../stored-file'

const PNG_SIGNATURE = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

/** A body that holds these bytes. */
const bodyOf = (bytes: Uint8Array) => ({
  transformToByteArray: async () => bytes,
})

describe('storedFileOf', () => {
  it('should take the size of the file from the range of an answer that holds a part of it', async () => {
    // Act
    const file = await storedFileOf({
      ContentRange: 'bytes 0-7/20480',
      ContentLength: 8,
      Body: bodyOf(PNG_SIGNATURE),
    })

    // Assert
    expect(file).toEqual({ size: 20_480, head: PNG_SIGNATURE })
  })

  it('should take the size of the file from the length of an answer that holds the whole of it', async () => {
    // Act
    const file = await storedFileOf({
      ContentLength: 8,
      Body: bodyOf(PNG_SIGNATURE),
    })

    // Assert
    expect(file).toEqual({ size: 8, head: PNG_SIGNATURE })
  })

  it('should take an answer that names no length and has no body for an empty file', async () => {
    // Act
    const file = await storedFileOf({})

    // Assert
    expect(file).toEqual({ size: 0, head: new Uint8Array() })
  })
})
