import {
  changeInAnotherTab,
  refuseStorage,
} from '@beauty-salon-frontend/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keptValue } from './kept-value'

const KEY = 'beauty-salon:something'

describe('keptValue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should hold nothing before a value is written', () => {
    // Arrange
    const kept = keptValue(KEY)

    // Act
    const value = kept.read()

    // Assert
    expect(value).toBeNull()
  })

  it('should read back the value that was written, which is kept under its key of localStorage', () => {
    // Arrange
    const kept = keptValue(KEY)

    // Act
    const written = kept.write('one')

    // Assert
    expect(written).toBe(true)
    expect(kept.read()).toBe('one')
    expect(localStorage.getItem(KEY)).toBe('one')
  })

  it('should hold nothing after it was cleared', () => {
    // Arrange
    const kept = keptValue(KEY)
    kept.write('one')

    // Act
    kept.clear()

    // Assert
    expect(kept.read()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('should hold nothing in a browser that refuses access to its storage', () => {
    // Arrange
    const kept = keptValue(KEY)
    kept.write('one')
    refuseStorage()

    // Act
    const value = kept.read()

    // Assert
    expect(value).toBeNull()
  })

  it('should say that the value is not kept in a browser that refuses access to its storage, and tell no listener', () => {
    // Arrange
    const kept = keptValue(KEY)
    const listener = vi.fn()
    const unsubscribe = kept.subscribe(listener)
    refuseStorage()

    // Act
    const written = kept.write('one')

    // Assert
    expect(written).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('should clear without failing in a browser that refuses access to its storage, and tell its listeners', () => {
    // Arrange
    const kept = keptValue(KEY)
    const listener = vi.fn()
    const unsubscribe = kept.subscribe(listener)
    refuseStorage()

    // Act
    kept.clear()

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('should tell its listeners when the value is written and when it is cleared', () => {
    // Arrange
    const kept = keptValue(KEY)
    const listener = vi.fn()
    const unsubscribe = kept.subscribe(listener)

    // Act
    kept.write('one')
    kept.clear()

    // Assert
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('should tell its listeners when another tab writes the value or takes it away, and read what that tab left', () => {
    // Arrange
    const kept = keptValue(KEY)
    const listener = vi.fn()
    const unsubscribe = kept.subscribe(listener)

    // Act
    changeInAnotherTab(KEY, 'two')
    const afterWrite = kept.read()
    changeInAnotherTab(KEY, null)
    const afterRemoval = kept.read()

    // Assert
    expect(listener).toHaveBeenCalledTimes(2)
    expect(afterWrite).toBe('two')
    expect(afterRemoval).toBeNull()
    unsubscribe()
  })

  it('should tell its listeners when another tab clears the whole storage', () => {
    // Arrange
    const kept = keptValue(KEY)
    kept.write('one')
    const listener = vi.fn()
    const unsubscribe = kept.subscribe(listener)

    // Act
    changeInAnotherTab(null, null)

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
    expect(kept.read()).toBeNull()
    unsubscribe()
  })

  it('should not tell its listeners about another value of the storage, in this tab or in another one', () => {
    // Arrange
    const kept = keptValue(KEY)
    const other = keptValue('beauty-salon:something-else')
    const listener = vi.fn()
    const unsubscribe = kept.subscribe(listener)

    // Act
    other.write('two')
    changeInAnotherTab('beauty-salon:something-else', 'three')

    // Assert
    expect(listener).not.toHaveBeenCalled()
    expect(kept.read()).toBeNull()
    unsubscribe()
  })

  it('should tell a listener nothing after it has unsubscribed, while the others still hear', () => {
    // Arrange
    const kept = keptValue(KEY)
    const gone = vi.fn()
    const staying = vi.fn()
    const unsubscribeGone = kept.subscribe(gone)
    const unsubscribeStaying = kept.subscribe(staying)

    // Act
    unsubscribeGone()
    kept.write('one')
    changeInAnotherTab(KEY, null)

    // Assert
    expect(gone).not.toHaveBeenCalled()
    expect(staying).toHaveBeenCalledTimes(2)
    unsubscribeStaying()
  })

  it('should listen to the browser only while somebody listens to it', () => {
    // Arrange
    const kept = keptValue(KEY)
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')

    // Act
    const unsubscribeFirst = kept.subscribe(vi.fn())
    const unsubscribeSecond = kept.subscribe(vi.fn())
    unsubscribeFirst()
    const removedWhileOneListens = removeEventListener.mock.calls.length
    unsubscribeSecond()

    // Assert
    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith(
      'storage',
      expect.any(Function),
    )
    expect(removedWhileOneListens).toBe(0)
    expect(removeEventListener).toHaveBeenCalledTimes(1)
    expect(removeEventListener).toHaveBeenCalledWith(
      'storage',
      addEventListener.mock.calls[0]?.[1],
    )
  })
})
