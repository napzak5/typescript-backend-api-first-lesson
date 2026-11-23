import { languageStore } from '@beauty-salon-frontend/io'
import { changeInAnotherTab } from '@beauty-salon-frontend/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { keepLanguageOfTheDocument } from './page-language'

/** What a test started, to end after it. */
const kept: (() => void)[] = []

const keep = (): (() => void) => {
  const end = keepLanguageOfTheDocument()
  kept.push(end)

  return end
}

describe('keepLanguageOfTheDocument', () => {
  afterEach(() => {
    for (const end of kept.splice(0)) {
      end()
    }
    localStorage.clear()
    document.documentElement.removeAttribute('lang')
  })

  it('should say Japanese for a page whose visitor chose no language', () => {
    // Act
    keep()

    // Assert
    expect(document.documentElement).toHaveAttribute('lang', 'ja')
  })

  it('should say the language that was chosen before the page was opened, whatever the document said', () => {
    // Arrange
    document.documentElement.lang = 'ja'
    languageStore.choose('en')

    // Act
    keep()

    // Assert
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })

  it('should say another language as soon as it is chosen, and the first again when that is', () => {
    // Arrange
    keep()

    // Act
    languageStore.choose('en')
    const afterEnglish = document.documentElement.lang
    languageStore.choose('ja')
    const afterJapanese = document.documentElement.lang

    // Assert
    expect(afterEnglish).toBe('en')
    expect(afterJapanese).toBe('ja')
  })

  it('should say the language that another tab chose', () => {
    // Arrange
    keep()

    // Act
    changeInAnotherTab('beauty-salon:language', 'en')

    // Assert
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })

  it('should leave the document as it is once it was ended', () => {
    // Arrange
    languageStore.choose('en')
    const end = keep()

    // Act
    end()
    languageStore.choose('ja')

    // Assert
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })
})
