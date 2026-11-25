import { describe, expect, it } from 'vitest'
import { rowWritten, written, writtenFor } from '../written'

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

describe('writtenFor', () => {
  const ITEMS = [{ id: 'row-2' }, { id: 'row-1' }]

  it('should answer with each item and the row written for it, in the order of the items', () => {
    // Act
    const result = writtenFor('Update of stock rows')(
      ITEMS,
      ({ id }) => id,
      [
        { rowId: 'row-1', stock: '1.00' },
        { rowId: 'row-2', stock: '2.00' },
      ],
      ({ rowId }) => rowId,
    )

    // Assert
    expect(result).toEqual({
      type: 'success',
      data: [
        { item: { id: 'row-2' }, row: { rowId: 'row-2', stock: '2.00' } },
        { item: { id: 'row-1' }, row: { rowId: 'row-1', stock: '1.00' } },
      ],
    })
  })

  it('should answer with nothing when there was nothing to write', () => {
    // Act
    const result = writtenFor('Insert of stock movements')(
      [],
      (id: string) => id,
      [],
      (id: string) => id,
    )

    // Assert
    expect(result).toEqual({ type: 'success', data: [] })
  })

  it.each([
    ['for none of the items', [], 2],
    ['for one of the items', [{ rowId: 'row-1' }], 1],
    ['for another item only', [{ rowId: null }, { rowId: 'row-3' }], 2],
  ])(
    'should answer a database error that names the write when it returned no row %s',
    (_case, rows, missing) => {
      // Act
      const result = writtenFor('Update of stock rows')(
        ITEMS,
        ({ id }) => id,
        rows,
        ({ rowId }) => rowId,
      )

      // Assert
      expect(result).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message: `Update of stock rows returned no row for ${missing} of 2`,
          cause: null,
        },
      })
    },
  )
})
