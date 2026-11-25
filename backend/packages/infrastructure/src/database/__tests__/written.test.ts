import { describe, expect, it } from 'vitest'
import { rowWritten, written } from '../written'

const noRow = {
  type: 'error',
  error: {
    type: 'database',
    message: 'Insert of salon returned no row',
    cause: null,
  },
}

describe('written', () => {
  it('should answer with what a write made of the row it wrote', () => {
    // Act
    const result = written('Insert of salon')({ id: 'salon-1' })

    // Assert
    expect(result).toEqual({ type: 'success', data: { id: 'salon-1' } })
  })

  it('should answer a database error that names the write when the row was not written', () => {
    // Act
    const result = written('Insert of salon')(null)

    // Assert
    expect(result).toEqual(noRow)
  })
})

describe('rowWritten', () => {
  it('should answer with the row a write returned', () => {
    // Act
    const result = rowWritten('Insert of salon')([{ id: 'salon-1' }])

    // Assert
    expect(result).toEqual({ type: 'success', data: { id: 'salon-1' } })
  })

  it('should answer a database error that names the write when it returned no row', () => {
    // Act
    const result = rowWritten('Insert of salon')([])

    // Assert
    expect(result).toEqual(noRow)
  })
})
