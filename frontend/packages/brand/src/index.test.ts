import { describe, expect, it } from 'vitest'
import { applications, PRODUCT_NAME } from './index'

describe('applications', () => {
  it('should name each application after the product, and name no environment', () => {
    // Assert: the environment is the badge in the corner of a screen
    expect(
      Object.entries(applications).map(([key, { name }]) => [key, name]),
    ).toEqual([
      ['portal', PRODUCT_NAME],
      ['admin', 'Kushi Admin'],
      ['dashboard', 'Kushi Dashboard'],
    ])
    expect(PRODUCT_NAME).toBe('Kushi')
  })

  it('should say what each application is for in a sentence of its own', () => {
    // Act
    const descriptions = Object.values(applications).map(
      ({ description }) => description,
    )

    // Assert
    expect(new Set(descriptions).size).toBe(descriptions.length)
    for (const description of descriptions) {
      expect(description).toMatch(/^サロン.+。$/)
    }
  })
})
