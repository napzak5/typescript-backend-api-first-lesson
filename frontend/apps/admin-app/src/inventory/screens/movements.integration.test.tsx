import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { staffIdOf } from '../../customers/__tests__/arrangements'
import {
  inventoryHrefOf,
  movementEntryHrefOf,
  stockMovementsHrefOf,
  stockRowHrefOf,
} from '../../navigation'
import {
  anotherRow,
  displayNameOf,
  drawnOf,
  recordedEarlier,
  reservedMeanwhile,
  rowIdOf,
  rowRemovedMeanwhile,
  storedMovementsOf,
} from '../__tests__/arrangements'

/*
 * The movements of a stock row, recorded and read against the API. The
 * salon in Tokyo of the seed data keeps a row of the colour, among others:
 * 20 tubes of a lot of its own, which began its history with the movement
 * the seed recorded. Everybody who works there records the movements of
 * every day; its owner and its manager record the others as well.
 * Somebody did something meanwhile where a test says so.
 */

/** Waits for a row: its heading comes first, the record once the row was read. */
const openedRow = async (): Promise<void> => {
  await heading('在庫の行')
  await screen.findByRole('region', { name: '在庫' })
}

/** Waits for the history: its heading comes first, the table once the movements were read. */
const openedHistory = async (caption = '在庫の移動'): Promise<void> => {
  await heading('在庫の移動')
  await screen.findByRole('table', { name: caption })
}

/** Waits for the form of a movement: its heading comes first, the form once the row was read. */
const openedEntry = async (): Promise<void> => {
  await heading('在庫の移動を記録する')
  await screen.findByRole('radiogroup', { name: /^区分/ })
}

/** The rows of the history, each as the texts of its cells but the moment. */
const movements = (caption = '在庫の移動'): string[][] =>
  rowsOf(caption).map((row) => row.slice(1))

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

const quantity = (): HTMLElement => text(/^数量/)

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<void> => {
  await user.click(screen.getByRole('radio', { name }))
}

/** The movement the seed began each row with */
const OPENING = [
  '在庫の調整',
  '+20 tube',
  '20 tube',
  '記録なし',
  '在庫移動の記録を始めた時点の在庫数',
  '記録なし',
]

const BELOW_RESERVED =
  '記録すると、在庫数が、引き当てた数を下回ります。その間に在庫数が変わりました。読み直した在庫数を確かめて、もう一度お試しください。'

