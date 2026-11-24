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
  OWNER,
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
  stockCountHrefOf,
  stockRowHrefOf,
  stockValueHrefOf,
} from '../../navigation'
import {
  countsOf,
  displayNameOf,
  drawnOf,
  reservedMeanwhile,
  rowIdOf,
  rowRemovedMeanwhile,
  storedMovementsOf,
} from '../__tests__/arrangements'
import { openedCount, openedValue } from '../__tests__/screens'

/*
 * The count of the stock and its value, against the API. The salon in
 * Tokyo of the seed data keeps a row of each of six products, 20 of each:
 * the shampoo and the conditioner of its hair care at ￥1,500, its mask at
 * ￥2,000, and the colour, the powder and the developer of its colours at
 * ￥800, ￥1,200 and ￥500. Its owner and its manager count it and see its
 * value; its stylist does neither. The salon in Osaka keeps no stock.
 * Somebody did something meanwhile where a test says so.
 */

/** The control of what was counted of the row of a product, named by the product and the lot the seed drew */
const counted = (product: string): HTMLElement =>
  screen.getByRole('textbox', { name: new RegExp(`^${product}`) })

const COLOUR = 'Hair Color - Natural Brown'
const SHAMPOO = 'Professional Shampoo 500ml'
const POWDER = 'Lightening Powder 500g'

const DIFFERED = '帳簿の在庫数と差のあった行'

/** What the record of a row says of its last count, once the row was read */
const lastCount = async (): Promise<string | null | undefined> =>
  within(await screen.findByRole('region', { name: '在庫' }))
    .getAllByRole('term')
    .find((term) => term.textContent === '最後の棚卸し')?.nextElementSibling
    ?.textContent

const BELOW_RESERVED =
  '数えた数が、引き当てた数を下回る行があります。その間に在庫が引き当てられました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。'

/** The rows of the salon in Tokyo the seed left, none of them counted */
const UNCOUNTED = [
  'BLEACH001',
  'COLOR001',
  'COND001',
  'DEVELOPER001',
  'SHMP001',
  'TREAT001',
].map((productCode) => ({
  productCode,
  currentStock: '20.00',
  availableStock: '20.00',
  counted: false,
  countedBy: null,
}))

