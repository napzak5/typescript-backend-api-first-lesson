import { describe, expect, it } from 'vitest'
import { aggregateOf } from '../aggregate'

/** The aggregates of the tests: a count, and a day that no rows have. */
type Visits = { visits: number; lastVisit: string | null }

/** What the aggregates of the tests are of no rows. */
const NONE: Visits = { visits: 0, lastVisit: null }

describe('aggregateOf', () => {
  it('should be the one row a query of aggregates answers with', () => {
    // Arrange
    const answered: Visits[] = [{ visits: 3, lastVisit: '2026-12-07' }]

    // Act
    const aggregates = aggregateOf(answered, NONE)

    // Assert
    expect(aggregates).toEqual({ visits: 3, lastVisit: '2026-12-07' })
  })

  it('should be the aggregates of no rows when the query answered with none', () => {
    // Act
    const aggregates = aggregateOf([], NONE)

    // Assert
    expect(aggregates).toEqual({ visits: 0, lastVisit: null })
  })
})
