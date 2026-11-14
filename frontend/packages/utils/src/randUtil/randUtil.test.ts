import { describe, expect, it } from 'vitest'
import { createId, createIdBySeed, gnrng } from './randUtil'

const ID_BODY = '[1-9A-HJ-NP-Za-km-z]'

const take = (next: () => number, count: number): number[] =>
  Array.from({ length: count }, () => next())

describe('gnrng', () => {
  it('should produce the same sequence for the same seed', () => {
    // Arrange
    const first = gnrng('salon')
    const second = gnrng('salon')

    // Act
    const sequences = [take(first, 10), take(second, 10)]

    // Assert
    expect(sequences[0]).toEqual(sequences[1])
  })

  it('should produce different sequences for different seeds', () => {
    // Arrange
    const first = gnrng('salon')
    const second = gnrng('stylist')

    // Act
    const sequences = [take(first, 10), take(second, 10)]

    // Assert
    expect(sequences[0]).not.toEqual(sequences[1])
  })

  it('should advance on every call', () => {
    // Arrange
    const next = gnrng('salon')

    // Act
    const values = take(next, 10)

    // Assert
    expect(new Set(values).size).toBe(10)
  })
})

describe('createId', () => {
  it('should create a default id with 7 unambiguous characters', () => {
    // Act
    const result = createId()

    // Assert
    expect(result).toMatch(new RegExp(`^d_${ID_BODY}{7}$`))
  })

  it('should create an id of the requested size', () => {
    // Act
    const result = createId(12)

    // Assert
    expect(result).toMatch(new RegExp(`^d_${ID_BODY}{12}$`))
  })

  it('should use the feature prefix for feature ids', () => {
    // Act
    const result = createId(7, 'feature')

    // Assert
    expect(result).toMatch(new RegExp(`^f_${ID_BODY}{7}$`))
  })
})

describe('createIdBySeed', () => {
  it('should create the same id for the same seed', () => {
    // Act
    const ids = [createIdBySeed('customer-1'), createIdBySeed('customer-1')]

    // Assert
    expect(ids[0]).toBe(ids[1])
  })

  it('should create different ids for different seeds', () => {
    // Act
    const ids = [createIdBySeed('customer-1'), createIdBySeed('customer-2')]

    // Assert
    expect(ids[0]).not.toBe(ids[1])
  })

  it('should keep generating the id that a seed has always produced', () => {
    // Act
    const result = createIdBySeed('seed')

    // Assert
    expect(result).toBe('d_SkZ31bq')
  })

  it('should create an id of the requested size and type', () => {
    // Act
    const result = createIdBySeed('seed', 12, 'feature')

    // Assert
    expect(result).toMatch(new RegExp(`^f_${ID_BODY}{12}$`))
  })
})
