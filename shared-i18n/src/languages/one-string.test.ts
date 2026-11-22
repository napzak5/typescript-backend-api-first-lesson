import { describe, expect, it } from 'vitest'
import { LOCALES } from './locale'
import { text } from './localized-text'
import { asOneString, textOfOneString } from './one-string'

describe('asOneString', () => {
  it('should hold the text of every language', () => {
    // Arrange
    const written = text({
      en: 'Must not be blank',
      ja: '空白だけにはできません',
    })

    // Act
    const string = asOneString(written)

    // Assert
    expect(LOCALES.map((locale) => string.includes(written[locale]))).toEqual(
      LOCALES.map(() => true),
    )
  })

  it.each<[string, string, string]>([
    ['sentences', 'Must not be blank', '空白だけにはできません'],
    [
      'a sentence with a comma and a colon',
      'Too big: 1, 2',
      '大きすぎます: 1、2',
    ],
    ['an empty sentence', '', ''],
    ['the same sentence twice', 'UUID', 'UUID'],
  ])('should be read back as it was written, for %s', (_what, en, ja) => {
    // Arrange
    const written = text({ en, ja })

    // Act
    const read = textOfOneString(asOneString(written))

    // Assert
    expect(read).toEqual(written)
  })

  it('should tell the separator that a value brought into a sentence as a space', () => {
    // Arrange
    const value = 'Mon\u001fday'
    const written = text({
      en: `Must be ${value}`,
      ja: `${value} にしてください`,
    })

    // Act
    const read = textOfOneString(asOneString(written))

    // Assert
    expect(read).toEqual({
      en: 'Must be Mon day',
      ja: 'Mon day にしてください',
    })
  })
})

describe('textOfOneString', () => {
  it.each<[string, string]>([
    [
      'a sentence in one language',
      'Invalid input: expected string, received number',
    ],
    ['an empty string', ''],
    ['a string with the separator twice', 'one\u001ftwo\u001fthree'],
  ])('should read nothing from %s', (_what, string) => {
    // Act
    const read = textOfOneString(string)

    // Assert
    expect(read).toBeUndefined()
  })
})
