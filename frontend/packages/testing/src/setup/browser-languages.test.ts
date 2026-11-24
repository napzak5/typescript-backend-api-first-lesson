import { describe, expect, it, vi } from 'vitest'
import { setBrowserLanguages } from './browser-languages'

// `setup.ts`, which this package names in its own `setupFiles`, has installed the languages

describe('the languages of the browser given to jsdom', () => {
  it('should be the Japanese of Japan', () => {
    // Act
    const languages = navigator.languages

    // Assert
    expect(languages).toEqual(['ja-JP'])
  })

  it('should be the languages a test sets, and tell the page that they changed', () => {
    // Arrange
    const onChange = vi.fn()
    window.addEventListener('languagechange', onChange)

    // Act
    setBrowserLanguages(['en-US', 'fr'])

    // Assert
    expect(navigator.languages).toEqual(['en-US', 'fr'])
    expect(onChange).toHaveBeenCalledTimes(1)
    window.removeEventListener('languagechange', onChange)
  })

  it('should give the next test the browser every test starts with', () => {
    // Assert: the test before set it to English and French
    expect(navigator.languages).toEqual(['ja-JP'])
  })
})
