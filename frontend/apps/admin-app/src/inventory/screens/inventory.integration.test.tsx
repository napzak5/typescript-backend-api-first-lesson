import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  salonIdOf,
  signInAs,
} from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  optionsOf,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import {
  bookingsHrefOf,
  inventoryHrefOf,
  stockEntryHrefOf,
  stockRowChangeHrefOf,
  stockRowHrefOf,
} from '../../navigation'
import {
  droppedMeanwhile,
  productIdOf,
} from '../../products/__tests__/arrangements'
import {
  anotherRow,
  drawnOf,
  expiringOn,
  lotsKeptMeanwhile,
  minimumOf,
  padRowsOf,
  rowIdOf,
  rowRemovedMeanwhile,
  storedRowsOf,
} from '../__tests__/arrangements'
import { expiryNameOf } from '../utils/stock-format'

/*
 * The stock of a salon, read and kept against the API. The salon in Tokyo
 * of the seed data keeps a row of each of six products, all but the wax:
 * 20 of each, of a lot of its own, which expired on 31 December 2025, in
 * Storage Room A. Its owner and its manager keep the rows, its stylist
 * reads them. Somebody did something meanwhile where a test says so.
 */

/** Waits for the stock: its heading comes first, the table once the rows and their products were read. */
const openedStock = async (caption = '在庫'): Promise<void> => {
  await heading('在庫')
  await screen.findByRole('table', { name: caption })
}

/** Waits for a row: its heading comes first, the record once the row was read. */
const openedRow = async (): Promise<void> => {
  await heading('在庫の行')
  await screen.findByRole('region', { name: '在庫' })
}

/** Waits for the form of a new row: its heading comes first, the form once the products were read. */
const openedEntry = async (): Promise<void> => {
  await heading('在庫の行を足す')
  await screen.findByRole('combobox', { name: /^商品/ })
}

/** Waits for the form of a row: its heading comes first, the form once the row was read. */
const openedChange = async (): Promise<void> => {
  await heading('在庫の行を直す')
  await screen.findByRole('textbox', { name: '保管場所' })
}

/** What a card of the record of a row says, term by term. */
const terms = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

const lot = (): HTMLElement => text(/^ロット番号/)

const product = (): HTMLElement =>
  screen.getByRole('combobox', { name: /^商品/ })

const EXPIRED = '2025年12月31日 期限切れ'

/** The products of the rows of the seed, in the order of their codes, with their units */
const SEEDED_PRODUCTS: [string, string, string][] = [
  ['BLEACH001', 'Lightening Powder 500g', 'box'],
  ['COLOR001', 'Hair Color - Natural Brown', 'tube'],
  ['COND001', 'Professional Conditioner 500ml', 'bottle'],
  ['DEVELOPER001', 'Developer 6% 1000ml', 'bottle'],
  ['SHMP001', 'Professional Shampoo 500ml', 'bottle'],
  ['TREAT001', 'Intensive Hair Mask 250ml', 'jar'],
]

/** The rows of the seed as the table shows them: their lots and shelves were drawn at random. */
const seededRows = async (): Promise<string[][]> => {
  const drawn = await drawnOf(TOKYO)

  return SEEDED_PRODUCTS.map(([code, name, unit], index) => [
    code,
    name,
    drawn[index]?.lotNumber ?? '',
    EXPIRED,
    `Storage Room A（棚 ${drawn[index]?.shelf ?? ''}）`,
    `20 ${unit}`,
  ])
}

/** The lot the seed drew for the row of the colour */
const colourLot = async (): Promise<string> =>
  (await drawnOf(TOKYO))[1]?.lotNumber ?? ''

const LOT_TAKEN =
  'このロット番号の在庫の行は、この商品にすでにあります。同じロットの在庫は、その行で記録してください。'

