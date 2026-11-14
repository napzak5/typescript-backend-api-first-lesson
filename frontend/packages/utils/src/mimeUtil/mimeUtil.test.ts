import { describe, expect, it } from 'vitest'
import { getMimeType, isAudioFile, isImageFile, isVideoFile } from './mimeUtil'

describe('getMimeType', () => {
  it.each([
    { filename: 'photo.png', expected: 'image/png' },
    { filename: 'photo.jpg', expected: 'image/jpeg' },
    { filename: 'movie.mp4', expected: 'video/mp4' },
    { filename: 'voice.mp3', expected: 'audio/mpeg' },
    { filename: 'menu.pdf', expected: 'application/pdf' },
    { filename: 'customers.csv', expected: 'text/csv' },
  ])('should resolve $filename to $expected', ({ filename, expected }) => {
    // Act
    const result = getMimeType(filename)

    // Assert
    expect(result).toBe(expected)
  })

  it('should ignore the case of the extension', () => {
    // Act
    const result = getMimeType('PHOTO.PNG')

    // Assert
    expect(result).toBe('image/png')
  })

  it('should use the last extension of a path', () => {
    // Act
    const result = getMimeType('uploads/2024.01/backup.tar.gz')

    // Assert
    expect(result).toBe('application/gzip')
  })

  it.each([
    { label: 'an unknown extension', filename: 'data.unknownext' },
    { label: 'a name that ends with a dot', filename: 'photo.' },
    { label: 'an empty string', filename: '' },
  ])('should return null for $label', ({ filename }) => {
    // Act
    const result = getMimeType(filename)

    // Assert
    expect(result).toBeNull()
  })
})

describe('isImageFile', () => {
  it.each([
    'photo.png',
    'photo.jpg',
    'photo.jpeg',
    'photo.gif',
    'photo.webp',
    'logo.svg',
  ])('should return true for %s', (filename) => {
    // Act
    const result = isImageFile(filename)

    // Assert
    expect(result).toBe(true)
  })

  it.each(['movie.mp4', 'voice.mp3', 'menu.pdf', 'data.unknownext', ''])(
    'should return false for "%s"',
    (filename) => {
      // Act
      const result = isImageFile(filename)

      // Assert
      expect(result).toBe(false)
    },
  )
})

describe('isVideoFile', () => {
  it.each(['movie.mp4', 'movie.webm', 'movie.mov'])(
    'should return true for %s',
    (filename) => {
      // Act
      const result = isVideoFile(filename)

      // Assert
      expect(result).toBe(true)
    },
  )

  it.each(['photo.png', 'voice.mp3', 'menu.pdf', 'data.unknownext', ''])(
    'should return false for "%s"',
    (filename) => {
      // Act
      const result = isVideoFile(filename)

      // Assert
      expect(result).toBe(false)
    },
  )
})

describe('isAudioFile', () => {
  it.each(['voice.mp3', 'voice.wav', 'voice.ogg', 'voice.m4a'])(
    'should return true for %s',
    (filename) => {
      // Act
      const result = isAudioFile(filename)

      // Assert
      expect(result).toBe(true)
    },
  )

  it.each(['photo.png', 'movie.mp4', 'menu.pdf', 'data.unknownext', ''])(
    'should return false for "%s"',
    (filename) => {
      // Act
      const result = isAudioFile(filename)

      // Assert
      expect(result).toBe(false)
    },
  )
})
