import { describe, expect, it } from 'vitest'
import { PDF_BYTES, PDF_TEXT, PNG_BYTES } from './file-bytes'

describe('the files a test sends', () => {
  it('should begin a PNG image with the signature of the format and the header of the image', () => {
    // Act
    const start = Array.from(PNG_BYTES.subarray(0, 16))

    // Assert
    expect(start).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ])
  })

  it('should write a PDF with its header and its end, and hold the same as bytes', () => {
    // Assert
    expect(PDF_TEXT.startsWith('%PDF-1.7\n')).toBe(true)
    expect(PDF_TEXT.endsWith('%%EOF\n')).toBe(true)
    expect(new TextDecoder().decode(PDF_BYTES)).toBe(PDF_TEXT)
  })
})