describe('the stock screens', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead the stylist from the header to the stock and to a row, and offer no change', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const lotOfColour = await colourLot()
    await openAs(bookingsHrefOf(salonId), STYLIST)
    await heading('予約台帳')

    // Act
    await user.click(
      within(
        await screen.findByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: '在庫' }),
    )

    // Assert
    await openedStock()
    expect(firstSight()[0]).toBe(inventoryHrefOf(salonId))
    expect(rowsOf('在庫')).toEqual(await seededRows())
    expect(screen.getByText('6 行')).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: '在庫の見かた' }))
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('aria-current')]),
    ).toEqual([
      ['すべて', 'page'],
      ['在庫僅少', null],
      ['期限切れ間近', null],
    ])
    expect(
      screen.queryByRole('link', { name: '在庫の行を足す' }),
    ).not.toBeInTheDocument()

    // Act
    await user.click(
      screen.getByRole('link', { name: 'Hair Color - Natural Brown' }),
    )

    // Assert
    await openedRow()
    expect(terms('在庫の行')).toEqual([
      ['商品', 'Hair Color - Natural Brown（COLOR001）'],
      ['ロット番号', lotOfColour],
      ['使用期限', EXPIRED],
      ['保管場所', 'Storage Room A'],
      ['棚', (await drawnOf(TOKYO))[1]?.shelf ?? ''],
      ['メモ', '記録なし'],
    ])
    expect(terms('在庫')).toEqual([
      ['在庫数', '20 tube'],
      ['引き当てた数', '0 tube'],
      ['使える数', '20 tube'],
      ['最後の棚卸し', '棚卸ししていません'],
    ])
    expect(
      screen.queryByRole('link', { name: '在庫の行を直す' }),
    ).not.toBeInTheDocument()
  })

  it('should narrow the rows to a product and a lot, keep them in the address, and say when none meet them', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const colourId = await productIdOf(TOKYO, 'COLOR001')
    await openAs(inventoryHrefOf(salonId), STYLIST)
    await openedStock()

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '商品' }),
      'Hair Color - Natural Brown（COLOR001）',
    )
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await openedStock('条件に合う在庫の行')
    expect(rowsOf('条件に合う在庫の行').map(([code]) => code)).toEqual([
      'COLOR001',
    ])
    expect(firstSight()[0]).toBe(
      `${inventoryHrefOf(salonId)}?product=${colourId}`,
    )

    // Act
    await user.type(text('ロット番号'), 'NO-SUCH-LOT')
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(
      await screen.findByText('条件に合う在庫の行はありません'),
    ).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(firstSight()[0]).toBe(
      `${inventoryHrefOf(salonId)}?product=${colourId}&lot=NO-SUCH-LOT`,
    )

    // Act
    await user.click(screen.getByRole('link', { name: '条件を外す' }))

    // Assert
    await screen.findByText('6 行')
    expect(rowsOf('在庫')).toEqual(await seededRows())
    expect(screen.getByRole('combobox', { name: '商品' })).toHaveValue('')
  })

  it('should say that no product is low in stock when every product is above its minimum', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await openedStock()

    // Act
    await user.click(screen.getByRole('link', { name: '在庫僅少' }))

    // Assert
    expect(await screen.findByText('在庫僅少の商品はありません')).toBeVisible()
    expect(
      screen.getByText(
        '取り扱い中の商品のうち、すべてのロットを合わせた在庫数が最低在庫数以下の商品の、在庫の行です。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('should show every row of a product whose stock, all its lots together, is at its minimum', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await minimumOf(TOKYO, 'COLOR001', 20)
    await anotherRow({
      salon: TOKYO,
      productCode: 'COLOR001',
      lotNumber: 'LOT-2026-001',
    })
    await openAs(inventoryHrefOf(salonId), STYLIST)
    await openedStock()

    // Act
    await user.click(screen.getByRole('link', { name: '在庫僅少' }))

    // Assert
    await openedStock('在庫僅少')
    expect(
      rowsOf('在庫僅少').map(([code, , lotNumber, , , stock]) => [
        code,
        lotNumber,
        stock,
      ]),
    ).toEqual([
      ['COLOR001', await colourLot(), '20 tube'],
      ['COLOR001', 'LOT-2026-001', '0 tube'],
    ])
    expect(firstSight()[0]).toBe(`${inventoryHrefOf(salonId)}?view=low-stock`)
  })

  it('should show the rows that expire within the window chosen, those expired first, and keep it in the address', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const today = await dayFromToday(0)
    const inFive = await dayFromToday(5)
    await expiringOn(TOKYO, 'COLOR001', today)
    await expiringOn(TOKYO, 'COND001', inFive)
    await expiringOn(TOKYO, 'SHMP001', await dayFromToday(20))
    await expiringOn(TOKYO, 'DEVELOPER001', await dayFromToday(60))
    await expiringOn(TOKYO, 'BLEACH001', null)
    await openAs(inventoryHrefOf(salonId), STYLIST)
    await openedStock()

    // Act
    await user.click(screen.getByRole('link', { name: '期限切れ間近' }))

    // Assert
    await openedStock('期限切れ間近')
    expect(
      rowsOf('期限切れ間近').map(([code, , , expiry]) => [code, expiry]),
    ).toEqual([
      ['TREAT001', EXPIRED],
      ['COLOR001', expiryNameOf(today)],
      ['COND001', expiryNameOf(inFive)],
      ['SHMP001', expiryNameOf(await dayFromToday(20))],
    ])
    expect(firstSight()[0]).toBe(`${inventoryHrefOf(salonId)}?view=expiring`)
    expect(screen.getByRole('combobox', { name: '使用期限' })).toHaveValue('30')

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '使用期限' }),
      '7 日後まで',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await screen.findByText('3 行')
    expect(rowsOf('期限切れ間近').map(([code]) => code)).toEqual([
      'TREAT001',
      'COLOR001',
      'COND001',
    ])
    expect(firstSight()[0]).toBe(
      `${inventoryHrefOf(salonId)}?view=expiring&days=7`,
    )

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '使用期限' }),
      '今日まで',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await screen.findByText('2 行')
    expect(rowsOf('期限切れ間近').map(([code]) => code)).toEqual([
      'TREAT001',
      'COLOR001',
    ])
  })

  it('should go on with the rows that come next, and take the focus to the first of them', async () => {
    // Arrange
    const user = userEvent.setup()
    await padRowsOf(TOKYO, 20)
    await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await openedStock()
    expect(screen.getByText('26 行（20 行を表示しています）')).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    await screen.findByText('26 行')
    const read = rowsOf('在庫')
    expect(read).toHaveLength(26)
    expect(read.slice(19, 21).map(([code]) => code)).toEqual(['PAD16', 'PAD17'])
    expect(screen.getByRole('link', { name: 'Cotton Pad 17' })).toHaveFocus()
  })

  it('should add a row of a carried product without lots, lead to it, and read the stock anew', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await droppedMeanwhile(TOKYO, 'TREAT001')
    await openAs(inventoryHrefOf(salonId), OWNER)
    await openedStock()
    await user.click(screen.getByRole('link', { name: '在庫の行を足す' }))
    await openedEntry()
    expect(optionsOf(product())).toEqual([
      '選んでください',
      'Lightening Powder 500g（BLEACH001）',
      'Hair Color - Natural Brown（COLOR001）',
      'Professional Conditioner 500ml（COND001）',
      'Developer 6% 1000ml（DEVELOPER001）',
      'Professional Shampoo 500ml（SHMP001）',
      'Styling Wax 80g（WAX001）',
    ])
    await user.selectOptions(product(), 'Styling Wax 80g（WAX001）')
    await user.type(text('保管場所'), 'Front Shelf')
    await user.type(text('棚'), 'F-1')
    await user.type(text('メモ'), '見本は数えない')

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    await openedRow()
    expect(
      await screen.findByText('在庫の行「Styling Wax 80g」を足しました。'),
    ).toBeInTheDocument()
    const added = await rowIdOf(TOKYO, 'WAX001')
    // What the record alone says
    expect(firstSight()).toEqual([
      stockRowHrefOf(salonId, added),
      expect.stringContaining('棚卸ししていません'),
    ])
    expect(terms('在庫の行')).toEqual([
      ['商品', 'Styling Wax 80g（WAX001）'],
      ['ロット番号', '記録なし'],
      ['使用期限', '期限なし'],
      ['保管場所', 'Front Shelf'],
      ['棚', 'F-1'],
      ['メモ', '見本は数えない'],
    ])
    expect(terms('在庫')[0]).toEqual(['在庫数', '0 jar'])
    expect((await storedRowsOf(TOKYO)).at(-1)).toEqual({
      productCode: 'WAX001',
      currentStock: '0.00',
      lotNumber: null,
      expiryDate: null,
      location: 'Front Shelf',
      shelf: 'F-1',
      notes: '見本は数えない',
    })

    // Act
    await user.click(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: '在庫' }),
    )

    // Assert: the rows read before the entry are not shown again, they are read anew
    expect(firstSight()).toEqual([
      inventoryHrefOf(salonId),
      expect.not.stringContaining('6 行'),
    ])
    await openedStock()
    expect(screen.getByText('7 行')).toBeVisible()
    expect(rowsOf('在庫').map(([code]) => code)).toContain('WAX001')
  })

  it('should add a lot of a product kept by lots, after saying at the lot that another row has it', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedRowsOf(TOKYO)
    await openAs(stockEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedEntry()
    await user.selectOptions(
      product(),
      'Hair Color - Natural Brown（COLOR001）',
    )
    await user.type(lot(), await colourLot())

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(await screen.findByText(LOT_TAKEN)).toBeInTheDocument()
    expect(lot()).toHaveAccessibleDescription(
      expect.stringContaining(LOT_TAKEN),
    )
    expect(lot()).toHaveFocus()
    expect(await storedRowsOf(TOKYO)).toEqual(before)

    // Act
    await user.clear(lot())
    await user.type(lot(), 'LOT-2026-050')
    await user.type(screen.getByLabelText('使用期限'), '2027-06-30')
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    await openedRow()
    expect(terms('在庫の行').slice(1, 3)).toEqual([
      ['ロット番号', 'LOT-2026-050'],
      ['使用期限', '2027年6月30日'],
    ])
    expect(
      (await storedRowsOf(TOKYO)).filter(
        ({ lotNumber }) => lotNumber === 'LOT-2026-050',
      ),
    ).toEqual([
      {
        productCode: 'COLOR001',
        currentStock: '0.00',
        lotNumber: 'LOT-2026-050',
        expiryDate: '2027-06-30',
        location: null,
        shelf: null,
        notes: null,
      },
    ])
  })

  it('should say above the form that the product has a row without a lot already', async () => {
    // Arrange
    const user = userEvent.setup()
    await anotherRow({ salon: TOKYO, productCode: 'WAX001', lotNumber: null })
    const before = await storedRowsOf(TOKYO)
    await openAs(stockEntryHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedEntry()
    await user.selectOptions(product(), 'Styling Wax 80g（WAX001）')

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ロット番号のない在庫の行は、この商品にすでにあります。ロット番号のない在庫は、その行で記録してください。',
    )
    expect(await storedRowsOf(TOKYO)).toEqual(before)
  })

  it('should say what is wrong before sending a new row, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedRowsOf(TOKYO)
    await openAs(stockEntryHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedEntry()

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(product()).toHaveAccessibleDescription(
      expect.stringContaining('商品を選んでください。'),
    )
    expect(product()).toHaveFocus()

    // Act
    await user.selectOptions(
      product(),
      'Hair Color - Natural Brown（COLOR001）',
    )
    await user.type(text('棚'), 'S'.repeat(51))
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(lot()).toHaveAccessibleDescription(
      expect.stringContaining(
        'ロット番号を、100 文字以内で入力してください。この商品は、在庫をロット番号で分けます。',
      ),
    )
    expect(lot()).toHaveFocus()
    expect(text('棚')).toHaveAccessibleDescription(
      expect.stringContaining('棚は、50 文字以内で入力してください。'),
    )
    expect(await storedRowsOf(TOKYO)).toEqual(before)
  })

  it('should follow a product marked as kept by lots meanwhile, and ask for its lot', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockEntryHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedEntry()
    await user.selectOptions(product(), 'Styling Wax 80g（WAX001）')
    expect(
      screen.queryByRole('textbox', { name: /^ロット番号/ }),
    ).not.toBeInTheDocument()
    await lotsKeptMeanwhile(TOKYO, 'WAX001', true)

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'この商品の「在庫をロット番号で分ける」の印が、変わっていました。いまの印で読み直したので、ロット番号を確かめて、もう一度お試しください。',
    )
    expect(
      await screen.findByRole('textbox', { name: /^ロット番号/ }),
    ).toBeRequired()

    // Act
    await user.type(lot(), 'LOT-W-1')
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    await openedRow()
    expect(terms('在庫の行')[1]).toEqual(['ロット番号', 'LOT-W-1'])
  })

  it('should change what a row keeps, and send nothing when nothing was changed', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const lotOfColour = await colourLot()
    const rowId = await rowIdOf(TOKYO, 'COLOR001')
    await openAs(stockRowHrefOf(salonId, rowId), OWNER)
    await openedRow()
    await user.click(screen.getByRole('link', { name: '在庫の行を直す' }))
    await openedChange()
    expect(
      screen.getByText('Hair Color - Natural Brown（COLOR001）'),
    ).toBeVisible()
    expect(lot()).toHaveValue(lotOfColour)
    expect(lot()).toBeRequired()
    await user.clear(text('棚'))
    await user.type(text('棚'), 'B-1')
    await user.type(text('メモ'), '開封済みから使う')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await openedRow()
    expect(
      await screen.findByText(
        `在庫の行「Hair Color - Natural Brown（ロット ${lotOfColour}）」を直しました。`,
      ),
    ).toBeInTheDocument()
    // What the API answered is shown at once, before the row is read again
    expect(firstSight()).toEqual([
      stockRowHrefOf(salonId, rowId),
      expect.stringContaining('開封済みから使う'),
    ])
    expect(terms('在庫の行').slice(4)).toEqual([
      ['棚', 'B-1'],
      ['メモ', '開封済みから使う'],
    ])
    expect((await storedRowsOf(TOKYO))[1]).toEqual({
      productCode: 'COLOR001',
      currentStock: '20.00',
      lotNumber: lotOfColour,
      expiryDate: '2025-12-31',
      location: 'Storage Room A',
      shelf: 'B-1',
      notes: '開封済みから使う',
    })

    // Act
    await user.click(screen.getByRole('link', { name: '在庫の行を直す' }))
    await openedChange()
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeInTheDocument()
    await openedRow()
  })

  it('should say at the lot that another row of the product has it', async () => {
    // Arrange
    const user = userEvent.setup()
    await anotherRow({
      salon: TOKYO,
      productCode: 'COLOR001',
      lotNumber: 'LOT-2026-001',
    })
    const before = await storedRowsOf(TOKYO)
    await openAs(
      stockRowChangeHrefOf(
        await salonIdOf(TOKYO),
        await rowIdOf(TOKYO, 'COLOR001', await colourLot()),
      ),
      MANAGER,
    )
    await openedChange()
    await user.clear(lot())
    await user.type(lot(), 'LOT-2026-001')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await screen.findByText(LOT_TAKEN)).toBeInTheDocument()
    expect(lot()).toHaveFocus()
    expect(await storedRowsOf(TOKYO)).toEqual(before)
  })

  it('should let the lot of a product no longer kept by lots be cleared', async () => {
    // Arrange
    const user = userEvent.setup()
    await lotsKeptMeanwhile(TOKYO, 'COLOR001', false)
    await openAs(
      stockRowChangeHrefOf(
        await salonIdOf(TOKYO),
        await rowIdOf(TOKYO, 'COLOR001'),
      ),
      OWNER,
    )
    await openedChange()
    expect(lot()).not.toBeRequired()
    expect(lot()).toHaveAccessibleDescription(
      'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。',
    )
    await user.clear(lot())

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await openedRow()
    expect(terms('在庫の行')[1]).toEqual(['ロット番号', '記録なし'])
    expect((await storedRowsOf(TOKYO))[1]?.lotNumber).toBeNull()
  })

  it('should remove a row that counts no stock, after asking', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const emptied = await anotherRow({
      salon: TOKYO,
      productCode: 'COLOR001',
      lotNumber: 'LOT-2026-001',
    })
    await openAs(inventoryHrefOf(salonId), OWNER)
    await openedStock()
    expect(screen.getByText('7 行')).toBeVisible()
    await user.click(
      within(screen.getByRole('row', { name: /LOT-2026-001/ })).getByRole(
        'link',
        { name: 'Hair Color - Natural Brown' },
      ),
    )
    await openedRow()
    await user.click(screen.getByRole('link', { name: '在庫の行を直す' }))
    await openedChange()
    expect(firstSight()[0]).toBe(stockRowChangeHrefOf(salonId, emptied))
    await user.click(screen.getByRole('button', { name: '削除' }))
    const dialog = screen.getByRole('dialog', {
      name: '在庫の行「Hair Color - Natural Brown（ロット LOT-2026-001）」を削除しますか？',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText(
        '在庫の行「Hair Color - Natural Brown（ロット LOT-2026-001）」を削除しました。',
      ),
    ).toBeInTheDocument()
    // The rows read before the removal are not shown again, they are read anew
    await waitFor(() => expect(firstSight()[0]).toBe(inventoryHrefOf(salonId)))
    expect(firstSight()).toEqual([
      inventoryHrefOf(salonId),
      expect.not.stringContaining('7 行'),
    ])
    await openedStock()
    expect(rowsOf('在庫')).toEqual(await seededRows())
    expect(
      (await storedRowsOf(TOKYO)).map(({ lotNumber }) => lotNumber),
    ).not.toContain('LOT-2026-001')
  })

  it('should keep a row that counts stock, and say to bring it to 0 first', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedRowsOf(TOKYO)
    await openAs(
      stockRowChangeHrefOf(
        await salonIdOf(TOKYO),
        await rowIdOf(TOKYO, 'SHMP001'),
      ),
      OWNER,
    )
    await openedChange()
    await user.click(screen.getByRole('button', { name: '削除' }))

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '削除する',
      }),
    )

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      `在庫の行「Professional Shampoo 500ml（ロット ${(await drawnOf(TOKYO))[4]?.lotNumber ?? ''}）」は、在庫数が 0 でないので、削除できません。在庫の移動で在庫数を 0 にしてから、削除してください。`,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await storedRowsOf(TOKYO)).toEqual(before)
  })

  it('should say that a row removed meanwhile is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    const emptied = await anotherRow({
      salon: TOKYO,
      productCode: 'COLOR001',
      lotNumber: 'LOT-2026-001',
    })
    await openAs(stockRowChangeHrefOf(await salonIdOf(TOKYO), emptied), MANAGER)
    await openedChange()
    await user.type(text('棚'), 'C-1')
    await rowRemovedMeanwhile(emptied)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await heading('在庫の行が見つかりません')).toBeInTheDocument()
  })

  it.each<[string, (salonId: string, rowId: string) => string]>([
    ['the entry', (salonId) => stockEntryHrefOf(salonId)],
    ['the change', stockRowChangeHrefOf],
  ])(
    'should tell the stylist that %s of a row is not theirs to make',
    async (_case, hrefOf) => {
      // Act
      await openAs(
        hrefOf(await salonIdOf(TOKYO), await rowIdOf(TOKYO, 'SHMP001')),
        STYLIST,
      )

      // Assert
      expect(
        await screen.findByText(
          'このアカウントでは、在庫の行を変えられません。在庫の行を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
        ),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('textbox', { name: '保管場所' }),
      ).not.toBeInTheDocument()
    },
  )

  it('should tell the manager of another salon that its stock is not theirs to see', async () => {
    // Act
    await openAs(inventoryHrefOf(await salonIdOf(OSAKA)), MANAGER)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの在庫は、見られません。在庫を見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each<[string, string, (osaka: string, tokyo: string) => string]>([
    ['the manager of another salon', MANAGER, (osaka) => osaka],
    ['an administrator, below another salon', OPERATOR, (_, tokyo) => tokyo],
  ])(
    'should not show %s a row of the salon in Osaka',
    async (_case, email, salonOf) => {
      // Arrange
      const row = await anotherRow({
        salon: OSAKA,
        productCode: 'SPA001',
        lotNumber: 'LOT-OSAKA-1',
      })

      // Act
      await openAs(
        stockRowHrefOf(
          salonOf(await salonIdOf(OSAKA), await salonIdOf(TOKYO)),
          row,
        ),
        email,
      )

      // Assert
      expect(await heading('在庫の行が見つかりません')).toBeInTheDocument()
    },
  )

  it.each<[string, string]>([
    ['an ID of no row', '0b0c4a39-5b5f-4f0e-8d5a-0c0a5e0d9999'],
    ['no ID at all', 'row'],
  ])(
    'should say that there is no row at an address with %s',
    async (_case, rowId) => {
      // Act
      await openAs(stockRowHrefOf(await salonIdOf(TOKYO), rowId), STYLIST)

      // Assert
      expect(await heading('在庫の行が見つかりません')).toBeInTheDocument()
    },
  )

  it.each<
    [string, (salonId: string, rowId: string) => string, () => Promise<void>]
  >([
    ['the stock', (salonId) => inventoryHrefOf(salonId), () => openedStock()],
    [
      'the rows that expire soon',
      (salonId) => `${inventoryHrefOf(salonId)}?view=expiring`,
      () => openedStock('期限切れ間近'),
    ],
    ['a row', stockRowHrefOf, openedRow],
    ['the entry', (salonId) => stockEntryHrefOf(salonId), openedEntry],
    ['the change', stockRowChangeHrefOf, openedChange],
  ])(
    'should have no accessibility violations on %s',
    async (_case, hrefOf, opened) => {
      // Arrange
      const { container } = renderAt(
        hrefOf(await salonIdOf(TOKYO), await rowIdOf(TOKYO, 'COLOR001')),
      )
      await signInAs(OWNER)

      // Act
      await opened()

      // Assert
      expect(await findAccessibilityViolations(container)).toEqual([])
    },
  )
})
