import { languageStore } from '@beauty-salon-frontend/io'
import { afterEach, describe, expect, it } from 'vitest'
import { inJapanese, writtenInJapanese } from './japanese'

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
