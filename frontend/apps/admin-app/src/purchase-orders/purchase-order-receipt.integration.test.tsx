import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { firstSight, heading } from '@beauty-salon-frontend/testing/screens'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../__tests__/screens'
import {
  ADMIN,
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  salonIdOf,
  TOKYO,
} from '../bookings/__tests__/arrangements'
import {
  rowIdOf,
  rowRemovedMeanwhile,
  storedMovementsOf,
  storedRowsOf,
} from '../inventory/__tests__/arrangements'
import {
  inventoryHrefOf,
  orderReceiptHrefOf,
  purchaseOrderHrefOf,
  purchaseOrdersHrefOf,
  reorderSuggestionsHrefOf,
  suggestedOrderHrefOf,
} from '../navigation'
import {
  daysOf,
  deliveryNotedOn,
  orderIdOf,
  orderMovedTo,
  productOrderedAt,
  stockOfRow,
  storedItemsOf,
  storedOrderOf,
  storedOrdersOf,
} from './__tests__/arrangements'

/*
 * The goods that come for a purchase order, and the suggestions of what
 * to order, against the API. The salon in Tokyo of the seed data has two
 * orders (`__tests__/arrangements.ts`): PO-SEED-0001, waiting for
 * approval, of 10 bottles of its shampoo and 5 of its conditioner; and
 * PO-SEED-0002, placed with the supplier, of 12 jars of its mask. Each
 * product keeps a row of 20 (`../inventory/__tests__/arrangements.ts`).
 * Of its products, only the colour of ColorTech Japan comes to its reorder
 * point: 20 tubes, ordered up to 100. Its ledger is changed where a test
 * says so.
 */

/** The address of the receipt of an order of the salon in Tokyo, by its number */
const receiptAt = async (orderNumber: string): Promise<string> =>
  orderReceiptHrefOf(await salonIdOf(TOKYO), await orderIdOf(orderNumber))

/** Opens the receipt of an order, and waits for its form. */
const openReceiptAs = async (
  orderNumber: string,
  email: string,
): Promise<void> => {
  await openAs(await receiptAt(orderNumber), email)
  await screen.findByRole('group', { name: '届いた数量' })
}

const box = (name: string | RegExp): HTMLElement =>
  screen.getByRole('textbox', { name })

const MASK = 'TREAT001 Intensive Hair Mask 250ml'
const SHAMPOO = 'SHMP001 Professional Shampoo 500ml'
const CONDITIONER = 'COND001 Professional Conditioner 500ml'

const RECEIVE = '入荷を記録する'

/** The stock of the row of a product of the salon in Tokyo, as the database keeps it */
const stockOf = async (productCode: string): Promise<string | undefined> =>
  (await storedRowsOf(TOKYO)).find((row) => row.productCode === productCode)
    ?.currentStock

/** The quantity of the row of a product on the form of a new order */
const quantityOf = (productName: string): HTMLElement =>
  within(
    screen.getByRole('group', { name: new RegExp(`^${productName}`) }),
  ).getByRole('textbox', { name: '数量' })

/** The cells of the rows of a table of suggestions, without the name of each product */
const suggestedIn = (supplier: string): string[][] =>
  within(
    within(screen.getByRole('region', { name: supplier })).getByRole('table'),
  )
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    )