describe('the screens of the count and the value of the stock', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should let the manager count some rows from the stock, say the rows that differed, and read the stock anew', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const colourRow = await rowIdOf(TOKYO, 'COLOR001')
    const lot = (await drawnOf(TOKYO))[1]?.lotNumber ?? ''
    const manager = await displayNameOf(MANAGER)
    await openAs(stockRowHrefOf(salonId, colourRow), MANAGER)
    expect(await lastCount()).toBe('棚卸ししていません')
    await user.click(screen.getByRole('link', { name: '在庫へ' }))
    await heading('在庫')
    await screen.findByRole('table', { name: '在庫' })
    await user.click(screen.getByRole('link', { name: '棚卸しする' }))
    await openedCount()
    expect(counted(COLOUR)).toHaveAccessibleDescription(
      /^帳簿の在庫数 20 tube、保管場所 Storage Room A/,
    )

    // Act
    await user.type(counted(COLOUR), '18')
    await user.type(counted(SHAMPOO), '20')
    await user.type(
      screen.getByRole('textbox', { name: '理由' }),
      '月末の棚卸し',
    )
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(
      await screen.findByText(
        '2 行の棚卸しを記録しました。帳簿の在庫数と差のあった行は 1 行です。',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 1, name: '棚卸し' }),
    ).toHaveFocus()
    expect(rowsOf(DIFFERED)).toEqual([
      [`${COLOUR}（ロット ${lot}）`, '20 tube', '18 tube', '−2 tube'],
    ])
    expect(await countsOf(TOKYO)).toEqual(
      UNCOUNTED.map((row) =>
        row.productCode === 'COLOR001'
          ? {
              ...row,
              currentStock: '18.00',
              availableStock: '18.00',
              counted: true,
              countedBy: manager,
            }
          : row.productCode === 'SHMP001'
            ? { ...row, counted: true, countedBy: manager }
            : row,
      ),
    )
    expect((await storedMovementsOf(colourRow))[0]).toEqual({
      transactionType: 'adjustment',
      quantity: '-2.00',
      balanceAfter: '18.00',
      unitCost: null,
      totalCost: null,
      reason: '月末の棚卸し',
      performedBy: await staffIdOf(manager),
    })

    // Act
    await user.click(screen.getByRole('link', { name: '在庫へ' }))

    // Assert: the stock that was read before the count is not shown
    await heading('在庫')
    expect(firstSight()[1]).not.toContain('tube')
    expect(
      rowsOf(await screen.findByRole('table', { name: '在庫' })).find(
        ([code]) => code === 'COLOR001',
      ),
    ).toContain('18 tube')

    // Act
    await user.click(screen.getByRole('link', { name: COLOUR }))

    // Assert: the row that was read before the count is not shown, and names who counted it
    await heading('在庫の行')
    expect(firstSight()[1]).not.toContain('棚卸ししていません')
    await waitFor(async () =>
      expect(await lastCount()).toMatch(new RegExp(`（${manager}）$`)),
    )
  })

  it('should let the owner go on counting, with the rows read anew', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedCount()
    await user.type(counted(COLOUR), '19')
    await user.click(screen.getByRole('button', { name: '記録する' }))
    await screen.findByRole('table', { name: DIFFERED })

    // Act
    await user.click(screen.getByRole('button', { name: '続けて棚卸しする' }))

    // Assert
    await screen.findByRole('textbox', { name: new RegExp(`^${COLOUR}`) })
    expect(
      screen.getByRole('heading', { level: 1, name: '棚卸し' }),
    ).toHaveFocus()
    await waitFor(() =>
      expect(counted(COLOUR)).toHaveAccessibleDescription(
        /^帳簿の在庫数 19 tube、/,
      ),
    )
    expect(counted(COLOUR)).toHaveValue('')

    // Act: the same as the books
    await user.type(counted(COLOUR), '19')
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(
      await screen.findByText(
        '数えたどの行も、帳簿の在庫数と同じでした。在庫数は変わりません。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('table', { name: DIFFERED })).toBeNull()
    expect(
      (await countsOf(TOKYO)).find(
        ({ productCode }) => productCode === 'COLOR001',
      ),
    ).toEqual({
      productCode: 'COLOR001',
      currentStock: '19.00',
      availableStock: '19.00',
      counted: true,
      countedBy: await displayNameOf(OWNER),
    })
  })

  it('should record the count of an administrator under no member of the staff', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), OPERATOR)
    await openedCount()

    // Act
    await user.type(counted(POWDER), '21.5')
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    await screen.findByRole('table', { name: DIFFERED })
    expect((await countsOf(TOKYO))[0]).toEqual({
      productCode: 'BLEACH001',
      currentStock: '21.50',
      availableStock: '21.50',
      counted: true,
      countedBy: null,
    })

    // Act
    await user.click(
      screen.getByRole('link', { name: new RegExp(`^${POWDER}`) }),
    )

    // Assert: the row names nobody who counted it
    await heading('在庫の行')
    expect(await lastCount()).toMatch(
      /^\d{4}年\d{1,2}月\d{1,2}日（.） \d{2}:\d{2}$/,
    )
  })

  it('should say what is wrong under the rows before sending, and count nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await reservedMeanwhile(await rowIdOf(TOKYO, 'SHMP001'), 5)
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedCount()
    expect(counted(SHAMPOO)).toHaveAccessibleDescription(
      /^帳簿の在庫数 20 bottle（うち引き当て 5 bottle）、/,
    )

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(counted(POWDER)).toHaveAccessibleDescription(
      /数えた行がありません。数えた行に、数えた数を入力してください。/,
    )
    expect(counted(POWDER)).toHaveFocus()

    // Act
    await user.type(counted(SHAMPOO), '4.99')
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(counted(SHAMPOO)).toHaveAccessibleDescription(
      /引き当てた数の 5 bottle を下回ります。引き当てた在庫も、数えた数に入れてください。/,
    )
    expect(counted(SHAMPOO)).toHaveFocus()
    expect(counted(POWDER)).not.toHaveAccessibleDescription(
      /数えた行がありません/,
    )
    expect((await countsOf(TOKYO)).map(({ counted: was }) => was)).toEqual(
      UNCOUNTED.map(() => false),
    )
  })

  it('should read the rows anew when stock was reserved meanwhile, and keep the counts entered', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedCount()
    await user.type(counted(COLOUR), '18')
    await user.type(counted(SHAMPOO), '3')
    await reservedMeanwhile(await rowIdOf(TOKYO, 'SHMP001'), 5)

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(await screen.findByText(BELOW_RESERVED)).toBeVisible()
    await waitFor(() =>
      expect(counted(SHAMPOO)).toHaveAccessibleDescription(
        /^帳簿の在庫数 20 bottle（うち引き当て 5 bottle）、/,
      ),
    )
    expect(counted(COLOUR)).toHaveValue('18')
    expect(counted(SHAMPOO)).toHaveValue('3')
    expect((await countsOf(TOKYO)).map(({ counted: was }) => was)).toEqual(
      UNCOUNTED.map(() => false),
    )
  })

  it('should read the rows anew when a row was removed meanwhile, and count the others', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedCount()
    await user.type(counted(COLOUR), '18')
    await user.type(counted(SHAMPOO), '19')
    await rowRemovedMeanwhile(await rowIdOf(TOKYO, 'COLOR001'))

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(
      await screen.findByText(
        '数えた在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
      ),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: new RegExp(`^${COLOUR}`) }),
      ).toBeNull(),
    )
    expect(counted(SHAMPOO)).toHaveValue('19')

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(
      await screen.findByText(
        '1 行の棚卸しを記録しました。帳簿の在庫数と差のあった行は 1 行です。',
      ),
    ).toBeVisible()
  })

  it('should offer neither the count nor the value to the stylist', async () => {
    // Act
    await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await heading('在庫')
    await screen.findByRole('table', { name: '在庫' })

    // Assert
    expect(screen.queryByRole('link', { name: '棚卸しする' })).toBeNull()
    expect(screen.queryByRole('link', { name: '在庫評価額' })).toBeNull()
  })

  it.each<[string, (salonId: string) => string, string, string]>([
    [
      'the count',
      stockCountHrefOf,
      '棚卸し',
      'このアカウントでは、棚卸しを記録できません。棚卸しを記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'the value',
      stockValueHrefOf,
      '在庫評価額',
      'このアカウントでは、在庫評価額を見られません。在庫評価額を見られるのは、サロンのオーナーとマネージャーと、管理者です。',
    ],
  ])(
    'should say to the stylist who may see %s',
    async (_, hrefOf, title, message) => {
      // Act
      await openAs(hrefOf(await salonIdOf(TOKYO)), STYLIST)

      // Assert
      await heading(title)
      expect(await screen.findByText(message)).toBeVisible()
      expect(screen.getByRole('link', { name: '在庫へ戻る' })).toBeVisible()
    },
  )

  it.each<[string, (salonId: string) => string, string]>([
    ['the count', stockCountHrefOf, '棚卸し'],
    ['the value', stockValueHrefOf, '在庫評価額'],
  ])(
    'should say that %s of another salon cannot be seen',
    async (_, hrefOf, title) => {
      // Act
      await openAs(hrefOf(await salonIdOf(OSAKA)), MANAGER)

      // Assert
      await heading(title)
      expect(
        await screen.findByText(
          'このサロンの在庫は、見られません。在庫を見られるのは、そのサロンのスタッフと、管理者です。',
        ),
      ).toBeVisible()
    },
  )

  it('should show the value of the stock by categories, and read it anew after a count', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), OWNER)
    await heading('在庫')

    // Act
    await user.click(await screen.findByRole('link', { name: '在庫評価額' }))

    // Assert
    await openedValue()
    expect(
      screen.getByText(
        '在庫評価額の合計は ￥150,000（6 品目）です。在庫数に商品の仕入価格を掛けた額で、仕入価格のない商品は 0 円として数えます。',
      ),
    ).toBeVisible()
    expect(rowsOf('カテゴリーごとの在庫評価額')).toEqual([
      ['Hair Care', '2 品目', '￥60,000'],
      ['Hair Color', '3 品目', '￥50,000'],
      ['Hair Treatment', '1 品目', '￥40,000'],
    ])

    // Act
    await user.click(screen.getByRole('link', { name: '在庫へ' }))
    await user.click(await screen.findByRole('link', { name: '棚卸しする' }))
    await openedCount()
    await user.type(counted(COLOUR), '10')
    await user.click(screen.getByRole('button', { name: '記録する' }))
    await screen.findByRole('table', { name: DIFFERED })
    await user.click(screen.getByRole('link', { name: '在庫へ' }))
    await user.click(await screen.findByRole('link', { name: '在庫評価額' }))

    // Assert: the value read before the count is not shown
    await openedValue()
    expect(firstSight()[1]).not.toContain('￥150,000')
    expect(rowsOf('カテゴリーごとの在庫評価額')).toEqual([
      ['Hair Care', '2 品目', '￥60,000'],
      ['Hair Color', '3 品目', '￥42,000'],
      ['Hair Treatment', '1 品目', '￥40,000'],
    ])
  })

  it.each<[string, (salonId: string) => string, string, string]>([
    ['the count', stockCountHrefOf, '棚卸し', '数える在庫の行がありません'],
    ['the value', stockValueHrefOf, '在庫評価額', '在庫のある商品はありません'],
  ])(
    'should say that a salon keeps no stock at %s',
    async (_, hrefOf, title, empty) => {
      // Act
      await openAs(hrefOf(await salonIdOf(OSAKA)), OPERATOR)

      // Assert
      await heading(title)
      expect(await screen.findByText(empty)).toBeVisible()
    },
  )

  it.each<[string, (salonId: string) => string, () => Promise<void>]>([
    ['the form of a count', stockCountHrefOf, openedCount],
    ['the value', stockValueHrefOf, openedValue],
  ])(
    'should have no accessibility violations on %s',
    async (_, hrefOf, opened) => {
      // Arrange
      await openAs(hrefOf(await salonIdOf(TOKYO)), MANAGER)
      await opened()

      // Act
      const violations = await findAccessibilityViolations(document.body)

      // Assert
      expect(violations).toEqual([])
    },
  )

  it('should have no accessibility violations on what a count found', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedCount()
    await user.type(counted(COLOUR), '18')
    await user.click(screen.getByRole('button', { name: '記録する' }))
    await screen.findByRole('table', { name: DIFFERED })

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})

