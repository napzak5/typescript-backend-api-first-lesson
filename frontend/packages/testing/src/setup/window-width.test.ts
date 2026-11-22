import { describe, expect, it, vi } from 'vitest'
import { setWindowWidth } from './window-width'

// `setup.ts`, which this package names in its own `setupFiles`, has installed the width

const WIDE = '(min-width: 40rem)'

describe('the width of the window given to jsdom', () => {
  it('should be as wide as the window of jsdom, a desktop', () => {
    // Act
    const wide = window.matchMedia(WIDE)

    // Assert: 1024 pixels
    expect(wide.matches).toBe(true)
    expect(wide.media).toBe(WIDE)
    expect(window.matchMedia('(min-width: 64rem)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 64.0625rem)').matches).toBe(false)
  })

  it('should answer for the width a test sets, at the edge as well', () => {
    // Act
    setWindowWidth(639)
    const below = window.matchMedia(WIDE).matches
    setWindowWidth(640)

    // Assert
    expect(below).toBe(false)
    expect(window.matchMedia(WIDE).matches).toBe(true)
  })

  it('should tell the listeners of a query whose answer changes, and no other', () => {
    // Arrange
    const onWide = vi.fn()
    const onWider = vi.fn()
    window.matchMedia(WIDE).addEventListener('change', onWide)
    window.matchMedia('(min-width: 80rem)').addEventListener('change', onWider)

    // Act
    setWindowWidth(390)

    // Assert
    expect(onWide).toHaveBeenCalledTimes(1)
    expect(onWider).not.toHaveBeenCalled()
    window.matchMedia(WIDE).removeEventListener('change', onWide)
    window
      .matchMedia('(min-width: 80rem)')
      .removeEventListener('change', onWider)
  })

  it('should give the next test the window every test starts with', () => {
    // Assert: the test before made it 390 pixels wide
    expect(window.matchMedia(WIDE).matches).toBe(true)
  })

  it.each<[string]>([
    ['(max-width: 40rem)'],
    ['(min-width: 40px)'],
    ['(min-width:40rem)'],
    ['(prefers-reduced-motion: reduce)'],
    ['screen and (min-width: 40rem)'],
  ])('should not match a query it does not know: %s', (query) => {
    // Act
    const answer = window.matchMedia(query)

    // Assert
    expect(answer.matches).toBe(false)
  })
})
