// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertToSingleFile } from './convertToSingleFile'
import { formatByteSize } from './formatByteSize'
import { getBaseFileSize } from './getBaseFileSize'
import { getFileName } from './getFileName'
import { isLowerMaximumFileSize } from './isLowerMaximumFileSize'
import { isRequiredFile } from './isRequiredFile'
import { isSingleFile } from './isSingleFile'
import { isUpperMaximumFileSize } from './isUpperMaximumFileSize'
import { isZeroSizeFile } from './isZeroSizeFile'
import { loadFileAsArrayBuffer } from './loadFileAsArrayBuffer'
import { toBase64 } from './toBase64'
import { toFiles } from './toFiles'

const createFile = (name: string, content = 'content'): File =>
  new File([content], name, { type: 'text/plain' })

/**
 * jsdom cannot construct a FileList, so this builds an object with the shape
 * and the prototype of one.
 */
const createFileList = (files: File[]): FileList => {
  const fileList: FileList = {
    ...files,
    length: files.length,
    item: (index) => files[index] ?? null,
    [Symbol.iterator]: () => files[Symbol.iterator](),
  }
  Object.setPrototypeOf(fileList, FileList.prototype)

  return fileList
}

class FailingFileReader {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  readAsArrayBuffer(): void {
    this.onerror?.()
  }

  readAsDataURL(): void {
    this.onerror?.()
  }
}

class EmptyResultFileReader {
  onload: ((event: { target: { result: null } }) => void) | null = null
  onerror: (() => void) | null = null

  readAsArrayBuffer(): void {
    this.onload?.({ target: { result: null } })
  }

