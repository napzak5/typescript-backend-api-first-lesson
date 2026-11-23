import {
  changeInAnotherTab,
  refuseStorage,
} from '@beauty-salon-frontend/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type StoredSession, sessionStore } from './stored-session'

const STORAGE_KEY = 'beauty-salon:session'

const SESSION: StoredSession = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  userId: '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07',
}

describe('sessionStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should have no session before one is written', () => {
    // Act
    const session = sessionStore.read()

    // Assert
    expect(session).toBeNull()
    expect(sessionStore.userId()).toBeNull()
  })

  it('should read back the session that was written', () => {
    // Arrange
    sessionStore.write(SESSION)

    // Act
    const session = sessionStore.read()

    // Assert
    expect(session).toEqual(SESSION)
    expect(sessionStore.userId()).toBe(SESSION.userId)
  })

  it('should keep the session in one value of localStorage, so that a reload and another tab find it whole', () => {
    // Act
    sessionStore.write(SESSION)

    // Assert
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem(STORAGE_KEY)).toContain('access-1')
    expect(localStorage.getItem(STORAGE_KEY)).toContain('refresh-1')
  })

  it('should read back tokens with the characters of base64url and others unchanged', () => {
    // Arrange
    const session = {
      accessToken: 'a-b_c=d&e+f g/h%20',
      refreshToken: 'r&userId=someone-else',
      userId: SESSION.userId,
    }
    sessionStore.write(session)

    // Act
    const read = sessionStore.read()

    // Assert
    expect(read).toEqual(session)
  })

  it('should have no session after it was cleared', () => {
    // Arrange
    sessionStore.write(SESSION)

    // Act
    sessionStore.clear()

    // Assert
    expect(sessionStore.read()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it.each([
    ['nothing', ''],
    ['text that is no session', 'not a session'],
    ['an access token alone', 'accessToken=access-1'],
    ['no user', 'accessToken=access-1&refreshToken=refresh-1'],
    ['an empty refresh token', 'accessToken=a&refreshToken=&userId=u'],
  ])('should take a stored value with %s for no session', (_case, stored) => {
    // Arrange
    localStorage.setItem(STORAGE_KEY, stored)

    // Act
    const session = sessionStore.read()

    // Assert
    expect(session).toBeNull()
  })

  it('should have no session in a browser that refuses access to its storage', () => {
    // Arrange
    sessionStore.write(SESSION)
    refuseStorage()

    // Act
    const session = sessionStore.read()
    const userId = sessionStore.userId()

    // Assert
    expect(session).toBeNull()
    expect(userId).toBeNull()
  })

  it('should say that the session is kept', () => {
    // Act
    const kept = sessionStore.write(SESSION)

    // Assert
    expect(kept).toBe(true)
  })

  it('should say that the session is not kept in a browser that refuses access to its storage, and tell no listener', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = sessionStore.subscribe(listener)
    refuseStorage()

    // Act
    const kept = sessionStore.write(SESSION)

    // Assert
    expect(kept).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('should clear the session without failing in a browser that refuses access to its storage', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = sessionStore.subscribe(listener)
    refuseStorage()

    // Act
    sessionStore.clear()

    // Assert
    expect(sessionStore.read()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('should tell its listeners when the session is written and when it is cleared', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = sessionStore.subscribe(listener)

    // Act
    sessionStore.write(SESSION)
    sessionStore.clear()

    // Assert
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('should tell its listeners when another tab signs in or out', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = sessionStore.subscribe(listener)

    // Act
    changeInAnotherTab(STORAGE_KEY, new URLSearchParams(SESSION).toString())
    const afterSignIn = sessionStore.read()
    changeInAnotherTab(STORAGE_KEY, null)
    const afterSignOut = sessionStore.read()

    // Assert
    expect(listener).toHaveBeenCalledTimes(2)
    expect(afterSignIn).toEqual(SESSION)
    expect(afterSignOut).toBeNull()
    unsubscribe()
  })

  it('should tell its listeners when another tab clears the whole storage', () => {
    // Arrange
    sessionStore.write(SESSION)
    const listener = vi.fn()
    const unsubscribe = sessionStore.subscribe(listener)

    // Act
    changeInAnotherTab(null, null)

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('should not tell its listeners about other values of the storage', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = sessionStore.subscribe(listener)

    // Act
    changeInAnotherTab('something-else', 'value')

    // Assert
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('should tell a listener nothing after it has unsubscribed, while the others still hear', () => {
    // Arrange
    const gone = vi.fn()
    const staying = vi.fn()
    const unsubscribeGone = sessionStore.subscribe(gone)
    const unsubscribeStaying = sessionStore.subscribe(staying)

    // Act
    unsubscribeGone()
    sessionStore.write(SESSION)
    changeInAnotherTab(STORAGE_KEY, null)

    // Assert
    expect(gone).not.toHaveBeenCalled()
    expect(staying).toHaveBeenCalledTimes(2)
    unsubscribeStaying()
  })

  it('should stop listening to the browser when its last listener has unsubscribed', () => {
    // Arrange
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const unsubscribe = sessionStore.subscribe(vi.fn())

    // Act
    unsubscribe()

    // Assert
    expect(removeEventListener).toHaveBeenCalledWith(
      'storage',
      expect.any(Function),
    )
    removeEventListener.mockRestore()
  })
})