describe('the screens of the movements of the stock', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should let the stylist record a use from the row, show it first in the history, and read the stock anew', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    const lot = (await drawnOf(TOKYO))[1]?.lotNumber ?? ''
    const stylist = await displayNameOf(STYLIST)
    await openAs(inventoryHrefOf(salonId), STYLIST)
    await heading('在庫')
    await screen.findByRole('table', { name: '在庫' })
    await user.click(
      screen.getByRole('link', { name: 'Hair Color - Natural Brown' }),
    )
    await openedRow()
    await user.click(screen.getByRole('link', { name: '在庫の移動を記録する' }))
    await openedEntry()
    expect(
      within(screen.getByRole('radiogroup', { name: /^区分/ }))
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['purchase', 'use', 'sale', 'return'])
    expect(
      screen.getByText(
        `Hair Color - Natural Brown（ロット ${lot}）。いまの在庫数は 20 tube、そのうち使える数は 20 tube です。`,
      ),
    ).toBeVisible()
    await choose(user, '施術で使用')
    await user.type(quantity(), '2.5')

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(
      await screen.findByText(
        '施術で使用を記録しました。在庫数は 17.5 tube になりました。',
      ),
    ).toBeInTheDocument()
    await openedHistory()
    expect(firstSight()[0]).toBe(stockMovementsHrefOf(salonId, rowId))
    // The heading took the focus when the history opened, and kept it while the history was read
    expect(
      screen.getByRole('heading', { level: 1, name: '在庫の移動' }),
    ).toHaveFocus()
    expect(movements()).toEqual([
      ['施術で使用', '−2.5 tube', '17.5 tube', '記録なし', '記録なし', stylist],
      OPENING,
    ])
    expect(
      screen.getByText(
        `Hair Color - Natural Brown（ロット ${lot}）。在庫数は 17.5 tube です。`,
      ),
    ).toBeVisible()
    expect((await storedMovementsOf(rowId))[0]).toEqual({
      transactionType: 'use',
      quantity: '-2.50',
      balanceAfter: '17.50',
      unitCost: null,
      totalCost: null,
      reason: null,
      performedBy: await staffIdOf(stylist),
    })

    // Act
    await user.click(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: '在庫' }),
    )

    // Assert: the stock read before the movement is not shown again, it is read anew
    expect(firstSight()[1]).not.toContain('20 tube')
    await screen.findByRole('table', { name: '在庫' })
    expect(
      within(screen.getByRole('row', { name: /COLOR001/ })).getByText(
        '17.5 tube',
      ),
    ).toBeVisible()
  })

  it('should let the manager adjust the stock from the history after saying why, with what a unit cost, and read the history anew', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    const manager = await displayNameOf(MANAGER)
    await openAs(stockMovementsHrefOf(salonId, rowId), MANAGER)
    await openedHistory()
    expect(screen.getByText('1 件')).toBeVisible()
    await user.click(screen.getByRole('link', { name: '在庫の移動を記録する' }))
    await openedEntry()
    await choose(user, '在庫の調整')
    await choose(user, '在庫が減る')
    await user.type(quantity(), '3')
    await user.type(text('単価（円）'), '1,200')
    await user.click(screen.getByRole('button', { name: '記録する' }))
    expect(text(/^理由/)).toHaveAccessibleDescription(
      '在庫数を変える理由を、次に数える人のために書きます。 在庫の調整と廃棄では、理由を入力してください。',
    )
    expect(text(/^理由/)).toHaveFocus()
    await user.type(text(/^理由/), '数え直したら 17 本だった')

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(
      await screen.findByText(
        '在庫の調整を記録しました。在庫数は 17 tube になりました。',
      ),
    ).toBeInTheDocument()
    // The history read before the movement is not shown again, it is read anew
    await waitFor(() =>
      expect(firstSight()[0]).toBe(stockMovementsHrefOf(salonId, rowId)),
    )
    expect(firstSight()[1]).not.toContain('1 件')
    await openedHistory()
    expect(screen.getByText('2 件')).toBeVisible()
    expect(movements()[0]).toEqual([
      '在庫の調整',
      '−3 tube',
      '17 tube',
      '￥3,600',
      '数え直したら 17 本だった',
      manager,
    ])
    expect((await storedMovementsOf(rowId))[0]).toMatchObject({
      transactionType: 'adjustment',
      quantity: '-3.00',
      unitCost: 1200,
      totalCost: 3600,
      reason: '数え直したら 17 本だった',
    })
  })

  it('should say before sending that no more than what is not reserved may be taken out, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    await reservedMeanwhile(rowId, 15)
    await openAs(movementEntryHrefOf(await salonIdOf(TOKYO), rowId), MANAGER)
    await openedEntry()
    await choose(user, '廃棄')
    await user.type(quantity(), '6')
    await user.type(text(/^理由/), '落として割れた')

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(quantity()).toHaveAccessibleDescription(
      'tube で数えます。小数は 2 桁まで。 減らせるのは、使える数の 5 tube までです。',
    )
    expect(quantity()).toHaveFocus()
    expect(await storedMovementsOf(rowId)).toHaveLength(1)
  })

  it('should say at the quantity that the stock reserved meanwhile would be above it, and read the row anew', async () => {
    // Arrange
    const user = userEvent.setup()
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    await openAs(movementEntryHrefOf(await salonIdOf(TOKYO), rowId), MANAGER)
    await openedEntry()
    await choose(user, '施術で使用')
    await user.type(quantity(), '10')
    await reservedMeanwhile(rowId, 15)

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(
      await screen.findByText(/そのうち使える数は 5 tube です。$/),
    ).toBeVisible()
    expect(quantity()).toHaveAccessibleDescription(
      `tube で数えます。小数は 2 桁まで。 ${BELOW_RESERVED}`,
    )
    expect(await storedMovementsOf(rowId)).toHaveLength(1)
  })

  it('should narrow the history to a kind and days, keep them in the address, and say when none meet them', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    await recordedEarlier(rowId, [
      {
        transactionType: 'purchase',
        quantity: 10,
        createdAt: '2025-10-05T01:00:00.000Z',
        referenceType: 'purchase_order',
      },
      {
        transactionType: 'use',
        quantity: -3,
        createdAt: '2025-10-20T02:00:00.000Z',
      },
      {
        transactionType: 'purchase',
        quantity: 5,
        createdAt: '2025-11-02T03:00:00.000Z',
      },
    ])
    await openAs(stockRowHrefOf(salonId, rowId), STYLIST)
    await openedRow()
    await user.click(screen.getByRole('link', { name: '在庫の移動の履歴' }))
    await openedHistory()
    expect(movements()).toHaveLength(4)
    await user.selectOptions(
      screen.getByRole('combobox', { name: '区分' }),
      '仕入れ',
    )
    await user.type(screen.getByLabelText('記録した日（から）'), '2025-10-01')
    await user.type(screen.getByLabelText('記録した日（まで）'), '2025-10-31')

    // Act
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await openedHistory('条件に合う在庫の移動')
    expect(firstSight()[0]).toBe(
      `${stockMovementsHrefOf(salonId, rowId)}?type=purchase&from=2025-10-01&to=2025-10-31`,
    )
    expect(rowsOf('条件に合う在庫の移動')).toEqual([
      [
        '2025年10月5日（日） 10:00',
        '仕入れ',
        '+10 tube',
        '30 tube',
        '記録なし',
        '発注の入荷',
        '記録なし',
      ],
    ])

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '区分' }),
      '廃棄',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(
      await screen.findByText('条件に合う在庫の移動はありません'),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('link', { name: '条件を外す' }))

    // Assert
    await openedHistory()
    expect(firstSight()[0]).toBe(stockMovementsHrefOf(salonId, rowId))
    expect(movements().map(([kind]) => kind)).toEqual([
      '在庫の調整',
      '仕入れ',
      '施術で使用',
      '仕入れ',
    ])
  })

  it('should go on with the movements that come next', async () => {
    // Arrange
    const user = userEvent.setup()
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    await recordedEarlier(
      rowId,
      Array.from({ length: 25 }, (_, index) => ({
        transactionType: 'purchase',
        quantity: 1,
        createdAt: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
      })),
    )
    await openAs(stockMovementsHrefOf(await salonIdOf(TOKYO), rowId), MANAGER)
    await openedHistory()
    expect(movements()).toHaveLength(20)
    expect(screen.getByText('26 件（20 件を表示しています）')).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText('26 件')).toBeVisible()
    expect(movements()).toHaveLength(26)
    expect(movements().at(-1)?.[1]).toBe('+1 tube')
  })

  it('should show a row without movements, and lead to record one', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const emptied = await anotherRow({
      salon: TOKYO,
      productCode: 'COLOR001',
      lotNumber: 'LOT-2026-001',
    })

    // Act
    await openAs(stockMovementsHrefOf(salonId, emptied), STYLIST)

    // Assert
    expect(await screen.findByText('在庫の移動はありません')).toBeVisible()
    expect(
      screen.getAllByRole('link', { name: '在庫の移動を記録する' }),
    ).toHaveLength(2)
  })

  it('should say that a row removed meanwhile is not found, when a movement of it is recorded', async () => {
    // Arrange
    const user = userEvent.setup()
    const emptied = await anotherRow({
      salon: TOKYO,
      productCode: 'COLOR001',
      lotNumber: 'LOT-2026-001',
    })
    await openAs(movementEntryHrefOf(await salonIdOf(TOKYO), emptied), MANAGER)
    await openedEntry()
    await choose(user, '仕入れ')
    await user.type(quantity(), '1')
    await rowRemovedMeanwhile(emptied)

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(await heading('在庫の行が見つかりません')).toBeVisible()
  })

  it.each<[string, (salonId: string, rowId: string) => string]>([
    ['the history', stockMovementsHrefOf],
    ['the form of a movement', movementEntryHrefOf],
  ])(
    'should say that a row of another salon is not found at %s of this one',
    async (_, hrefOf) => {
      // Arrange
      const rowId = await rowIdOf(TOKYO, 'COLOR001')

      // Act
      await openAs(hrefOf(await salonIdOf(OSAKA), rowId), OPERATOR)

      // Assert
      expect(await heading('在庫の行が見つかりません')).toBeVisible()
    },
  )

  it.each<
    [string, (salonId: string, rowId: string) => string, () => Promise<void>]
  >([
    ['the row', stockRowHrefOf, openedRow],
    ['the history', stockMovementsHrefOf, () => openedHistory()],
    ['the form of a movement', movementEntryHrefOf, openedEntry],
  ])(
    'should have no accessibility violations on %s',
    async (_, hrefOf, opened) => {
      // Arrange
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      await openAs(hrefOf(await salonIdOf(TOKYO), rowId), MANAGER)
      await opened()

      // Act
      const violations = await findAccessibilityViolations(document.body)

      // Assert
      expect(violations).toEqual([])
    },
  )
})

