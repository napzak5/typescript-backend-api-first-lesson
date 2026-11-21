import { describe, expect, it } from 'vitest'
import { atTheWidthOfTheStory } from './story-width'

// `setup.ts`, which this package names in its own `setupFiles`, has installed the width

/** Whether the window is as wide as the stylesheets say a wide screen is */
const wide = (): boolean => window.matchMedia('(min-width: 40rem)').matches

/** Whether the window is as wide as the viewport of a tablet, and no wider */
const asWideAsATablet = (): boolean =>
  window.matchMedia('(min-width: 52.125rem)').matches &&
  !window.matchMedia('(min-width: 52.1875rem)').matches

describe('a story drawn at the width the catalogue shows it at', () => {
  it('should be as narrow as a phone when it chooses one', () => {
    // Act
    atTheWidthOfTheStory.beforeEach({
      globals: { viewport: { value: 'mobile1', isRotated: false } },
    })

    // Assert: 320 pixels
    expect(wide()).toBe(false)
    expect(window.matchMedia('(min-width: 20rem)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 20.0625rem)').matches).toBe(false)
  })

  it('should be as wide as a tablet when it chooses one', () => {
    // Act
    atTheWidthOfTheStory.beforeEach({
      globals: { viewport: { value: 'tablet', isRotated: false } },
    })

    // Assert: 834 pixels
    expect(asWideAsATablet()).toBe(true)
  })

  it('should be as wide as the phone is high when the phone is turned', () => {
    // Act
    atTheWidthOfTheStory.beforeEach({
      globals: { viewport: { value: 'mobile2', isRotated: true } },
    })

    // Assert: 896 pixels
    expect(window.matchMedia('(min-width: 56rem)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 56.0625rem)').matches).toBe(false)
  })

  it.each<[string, unknown]>([
    ['no viewport', {}],
    [
      'a viewport the catalogue does not have',
      { viewport: { value: 'watch', isRotated: false } },
    ],
    ['a viewport without its turn', { viewport: { value: 'mobile1' } }],
  ])('should stay as wide as every test starts for %s', (_, globals) => {
    // Act
    atTheWidthOfTheStory.beforeEach({ globals })

    // Assert: 1024 pixels
    expect(wide()).toBe(true)
    expect(window.matchMedia('(min-width: 64rem)').matches).toBe(true)
  })
})
