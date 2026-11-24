import {
  changeInAnotherTab,
  refuseStorage,
  setBrowserLanguages,
} from '@beauty-salon-frontend/testing'
import type { Locale } from '@beauty-salon-shared/i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sessionStore } from '../session/stored-session'
import { languageStore } from './stored-language'

const STORAGE_KEY = 'beauty-salon:language'

/**
 * The store as the page loads it: a choice that the browser would not keep
 * stays with the module, until the page is loaded again
 */
const loadedAnew = async (): Promise<typeof languageStore> => {
  vi.resetModules()
  const loaded = await import('./stored-language')

  return loaded.languageStore
}

describe('languageStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say Japanese before a language is chosen, in a browser that is set to Japanese', () => {
    // Act
    const language = languageStore.read()

    // Assert
    expect(language).toBe('ja')
  })

  it.each<[string, readonly string[], Locale]>([
    ['English', ['en-US'], 'en'],
    [
      'English after a language the product is not written in',
      ['fr-FR', 'en-GB'],
      'en',
    ],
    ['Japanese before English', ['ja', 'en-US'], 'ja'],
    ['a language the product is not written in', ['fr-FR'], 'ja'],
    ['no language', [], 'ja'],
  ])(
    'should say the language of a browser that is set to %s before a language is chosen (%j)',
    (_case, languages, expected) => {
      // Arrange
      setBrowserLanguages(languages)

      // Act
      const language = languageStore.read()

      // Assert
      expect(language).toBe(expected)
    },
  )

  it('should say the language that was chosen, whatever the browser is set to', () => {
    // Arrange
    setBrowserLanguages(['en-US'])

    // Act
    languageStore.choose('ja')

    // Assert
    expect(languageStore.read()).toBe('ja')
  })

  it.each<Locale>(['en', 'ja'])(
    'should read back the language that was chosen (%s), and say that it is kept',
    (chosen) => {
      // Act
      const kept = languageStore.choose(chosen)

      // Assert
      expect(kept).toBe(true)
      expect(languageStore.read()).toBe(chosen)
    },
  )

  it('should keep the choice as the tag of the language in a value of its own of localStorage, so that a reload and another tab find it', () => {
    // Arrange
    sessionStore.write({ accessToken: 'a', refreshToken: 'r', userId: 'u' })
    const session = sessionStore.read()

    // Act
    languageStore.choose('en')

    // Assert
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')
    expect(sessionStore.read()).toEqual(session)
  })

  it.each([
    ['nothing', ''],
    ['a language the product is not written in', 'fr'],
    ['a tag with a region', 'en-US'],
    ['a tag in capital letters', 'EN'],
    ['a name of a property of every object', 'toString'],
  ])(
    'should take what is kept for no choice when it is %s, and say the language of the browser',
    (_case, stored) => {
      // Arrange
      localStorage.setItem(STORAGE_KEY, stored)
      setBrowserLanguages(['en-US'])

      // Act
      const language = languageStore.read()

      // Assert
      expect(language).toBe('en')
    },
  )

  it('should say the language of the browser in a browser that refuses access to its storage', () => {
    // Arrange
    languageStore.choose('en')
    refuseStorage()

    // Act
    const language = languageStore.read()

    // Assert
    expect(language).toBe('ja')
  })

  it('should say that a choice is not kept in a browser that refuses to store it, and still say that language, and tell its listeners', async () => {
    // Arrange
    const store = await loadedAnew()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    refuseStorage()

    // Act
    const kept = store.choose('en')

    // Assert
    expect(kept).toBe(false)
    expect(store.read()).toBe('en')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('should say the language of a choice that is kept after one the browser refused, once the browser keeps choices again', async () => {
    // Arrange
    const store = await loadedAnew()
    refuseStorage()
    store.choose('en')
    vi.restoreAllMocks()

    // Act
    const kept = store.choose('ja')

    // Assert
    expect(kept).toBe(true)
    expect(store.read()).toBe('ja')
  })

  it('should tell its listeners when a language is chosen', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = languageStore.subscribe(listener)

    // Act
    languageStore.choose('en')

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('should tell its listeners when another tab chooses a language, and say that one', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = languageStore.subscribe(listener)

    // Act
    changeInAnotherTab(STORAGE_KEY, 'en')

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
    expect(languageStore.read()).toBe('en')
    unsubscribe()
  })

  it('should tell its listeners when the languages of the browser change, and say the new one while none is chosen', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = languageStore.subscribe(listener)

    // Act
    setBrowserLanguages(['en-US'])

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
    expect(languageStore.read()).toBe('en')
    unsubscribe()
  })

  it('should not tell its listeners when somebody signs in or out', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = languageStore.subscribe(listener)

    // Act
    sessionStore.write({ accessToken: 'a', refreshToken: 'r', userId: 'u' })
    sessionStore.clear()

    // Assert
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('should tell a listener nothing after it has unsubscribed', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = languageStore.subscribe(listener)

    // Act
    unsubscribe()
    languageStore.choose('en')
    setBrowserLanguages(['en-US'])

    // Assert
    expect(listener).not.toHaveBeenCalled()
  })

  it('should tell a listener nothing after it has unsubscribed, of a choice the browser refused', async () => {
    // Arrange
    const store = await loadedAnew()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    refuseStorage()

    // Act
    unsubscribe()
    store.choose('en')

    // Assert
    expect(listener).not.toHaveBeenCalled()
  })
})