describe('the screens of the movements of the stock on a page in English', () => {
  /** Waits for the form of a movement in English: its heading, then its kinds. */
  const theEntryInEnglish = async (): Promise<void> => {
    await heading('Record a stock movement')
    await screen.findByRole('radiogroup', { name: /^Kind/ })
  }

  /** Waits for the history in English: its heading, then its table. */
  const theHistoryInEnglish = async (
    caption = 'Stock movements',
  ): Promise<void> => {
    await heading('Stock movements')
    await screen.findByRole('table', { name: caption })
  }

  const quantityInEnglish = (): HTMLElement =>
    screen.getByRole('textbox', { name: /^Quantity/ })

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should let the stylist record a use from the row, and show it first in the history, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    const lot = (await drawnOf(TOKYO))[1]?.lotNumber ?? ''
    const stylist = await displayNameOf(STYLIST)
    await openAs(stockRowHrefOf(salonId, rowId), STYLIST, 'en')
    await heading('Stock row')
    await user.click(
      await screen.findByRole('link', { name: 'Record a stock movement' }),
    )
    await theEntryInEnglish()
    expect(
      screen.getByText(
        `Hair Color - Natural Brown (lot ${lot}). In stock now: 20 tube, of which 20 tube available.`,
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'Used in a treatment' }))
    await user.type(quantityInEnglish(), '2.5')

    // Act
    await user.click(screen.getByRole('button', { name: 'Record' }))

    // Assert
    expect(
      await screen.findByText(
        'Recorded: Used in a treatment. The stock is now 17.5 tube.',
      ),
    ).toBeInTheDocument()
    await theHistoryInEnglish()
    expect(rowsOf('Stock movements').map((row) => row.slice(1))).toEqual([
      [
        'Used in a treatment',
        '−2.5 tube',
        '17.5 tube',
        'Not recorded',
        'Not recorded',
        stylist,
      ],
      [
        'Adjustment',
        '+20 tube',
        '20 tube',
        'Not recorded',
        '在庫移動の記録を始めた時点の在庫数',
        'Not recorded',
      ],
    ])
    expect(
      screen.getByText(
        `Hair Color - Natural Brown (lot ${lot}). In stock: 17.5 tube.`,
      ),
    ).toBeVisible()
  })

  it('should say in English before sending that no more than what is not reserved may be taken out', async () => {
    // Arrange
    const user = userEvent.setup()
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    await reservedMeanwhile(rowId, 15)
    await openAs(
      movementEntryHrefOf(await salonIdOf(TOKYO), rowId),
      MANAGER,
      'en',
    )
    await theEntryInEnglish()
    await user.click(screen.getByRole('radio', { name: 'Disposal' }))
    await user.type(quantityInEnglish(), '6')
    await user.type(
      screen.getByRole('textbox', { name: /^Reason/ }),
      'Dropped and broken',
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Record' }))

    // Assert
    expect(quantityInEnglish()).toHaveAccessibleDescription(
      'Counted in tube. Up to 2 decimal places. At most 5 tube is available to take out.',
    )
    expect(await storedMovementsOf(rowId)).toHaveLength(1)
  })

  it('should narrow the history to a kind and days, and say when none meet them, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    await recordedEarlier(rowId, [
      {
        transactionType: 'purchase',
        quantity: 10,
        createdAt: '2025-10-05T01:00:00.000Z',
        referenceType: 'purchase_order',
      },
      {
        transactionType: 'use',
        quantity: -3,
        createdAt: '2025-10-20T02:00:00.000Z',
      },
    ])
    await openAs(stockMovementsHrefOf(salonId, rowId), STYLIST, 'en')
    await theHistoryInEnglish()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Kind' }),
      'Purchase',
    )
    await user.type(screen.getByLabelText('Recorded on (from)'), '2025-10-01')
    await user.type(screen.getByLabelText('Recorded on (to)'), '2025-10-31')

    // Act
    await user.click(screen.getByRole('button', { name: 'Show' }))

    // Assert
    await theHistoryInEnglish('Stock movements matching the filters')
    expect(rowsOf('Stock movements matching the filters')).toEqual([
      [
        'Sun, October 5, 2025 at 10:00',
        'Purchase',
        '+10 tube',
        '30 tube',
        'Not recorded',
        'Receipt of a purchase order',
        'Not recorded',
      ],
    ])

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Kind' }),
      'Disposal',
    )
    await user.click(screen.getByRole('button', { name: 'Show' }))

    // Assert
    expect(
      await screen.findByText('No stock movements match these filters'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Clear filters' })).toBeVisible()
  })
})