describe('the goods that come for a purchase order, and what to order', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should let the stylist record the goods of an order placed with the supplier, put them into the stock, and show the order delivered in the list and the stock', async () => {
    // Arrange
    const user = userEvent.setup()
    const mask = await rowIdOf(TOKYO, 'TREAT001')
    await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await screen.findByRole('row', { name: /Intensive Hair Mask 250ml/ })
    await user.click(screen.getByRole('link', { name: '発注' }))
    await user.click(await screen.findByRole('link', { name: 'PO-SEED-0002' }))
    await heading('発注 PO-SEED-0002')
    await user.click(screen.getByRole('link', { name: RECEIVE }))
    await heading(RECEIVE)
    expect(await screen.findByRole('textbox', { name: MASK })).toHaveValue('12')
    expect(box(MASK)).toHaveAccessibleDescription('発注 12 jar')
    expect(box('納品のメモ')).toHaveValue('')

    // Act
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    expect(
      await screen.findByText(
        '発注 PO-SEED-0002 の入荷を記録しました。届いた 1 件の明細を、在庫に入れました。',
      ),
    ).toBeVisible()
    expect(await heading('発注 PO-SEED-0002')).toHaveFocus()
    const status = screen.getByRole('region', { name: '状態' })
    expect(within(status).getByText('納品済み')).toBeVisible()
    expect(within(status).queryByRole('link', { name: RECEIVE })).toBeNull()
    expect(await storedOrderOf('PO-SEED-0002')).toMatchObject({
      status: 'delivered',
    })
    expect(await stockOf('TREAT001')).toBe('32.00')
    expect((await storedMovementsOf(mask))[0]).toMatchObject({
      transactionType: 'purchase',
      quantity: '12.00',
      balanceAfter: '32.00',
      unitCost: 2000,
      totalCost: 24000,
      performedBy: expect.any(String),
    })

    // Act
    await user.click(screen.getByRole('link', { name: '発注へ' }))

    // Assert: the list that was read before is read anew, not shown as it was
    const order = await screen.findByRole('row', { name: /PO-SEED-0002/ })
    expect(within(order).getByText('納品済み')).toBeVisible()
    expect(firstSight()[1]).toContain('発注を読み込んでいます')

    // Act
    await user.click(screen.getByRole('link', { name: '在庫' }))

    // Assert: so is the stock
    const row = await screen.findByRole('row', {
      name: /Intensive Hair Mask 250ml/,
    })
    expect(within(row).getByText('32 jar')).toBeVisible()
    expect(firstSight()[1]).toContain('在庫を読み込んでいます')
  })

  it('should let a manager receive what came of some items, leave the rest, and write the notes of the delivery', async () => {
    // Arrange
    const user = userEvent.setup()
    await orderMovedTo('PO-SEED-0001', 'shipped')
    await openReceiptAs('PO-SEED-0001', MANAGER)
    expect(box(SHAMPOO)).toHaveValue('10')
    expect(box(CONDITIONER)).toHaveValue('5')

    // Act
    await user.clear(box(SHAMPOO))
    await user.type(box(SHAMPOO), '8.5')
    await user.clear(box(CONDITIONER))
    await user.type(box('納品のメモ'), 'コンディショナーは来週')
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    expect(
      await screen.findByText(
        '発注 PO-SEED-0001 の入荷を記録しました。届いた 1 件の明細を、在庫に入れました。',
      ),
    ).toBeVisible()
    expect(await storedOrderOf('PO-SEED-0001')).toMatchObject({
      status: 'delivered',
      deliveryNotes: 'コンディショナーは来週',
    })
    expect(await stockOf('SHMP001')).toBe('28.50')
    expect(await stockOf('COND001')).toBe('20.00')
  })

  it.each<[string, string, string]>([
    [
      'more than was ordered',
      '12.5',
      '届いた数量は、0 より大きく、発注した 12 jar までの数（小数は 2 桁まで）で入力してください。',
    ],
    [
      'none',
      '0',
      '届いた数量は、0 より大きく、発注した 12 jar までの数（小数は 2 桁まで）で入力してください。',
    ],
    [
      'nothing at all',
      '',
      '入荷する明細がありません。届いた明細に、数量を入力してください。',
    ],
  ])(
    'should not send a receipt of %s, and say so at the item',
    async (_case, quantity, said) => {
      // Arrange
      const user = userEvent.setup()
      await openReceiptAs('PO-SEED-0002', STYLIST)

      // Act
      await user.clear(box(MASK))
      if (quantity !== '') {
        await user.type(box(MASK), quantity)
      }
      await user.click(screen.getByRole('button', { name: RECEIVE }))

      // Assert
      await waitFor(() =>
        expect(box(MASK)).toHaveAccessibleDescription(
          expect.stringContaining(said),
        ),
      )
      expect(box(MASK)).toHaveFocus()
      expect((await storedOrderOf('PO-SEED-0002')).status).toBe('ordered')
    },
  )

  it('should open with the notes of the delivery the order holds, and not send them made empty', async () => {
    // Arrange
    const user = userEvent.setup()
    await deliveryNotedOn('PO-SEED-0002', '午前中に、裏口へ')
    await openReceiptAs('PO-SEED-0002', STYLIST)
    expect(box('納品のメモ')).toHaveValue('午前中に、裏口へ')

    // Act
    await user.clear(box('納品のメモ'))
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    await waitFor(() =>
      expect(box('納品のメモ')).toHaveAccessibleDescription(
        expect.stringContaining(
          'いまの納品のメモは、入荷では消せません。そのまま残すか、書き換えてください。',
        ),
      ),
    )
    expect((await storedOrderOf('PO-SEED-0002')).status).toBe('ordered')
  })

  it.each<[string, () => Promise<void>, string, string]>([
    [
      'an order that waits for approval',
      async () => undefined,
      'PO-SEED-0001',
      'この発注は承認待ちです。入荷は、仕入先に頼んだ発注（発注済みか出荷済み）に記録します。',
    ],
    [
      'an order delivered',
      () => orderMovedTo('PO-SEED-0002', 'delivered'),
      'PO-SEED-0002',
      'この発注は納品済みです。入荷は、記録してあります。',
    ],
    [
      'an order cancelled',
      () => orderMovedTo('PO-SEED-0002', 'cancelled'),
      'PO-SEED-0002',
      'この発注は取り消しました。取り消した発注は、入荷できません。',
    ],
    [
      'an order the rows of whose items were all removed',
      async () => rowRemovedMeanwhile(await rowIdOf(TOKYO, 'TREAT001')),
      'PO-SEED-0002',
      '明細の在庫の行が、すべて削除されています。この発注は、入荷できません。',
    ],
  ])(
    'should say that the goods of %s are not received',
    async (_case, arrange, orderNumber, said) => {
      // Arrange
      await arrange()

      // Act
      await openAs(await receiptAt(orderNumber), STYLIST)

      // Assert
      expect(await screen.findByText(said)).toBeVisible()
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByRole('link', { name: '発注へ戻る' })).toHaveAttribute(
        'href',
        purchaseOrderHrefOf(
          await salonIdOf(TOKYO),
          await orderIdOf(orderNumber),
        ),
      )
    },
  )

  it('should read the order anew when it was cancelled while its goods were entered, and receive nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReceiptAs('PO-SEED-0002', STYLIST)
    await orderMovedTo('PO-SEED-0002', 'cancelled')

    // Act
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    expect(
      await screen.findByText(
        'この発注は取り消しました。取り消した発注は、入荷できません。',
      ),
    ).toBeVisible()
    expect(await stockOf('TREAT001')).toBe('20.00')
  })

  it('should say above the form that a stock would go above what a row holds, and receive nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await stockOfRow(await rowIdOf(TOKYO, 'TREAT001'), 99_999_990)
    await openReceiptAs('PO-SEED-0002', STYLIST)

    // Act
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    expect(
      await screen.findByText(
        '入荷を記録できませんでした。発注がその間に変わったか、入荷すると在庫数が 99,999,999.99 を超える行があります。発注を読み直しました。',
      ),
    ).toBeVisible()
    expect(box(MASK)).toHaveValue('12')
    expect((await storedOrderOf('PO-SEED-0002')).status).toBe('ordered')
  })

  it('should read the order anew when a row was removed meanwhile, keep what was entered, and receive the items left', async () => {
    // Arrange
    const user = userEvent.setup()
    await orderMovedTo('PO-SEED-0001', 'ordered')
    await openReceiptAs('PO-SEED-0001', STYLIST)
    await user.clear(box(SHAMPOO))
    await user.type(box(SHAMPOO), '9')
    await rowRemovedMeanwhile(await rowIdOf(TOKYO, 'COND001'))

    // Act
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    expect(
      await screen.findByText(
        '明細の在庫の行のどれかが、その間に削除されました。発注を読み直しました。届いた数量を確かめて、もう一度記録してください。',
      ),
    ).toBeVisible()
    expect(
      await screen.findByText(
        'COND001 Professional Conditioner 500ml: 在庫の行が削除されたので、入荷できません。',
      ),
    ).toBeVisible()
    expect(box(SHAMPOO)).toHaveValue('9')
    expect((await storedOrderOf('PO-SEED-0001')).status).toBe('ordered')

    // Act
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    expect(
      await screen.findByText(
        '発注 PO-SEED-0001 の入荷を記録しました。届いた 1 件の明細を、在庫に入れました。',
      ),
    ).toBeVisible()
    expect(await stockOf('SHMP001')).toBe('29.00')
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a receipt at the address of another salon',
      async () =>
        orderReceiptHrefOf(
          await salonIdOf(OSAKA),
          await orderIdOf('PO-SEED-0002'),
        ),
    ],
    [
      'a receipt of an order that is none',
      async () =>
        orderReceiptHrefOf(
          await salonIdOf(TOKYO),
          '7d1c9a52-3e4f-4b6a-9c8d-1e2f3a4b5c6d',
        ),
    ],
  ])('should say that %s is not found', async (_case, pathOf) => {
    // Act
    await openAs(await pathOf(), ADMIN)

    // Assert
    expect(await heading('発注が見つかりません')).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('should lead the stylist from the orders to the suggestions by supplier, and on to a new order that starts with those of one', async () => {
    // Arrange
    const user = userEvent.setup()
    await productOrderedAt(TOKYO, 'BLEACH001', { reorderPoint: 25 })
    await productOrderedAt(TOKYO, 'COND001', { reorderPoint: 30 })
    const { ordered } = await daysOf('PO-SEED-0001')
    await openAs(purchaseOrdersHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await user.click(await screen.findByRole('link', { name: '発注の提案' }))

    // Assert
    await heading('発注の提案')
    await screen.findByRole('region', { name: 'ColorTech Japan' })
    expect(
      screen
        .getAllByRole('link', { name: /への発注を作る$/ })
        .map(({ textContent }) => textContent),
    ).toEqual([
      'ColorTech Japan への発注を作る',
      'Tokyo Beauty Supply への発注を作る',
    ])
    expect(suggestedIn('ColorTech Japan')).toEqual([
      ['BLEACH001', '20 box', '0 box', '25 box', '30 box', '10 box', 'なし'],
      [
        'COLOR001',
        '20 tube',
        '0 tube',
        '20 tube',
        '100 tube',
        '80 tube',
        'なし',
      ],
    ])
    expect(suggestedIn('Tokyo Beauty Supply')).toEqual([
      [
        'COND001',
        '20 bottle',
        '5 bottle',
        '30 bottle',
        '50 bottle',
        '25 bottle',
        dayNameOf(ordered),
      ],
    ])

    // Act
    await user.click(
      screen.getByRole('link', { name: 'ColorTech Japan への発注を作る' }),
    )

    // Assert
    await heading('発注を作る')
    expect(
      await screen.findByText(
        'ColorTech Japan の発注の提案の数量を 2 行に入れました。数量と単価を確かめてください。',
      ),
    ).toBeVisible()
    expect(box('仕入先')).toHaveValue('ColorTech Japan')
    expect(quantityOf('Lightening Powder 500g')).toHaveValue('10')
    expect(quantityOf('Hair Color - Natural Brown')).toHaveValue('80')
    expect(quantityOf('Professional Conditioner 500ml')).toHaveValue('')
    // 10 × 1,200 + 80 × 800
    expect(screen.getByText('小計 ￥76,000')).toBeVisible()

    // Act
    await user.type(box('税額（円）'), '7600')
    await user.click(screen.getByRole('button', { name: '発注を作る' }))

    // Assert
    await heading(/^発注 PO-/)
    const made = (await storedOrdersOf(TOKYO)).at(-1)
    expect(made).toMatchObject({
      supplier: 'ColorTech Japan',
      status: 'draft',
      subtotal: 76000,
    })
    expect(
      (await storedItemsOf(made?.orderNumber ?? '')).map(
        ({ productCode, quantity }) => [productCode, quantity],
      ),
    ).toEqual([
      ['BLEACH001', '10.00'],
      ['COLOR001', '80.00'],
    ])

    // Act
    await user.click(screen.getByRole('link', { name: '発注へ' }))
    await user.click(await screen.findByRole('link', { name: '発注の提案' }))

    // Assert: what is on order now is suggested no more
    await screen.findByRole('region', { name: 'Tokyo Beauty Supply' })
    expect(screen.queryByRole('region', { name: 'ColorTech Japan' })).toBeNull()
    expect(firstSight()[1]).not.toContain('ColorTech Japan')
  })

  it('should start a new order of the products that name no supplier with an empty supplier', async () => {
    // Arrange
    const user = userEvent.setup()
    await productOrderedAt(TOKYO, 'COLOR001', { supplier: null })
    await openAs(reorderSuggestionsHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Act
    await user.click(
      await screen.findByRole('link', { name: '仕入先を決めて発注を作る' }),
    )

    // Assert
    expect(
      await screen.findByText(
        '仕入先の決まっていない商品の、発注の提案の数量を 1 行に入れました。仕入先を入力し、数量と単価を確かめてください。',
      ),
    ).toBeVisible()
    expect(box('仕入先')).toHaveValue('')
    expect(quantityOf('Hair Color - Natural Brown')).toHaveValue('80')
    expect(screen.getByRole('link', { name: 'やめる' })).toHaveAttribute(
      'href',
      reorderSuggestionsHrefOf(await salonIdOf(TOKYO)),
    )
  })

  it('should say that a supplier has no suggestions now, and start an empty order', async () => {
    // Act
    await openAs(
      suggestedOrderHrefOf(await salonIdOf(TOKYO), 'Tokyo Beauty Supply'),
      STYLIST,
    )

    // Assert
    expect(
      await screen.findByText(
        'この仕入先の発注の提案は、いまはありません。発注する行に、数量を入力してください。',
      ),
    ).toBeVisible()
    expect(box('仕入先')).toHaveValue('Tokyo Beauty Supply')
    expect(quantityOf('Professional Shampoo 500ml')).toHaveValue('')
  })

  it('should say that nothing is to be ordered', async () => {
    // Arrange
    await productOrderedAt(TOKYO, 'COLOR001', { reorderPoint: 10 })

    // Act
    await openAs(reorderSuggestionsHrefOf(await salonIdOf(TOKYO)), OWNER)

    // Assert
    expect(await screen.findByText('発注の提案はありません')).toBeVisible()
    expect(screen.getByRole('link', { name: '発注へ' })).toHaveAttribute(
      'href',
      purchaseOrdersHrefOf(await salonIdOf(TOKYO)),
    )
  })

  it('should say that the suggestions of another salon are not shown', async () => {
    // Act
    await openAs(reorderSuggestionsHrefOf(await salonIdOf(OSAKA)), STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの発注の提案は、見られません。発注の提案を見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeVisible()
  })

  it.each<[string, () => Promise<string>, () => Promise<void>]>([
    [
      'the receipt, with what is wrong',
      () => receiptAt('PO-SEED-0002'),
      async () => {
        await screen.findByRole('group', { name: '届いた数量' })
        await userEvent.clear(box(MASK))
        await userEvent.click(screen.getByRole('button', { name: RECEIVE }))
        await waitFor(() => expect(box(MASK)).toBeInvalid())
      },
    ],
    [
      'the suggestions',
      async () => reorderSuggestionsHrefOf(await salonIdOf(TOKYO)),
      async () => {
        await screen.findByRole('region', { name: 'ColorTech Japan' })
      },
    ],
    [
      'a new order of suggestions',
      async () =>
        suggestedOrderHrefOf(await salonIdOf(TOKYO), 'ColorTech Japan'),
      async () => {
        await screen.findByText(/の発注の提案の数量を/)
      },
    ],
  ])('should show %s accessibly', async (_, pathOf, opened) => {
    // Arrange
    await openAs(await pathOf(), STYLIST)
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})
