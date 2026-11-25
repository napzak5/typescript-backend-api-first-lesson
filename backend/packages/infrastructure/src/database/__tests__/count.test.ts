import { describe, expect, it } from 'vitest'
import { totalOf } from '../count'

describe('totalOf', () => {
  it('should be the count of the one row a query of count() answers with', () => {
    // Act
    const total = totalOf([{ total: 42 }])

    // Assert
    expect(total).toBe(42)
  })

  it('should be no count of no row', () => {
    // Act
    const total = totalOf([])

    // Assert
    expect(total).toBe(0)
  })
})
