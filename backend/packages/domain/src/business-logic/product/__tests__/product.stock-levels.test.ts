import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  brokenOrders,
  type StockLevel,
  type StockLevelOrder,
  type StockLevels,
  stockLevelIssues,
  stockLevelsAfter,
} from '../_shared/stock-levels'

const levels = (
  minimumStock: number,
  reorderPoint: number | null,
  maximumStock: number | null,
): StockLevels => ({ minimumStock, reorderPoint, maximumStock })

describe('brokenOrders', () => {
  it.each<[string, StockLevels]>([
    ['three equal levels', levels(5, 5, 5)],
    ['three rising levels', levels(0, 10, 50)],
    ['levels that differ by a hundredth', levels(4.99, 5, 5.01)],
    ['a minimum alone', levels(1000, null, null)],
    ['a minimum and a reorder point', levels(5, 6, null)],
    ['a minimum and a maximum', levels(5, null, 6)],
  ])('finds %s in order', (_case, given) => {
    expect(brokenOrders(given)).toEqual([])
  })

  it.each<[string, StockLevels, StockLevelOrder[]]>([
    [
      'a reorder point below the minimum',
      levels(5, 4.99, null),
      [['minimumStock', 'reorderPoint']],
    ],
    [
      'a maximum below the minimum',
      levels(5, null, 4),
      [['minimumStock', 'maximumStock']],
    ],
    [
      'a reorder point above the maximum',
      levels(5, 40, 30),
      [['reorderPoint', 'maximumStock']],
    ],
    [
      'a minimum above the other two',
      levels(20, 10, 15),
      [
        ['minimumStock', 'reorderPoint'],
        ['minimumStock', 'maximumStock'],
      ],
    ],
    [
      'three falling levels',
      levels(30, 20, 10),
      [
        ['minimumStock', 'reorderPoint'],
        ['minimumStock', 'maximumStock'],
        ['reorderPoint', 'maximumStock'],
      ],
    ],
  ])('finds %s out of order', (_case, given, expected) => {
    expect(brokenOrders(given)).toEqual(expected)
  })

  it('compares only the levels that are given', () => {
    expect(brokenOrders({ maximumStock: 1 })).toEqual([])
    expect(brokenOrders({ reorderPoint: 9, maximumStock: 1 })).toEqual([
      ['reorderPoint', 'maximumStock'],
    ])
    expect(brokenOrders({})).toEqual([])
  })

  it('does not compare a level that is not set with anything, not even as 0', () => {
    expect(
      brokenOrders({ minimumStock: 5, reorderPoint: null, maximumStock: null }),
    ).toEqual([])
    expect(brokenOrders({ minimumStock: 0, maximumStock: null })).toEqual([])
  })
})

describe('stockLevelsAfter', () => {
  const current = levels(5, 10, 50)

  it('keeps the levels a change does not name', () => {
    expect(stockLevelsAfter(current, {})).toEqual(current)
  })

  it.each<[string, Partial<StockLevels>, StockLevels]>([
    ['the minimum', { minimumStock: 0 }, levels(0, 10, 50)],
    ['the reorder point', { reorderPoint: 20 }, levels(5, 20, 50)],
    ['the maximum', { maximumStock: 0 }, levels(5, 10, 0)],
    [
      'all three',
      { minimumStock: 1, reorderPoint: 2, maximumStock: 3 },
      levels(1, 2, 3),
    ],
  ])('takes %s from the change', (_case, changes, expected) => {
    expect(stockLevelsAfter(current, changes)).toEqual(expected)
  })

  it('takes a level away when the change names null', () => {
    expect(
      stockLevelsAfter(current, { reorderPoint: null, maximumStock: null }),
    ).toEqual(levels(5, null, null))
  })

  it('keeps a level that is not set unless the change sets it', () => {
    expect(
      stockLevelsAfter(levels(5, null, null), { minimumStock: 7 }),
    ).toEqual(levels(7, null, null))
    expect(
      stockLevelsAfter(levels(5, null, null), { maximumStock: 9 }),
    ).toEqual(levels(5, null, 9))
  })
})

describe('stockLevelIssues', () => {
  const naming =
    (...names: StockLevel[]) =>
    (level: StockLevel): boolean =>
      names.includes(level)

  it('says nothing when no order is broken', () => {
    expect(stockLevelIssues([], naming('minimumStock'))).toEqual([])
  })

  it('puts the issue on the upper level when the request names both', () => {
    expect(
      stockLevelIssues(
        [['minimumStock', 'maximumStock']],
        naming('minimumStock', 'maximumStock'),
      ),
    ).toEqual([
      {
        field: 'maximumStock',
        message: ruleMessages.notLessThan('minimumStock'),
      },
    ])
  })

  it('puts the issue on the upper level when the request names only that one', () => {
    expect(
      stockLevelIssues(
        [['reorderPoint', 'maximumStock']],
        naming('maximumStock'),
      ),
    ).toEqual([
      {
        field: 'maximumStock',
        message: ruleMessages.notLessThan('reorderPoint'),
      },
    ])
  })

  it('puts the issue on the lower level when the request names only that one', () => {
    expect(
      stockLevelIssues(
        [['minimumStock', 'reorderPoint']],
        naming('minimumStock'),
      ),
    ).toEqual([
      {
        field: 'minimumStock',
        message: ruleMessages.notMoreThan('reorderPoint'),
      },
    ])
  })

  it('tells of every broken order, in the order given', () => {
    expect(
      stockLevelIssues(
        [
          ['minimumStock', 'reorderPoint'],
          ['minimumStock', 'maximumStock'],
        ],
        naming('minimumStock'),
      ),
    ).toEqual([
      {
        field: 'minimumStock',
        message: ruleMessages.notMoreThan('reorderPoint'),
      },
      {
        field: 'minimumStock',
        message: ruleMessages.notMoreThan('maximumStock'),
      },
    ])
  })
})
