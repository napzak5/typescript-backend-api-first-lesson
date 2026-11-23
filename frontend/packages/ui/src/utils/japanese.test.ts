import { languageStore } from '@beauty-salon-frontend/io'
import { afterEach, describe, expect, it } from 'vitest'
import {
  errorsInJapanese,
  inJapanese,
  inJapaneseIfAny,
  writtenInJapanese,
} from './japanese'

describe('inJapanese', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say a message in Japanese, whatever the language of the page is', () => {
    // Arrange
    languageStore.choose('en')

    // Act
    const said = inJapanese({ en: 'Close', ja: '閉じる' })

    // Assert
    expect(said).toBe('閉じる')
  })
})

describe('inJapaneseIfAny', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say a message in Japanese, whatever the language of the page is', () => {
    // Arrange
    languageStore.choose('en')

    // Act
    const said = inJapaneseIfAny({ en: 'Required', ja: '必須' })

    // Assert
    expect(said).toBe('必須')
  })

  it('should say nothing where there is no message', () => {
    // Act
    const said = inJapaneseIfAny(undefined)

    // Assert
    expect(said).toBeUndefined()
  })
})

describe('errorsInJapanese', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what is said at each control in Japanese, and nothing where nothing is said', () => {
    // Arrange
    languageStore.choose('en')

    // Act
    const said = errorsInJapanese({
      city: {
        en: 'Enter up to 3 characters.',
        ja: '3 文字以内で入力してください。',
      },
      building: undefined,
    })

    // Assert
    expect(said).toEqual({
      city: '3 文字以内で入力してください。',
      building: undefined,
    })
  })
})

describe('writtenInJapanese', () => {
  it('should make a message of a text that is written in Japanese alone: the same text in every language', () => {
    // Act
    const message = writtenInJapanese('3 件の予約があります')

    // Assert
    expect(message).toEqual({
      en: '3 件の予約があります',
      ja: '3 件の予約があります',
    })
  })
})