  readAsDataURL(): void {
    this.onload?.({ target: { result: null } })
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('convertToSingleFile', () => {
  it.each([
    { label: 'null', input: null },
    { label: 'undefined', input: undefined },
    { label: 'an empty array', input: [] },
    { label: 'an empty FileList', input: createFileList([]) },
  ])('should return null for $label', ({ input }) => {
    // Act
    const result = convertToSingleFile(input)

    // Assert
    expect(result).toBeNull()
  })

  it('should return the first file of an array', () => {
    // Arrange
    const first = createFile('first.txt')
    const second = createFile('second.txt')

    // Act
    const result = convertToSingleFile([first, second])

    // Assert
    expect(result).toBe(first)
  })

  it('should return the first file of a FileList', () => {
    // Arrange
    const first = createFile('first.txt')
    const second = createFile('second.txt')

    // Act
    const result = convertToSingleFile(createFileList([first, second]))

    // Assert
    expect(result).toBe(first)
  })
})

describe('formatByteSize', () => {
  it.each([
    { bytes: 0, expected: '0 Bytes' },
    { bytes: 1, expected: '1 Bytes' },
    { bytes: 1023, expected: '1023 Bytes' },
    { bytes: 1024, expected: '1 KB' },
    { bytes: 1536, expected: '1.5 KB' },
    { bytes: 1024 ** 2, expected: '1 MB' },
    { bytes: 1234567, expected: '1.18 MB' },
    { bytes: 1024 ** 3, expected: '1 GB' },
    { bytes: 1024 ** 4, expected: '1 TB' },
    { bytes: 1024 ** 8, expected: '1 YB' },
  ])('should format $bytes bytes as $expected', ({ bytes, expected }) => {
    // Act
    const result = formatByteSize(bytes)

    // Assert
    expect(result).toBe(expected)
  })

  it.each([
    { decimals: 0, expected: '1 MB' },
    { decimals: 1, expected: '1.2 MB' },
    { decimals: 3, expected: '1.177 MB' },
    { decimals: -1, expected: '1 MB' },
  ])('should round to $decimals decimal places', ({ decimals, expected }) => {
    // Act
    const result = formatByteSize(1234567, decimals)

    // Assert
    expect(result).toBe(expected)
  })

  it('should keep the largest unit for sizes beyond its range', () => {
    // Act
    const result = formatByteSize(1024 ** 9)

    // Assert
    expect(result).toBe('1024 YB')
  })

  it('should keep the smallest unit for sizes below one byte', () => {
    // Act
    const result = formatByteSize(0.5)

    // Assert
    expect(result).toBe('0.5 Bytes')
  })

  it.each([
    { label: 'a negative size', bytes: -1024 },
    { label: 'NaN', bytes: Number.NaN },
  ])('should format $label as 0 Bytes', ({ bytes }) => {
    // Act
    const result = formatByteSize(bytes)

    // Assert
    expect(result).toBe('0 Bytes')
  })
})

describe('getBaseFileSize', () => {
  it('should return a numeric size unchanged', () => {
    // Act
    const result = getBaseFileSize(2048)

    // Assert
    expect(result).toBe(2048)
  })

  it.each([
    { size: '500', expected: 500 },
    { size: '500B', expected: 500 },
    { size: '1KB', expected: 1024 },
    { size: '1.5KB', expected: 1536 },
    { size: '10MB', expected: 10 * 1024 ** 2 },
    { size: '2GB', expected: 2 * 1024 ** 3 },
    { size: '1TB', expected: 1024 ** 4 },
  ])('should convert $size to $expected bytes', ({ size, expected }) => {
    // Act
    const result = getBaseFileSize(size)

    // Assert
    expect(result).toBe(expected)
  })

  it('should ignore case and whitespace', () => {
    // Act
    const result = getBaseFileSize(' 10 mb ')

    // Assert
    expect(result).toBe(10 * 1024 ** 2)
  })

  it('should round a fractional byte count down', () => {
    // Act
    const result = getBaseFileSize('1.0005KB')

    // Assert
    expect(result).toBe(1024)
  })

  it.each([
    { label: 'an empty string', size: '' },
    { label: 'text without a number', size: 'abc' },
    { label: 'a negative size', size: '-1KB' },
    { label: 'an unsupported unit', size: '1PB' },
    { label: 'a number with separators', size: '1,024' },
  ])('should return 0 for $label', ({ size }) => {
    // Act
    const result = getBaseFileSize(size)

    // Assert
    expect(result).toBe(0)
  })
})

describe('getFileName', () => {
  it('should return the name of a File', () => {
    // Arrange
    const file = createFile('report.pdf')

    // Act
    const result = getFileName(file)

    // Assert
    expect(result).toBe('report.pdf')
  })

  it.each([
    { path: 'report.pdf', expected: 'report.pdf' },
    { path: 'documents/2024/report.pdf', expected: 'report.pdf' },
    { path: 'C:\\Users\\salon\\report.pdf', expected: 'report.pdf' },
    { path: 'documents/2024/', expected: '' },
    { path: '', expected: '' },
  ])(
    'should extract "$expected" from the path "$path"',
    ({ path, expected }) => {
      // Act
      const result = getFileName(path)

      // Assert
      expect(result).toBe(expected)
    },
  )
})

describe('isLowerMaximumFileSize', () => {
  it.each([
    { label: 'a file smaller than the limit', maxSize: 8, expected: true },
    { label: 'a file exactly at the limit', maxSize: 7, expected: true },
    { label: 'a file larger than the limit', maxSize: 6, expected: false },
  ])('should return $expected for $label', ({ maxSize, expected }) => {
    // Arrange
    const file = createFile('seven-bytes.txt', '1234567')

    // Act
    const result = isLowerMaximumFileSize(file, maxSize)

    // Assert
    expect(result).toBe(expected)
  })

  it.each([
    { label: 'null', file: null },
    { label: 'undefined', file: undefined },
  ])('should accept $label because there is nothing to check', ({ file }) => {
    // Act
    const result = isLowerMaximumFileSize(file, 0)

    // Assert
    expect(result).toBe(true)
  })
})

describe('isUpperMaximumFileSize', () => {
  it.each([
    { label: 'a file smaller than the limit', maxSize: 8, expected: false },
    { label: 'a file exactly at the limit', maxSize: 7, expected: false },
    { label: 'a file larger than the limit', maxSize: 6, expected: true },
  ])('should return $expected for $label', ({ maxSize, expected }) => {
    // Arrange
    const file = createFile('seven-bytes.txt', '1234567')

    // Act
    const result = isUpperMaximumFileSize(file, maxSize)

    // Assert
    expect(result).toBe(expected)
  })

  it.each([
    { label: 'null', file: null },
    { label: 'undefined', file: undefined },
  ])('should return false for $label', ({ file }) => {
    // Act
    const result = isUpperMaximumFileSize(file, 0)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isRequiredFile', () => {
  it.each([
    { label: 'null', file: null },
    { label: 'an empty file', file: createFile('empty.txt', '') },
  ])('should accept $label when the file is optional', ({ file }) => {
    // Act
    const result = isRequiredFile(file, false)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a file with content', file: createFile('a.txt') },
    {
      label: 'a FileList whose first file has content',
      file: createFileList([createFile('a.txt')]),
    },
  ])('should accept $label when the file is required', ({ file }) => {
    // Act
    const result = isRequiredFile(file, true)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'null', file: null },
    { label: 'undefined', file: undefined },
    { label: 'an empty file', file: createFile('empty.txt', '') },
    { label: 'an empty FileList', file: createFileList([]) },
    {
      label: 'a FileList whose first file is empty',
      file: createFileList([createFile('empty.txt', ''), createFile('a.txt')]),
    },
  ])('should reject $label when the file is required', ({ file }) => {
    // Act
    const result = isRequiredFile(file, true)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isSingleFile', () => {
  it.each([
    { label: 'a File', files: createFile('a.txt') },
    { label: 'an array with one file', files: [createFile('a.txt')] },
    {
      label: 'a FileList with one file',
      files: createFileList([createFile('a.txt')]),
    },
  ])('should return true for $label', ({ files }) => {
    // Act
    const result = isSingleFile(files)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'null', files: null },
    { label: 'undefined', files: undefined },
    { label: 'an empty array', files: [] },
    {
      label: 'an array with two files',
      files: [createFile('a.txt'), createFile('b.txt')],
    },
    { label: 'an empty FileList', files: createFileList([]) },
    {
      label: 'a FileList with two files',
      files: createFileList([createFile('a.txt'), createFile('b.txt')]),
    },
  ])('should return false for $label', ({ files }) => {
    // Act
    const result = isSingleFile(files)

    // Assert
    expect(result).toBe(false)
  })
})

describe('isZeroSizeFile', () => {
  it('should return true for a file without content', () => {
    // Arrange
    const file = createFile('empty.txt', '')

    // Act
    const result = isZeroSizeFile(file)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a file with content', file: createFile('a.txt') },
    { label: 'null', file: null },
    { label: 'undefined', file: undefined },
  ])('should return false for $label', ({ file }) => {
    // Act
    const result = isZeroSizeFile(file)

    // Assert
    expect(result).toBe(false)
  })
})

describe('loadFileAsArrayBuffer', () => {
  it('should resolve with the bytes of the file', async () => {
    // Arrange
    const file = createFile('hello.txt', 'hello')

    // Act
    const result = await loadFileAsArrayBuffer(file)

    // Assert
    expect(Array.from(new Uint8Array(result))).toEqual([
      104, 101, 108, 108, 111,
    ])
  })

  it('should resolve with an empty buffer for an empty file', async () => {
    // Arrange
    const file = createFile('empty.txt', '')

    // Act
    const result = await loadFileAsArrayBuffer(file)

    // Assert
    expect(result.byteLength).toBe(0)
  })

  it('should reject when the file cannot be read', async () => {
    // Arrange
    vi.stubGlobal('FileReader', FailingFileReader)
    const file = createFile('broken.txt')

    // Act
    const result = loadFileAsArrayBuffer(file)

    // Assert
    await expect(result).rejects.toThrow('Error reading file')
  })

  it('should reject when the reader does not produce an ArrayBuffer', async () => {
    // Arrange
    vi.stubGlobal('FileReader', EmptyResultFileReader)
    const file = createFile('broken.txt')

    // Act
    const result = loadFileAsArrayBuffer(file)

    // Assert
    await expect(result).rejects.toThrow('Failed to read file as ArrayBuffer')
  })
})

describe('toBase64', () => {
  it('should resolve with a data URL for a File', async () => {
    // Arrange
    const file = createFile('hello.txt', 'hello')

    // Act
    const result = await toBase64(file)

    // Assert
    expect(result).toBe('data:text/plain;base64,aGVsbG8=')
  })

  it('should resolve with a data URL for a Blob', async () => {
    // Arrange
    const blob = new Blob(['{"id":1}'], { type: 'application/json' })

    // Act
    const result = await toBase64(blob)

    // Assert
    expect(result).toBe('data:application/json;base64,eyJpZCI6MX0=')
  })

  it('should reject when the file cannot be read', async () => {
    // Arrange
    vi.stubGlobal('FileReader', FailingFileReader)
    const file = createFile('broken.txt')

    // Act
    const result = toBase64(file)

    // Assert
    await expect(result).rejects.toThrow('Error reading file')
  })

  it('should reject when the reader does not produce a string', async () => {
    // Arrange
    vi.stubGlobal('FileReader', EmptyResultFileReader)
    const file = createFile('broken.txt')

    // Act
    const result = toBase64(file)

    // Assert
    await expect(result).rejects.toThrow('Failed to convert file to base64')
  })
})

describe('toFiles', () => {
  it.each([
    { label: 'null', input: null },
    { label: 'undefined', input: undefined },
    { label: 'an empty array', input: [] },
    { label: 'an empty FileList', input: createFileList([]) },
  ])('should return an empty array for $label', ({ input }) => {
    // Act
    const result = toFiles(input)

    // Assert
    expect(result).toEqual([])
  })

  it('should wrap a single File in an array', () => {
    // Arrange
    const file = createFile('a.txt')

    // Act
    const result = toFiles(file)

    // Assert
    expect(result).toEqual([file])
  })

  it('should convert a FileList to an array in the same order', () => {
    // Arrange
    const first = createFile('first.txt')
    const second = createFile('second.txt')

    // Act
    const result = toFiles(createFileList([first, second]))

    // Assert
    expect(Array.isArray(result)).toBe(true)
    expect(result.map((file) => file.name)).toEqual(['first.txt', 'second.txt'])
  })

  it('should return the files of an array in the same order', () => {
    // Arrange
    const first = createFile('first.txt')
    const second = createFile('second.txt')

    // Act
    const result = toFiles([first, second])

    // Assert
    expect(result.map((file) => file.name)).toEqual(['first.txt', 'second.txt'])
  })
})
