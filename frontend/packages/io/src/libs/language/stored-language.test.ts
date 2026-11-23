import {
  changeInAnotherTab,
  refuseStorage,
} from '@beauty-salon-frontend/testing'
import type { Locale } from '@beauty-salon-shared/i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sessionStore } from '../session/stored-session'
import { languageStore } from './stored-language'

const STORAGE_KEY = 'beauty-salon:language'

describe('languageStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say Japanese before a language is chosen', () => {
    // Act
    const language = languageStore.read()

    // Assert
    expect(language).toBe('ja')
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
  ])('should say Japanese when what is kept is %s', (_case, stored) => {
    // Arrange
    localStorage.setItem(STORAGE_KEY, stored)

    // Act
    const language = languageStore.read()

    // Assert
    expect(language).toBe('ja')
  })

  it('should say Japanese in a browser that refuses access to its storage, and that a choice is not kept', () => {
    // Arrange
    languageStore.choose('en')
    refuseStorage()

    // Act
    const language = languageStore.read()
    const kept = languageStore.choose('en')

    // Assert
    expect(language).toBe('ja')
    expect(kept).toBe(false)
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

    // Assert
    expect(listener).not.toHaveBeenCalled()
  })
})
