import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeInAnotherTab, refuseStorage } from './browser-storage'

/** What the browser told this tab about its storage, in order */
const heard = (): { events: StorageEvent[]; stop: () => void } => {
  const events: StorageEvent[] = []
  const listener = (event: StorageEvent): void => {
    events.push(event)
  }
  window.addEventListener('storage', listener)

  return {
    events,
    stop: () => window.removeEventListener('storage', listener),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('changeInAnotherTab', () => {
  it('should keep the new value, and tell this tab which key changed to what', () => {
    // Arrange
    const { events, stop } = heard()

    // Act
    changeInAnotherTab('language', 'en')

    // Assert
    expect(localStorage.getItem('language')).toBe('en')
    expect(events.map(({ key, newValue }) => ({ key, newValue }))).toEqual([
      { key: 'language', newValue: 'en' },
    ])
    stop()
  })

  it('should take the value away, and tell this tab that it is gone', () => {
    // Arrange
    localStorage.setItem('language', 'en')
    const { events, stop } = heard()

    // Act
    changeInAnotherTab('language', null)

    // Assert
    expect(localStorage.getItem('language')).toBeNull()
    expect(events.map(({ key, newValue }) => ({ key, newValue }))).toEqual([
      { key: 'language', newValue: null },
    ])
    stop()
  })

  it('should clear the whole storage when it names no key, and tell this tab so', () => {
    // Arrange
    localStorage.setItem('language', 'en')
    localStorage.setItem('session', 'somebody')
    const { events, stop } = heard()

    // Act
    changeInAnotherTab(null, null)

    // Assert
    expect(localStorage).toHaveLength(0)
    expect(events.map(({ key, newValue }) => ({ key, newValue }))).toEqual([
      { key: null, newValue: null },
    ])
    stop()
  })
})

describe('refuseStorage', () => {
  it('should make every access to the storage fail, as in a browser that keeps nothing for the site', () => {
    // Arrange
    localStorage.setItem('language', 'en')

    // Act
    refuseStorage()

    // Assert
    expect(() => localStorage.getItem('language')).toThrow(
      expect.objectContaining({
        name: 'SecurityError',
        message: 'Access is denied for this document.',
      }),
    )
  })

  it('should end when the mocks are restored', () => {
    // Arrange
    localStorage.setItem('language', 'en')
    refuseStorage()

    // Act
    vi.restoreAllMocks()

    // Assert
    expect(localStorage.getItem('language')).toBe('en')
  })
})