describe('the screens of the count and the value of the stock on a page in English', () => {
  /** Waits for the form of a count in English: its heading, then its rows. */
  const theCountInEnglish = async (): Promise<void> => {
    await heading('Stock count')
    await screen.findByRole('textbox', { name: new RegExp(`^${COLOUR}`) })
  }

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should let the manager count some rows, and say the rows that differed, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const lot = (await drawnOf(TOKYO))[1]?.lotNumber ?? ''
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), MANAGER, 'en')
    await theCountInEnglish()
    expect(counted(COLOUR)).toHaveAccessibleDescription(
      /^On the books: 20 tube, stored at Storage Room A/,
    )
    await user.type(counted(COLOUR), '18')
    await user.type(counted(SHAMPOO), '20')
    await user.type(
      screen.getByRole('textbox', { name: 'Reason' }),
      'Month-end count',
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Record' }))

    // Assert
    expect(
      await screen.findByText(
        'Recorded the count of 2 rows. Rows that differed from the books: 1.',
      ),
    ).toBeVisible()
    expect(rowsOf('Rows that differed from the books')).toEqual([
      [`${COLOUR} (lot ${lot})`, '20 tube', '18 tube', '−2 tube'],
    ])
    expect(
      screen.getByRole('button', { name: 'Count more stock' }),
    ).toBeVisible()
  })

  it('should say in English that stock was reserved meanwhile, and read the rows anew', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), MANAGER, 'en')
    await theCountInEnglish()
    await user.type(counted(SHAMPOO), '3')
    await reservedMeanwhile(await rowIdOf(TOKYO, 'SHMP001'), 5)

    // Act
    await user.click(screen.getByRole('button', { name: 'Record' }))

    // Assert
    expect(
      await screen.findByText(
        'On some rows the count is below what is reserved: stock was reserved meanwhile. The stock rows were loaded again. Check the counts and record them again.',
      ),
    ).toBeVisible()
    await waitFor(() =>
      expect(counted(SHAMPOO)).toHaveAccessibleDescription(
        /^On the books: 20 bottle \(5 bottle reserved\), /,
      ),
    )
  })

  it('should show the value of the stock by categories in English', async () => {
    // Act
    await openAs(stockValueHrefOf(await salonIdOf(TOKYO)), OWNER, 'en')

    // Assert
    await heading('Inventory value')
    await screen.findByRole('table', { name: 'Inventory value by category' })
    expect(
      screen.getByText(
        'The inventory is worth ¥150,000 in all (6 items). It is the stock times the purchase price of each product; a product without a purchase price counts for nothing.',
      ),
    ).toBeVisible()
    expect(rowsOf('Inventory value by category')).toEqual([
      ['Hair Care', '2 items', '¥60,000'],
      ['Hair Color', '3 items', '¥50,000'],
      ['Hair Treatment', '1 item', '¥40,000'],
    ])
  })

  it.each<[string, (salonId: string) => string, string, string]>([
    [
      'the count',
      stockCountHrefOf,
      'Stock count',
      'This account cannot record stock counts. Only the owners and managers of the salon, and administrators, can record them.',
    ],
    [
      'the value',
      stockValueHrefOf,
      'Inventory value',
      'This account cannot see the inventory value. Only the owners and managers of the salon, and administrators, can see it.',
    ],
  ])(
    'should say to the stylist in English who may see %s',
    async (_, hrefOf, title, message) => {
      // Act
      await openAs(hrefOf(await salonIdOf(TOKYO)), STYLIST, 'en')

      // Assert
      await heading(title)
      expect(await screen.findByText(message)).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'Back to the inventory' }),
      ).toBeVisible()
    },
  )
})
