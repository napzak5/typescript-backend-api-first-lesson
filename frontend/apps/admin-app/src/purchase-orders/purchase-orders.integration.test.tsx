import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  ADMIN,
  dayFromToday,
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
} from '../bookings/__tests__/arrangements'
import {
  displayNameOf,
  rowIdOf,
  rowRemovedMeanwhile,
} from '../inventory/__tests__/arrangements'
import {
  inventoryHrefOf,
  purchaseOrderEntryHrefOf,
  purchaseOrderHrefOf,
  purchaseOrdersHrefOf,
  stockRowHrefOf,
} from '../navigation'
import { dayAfter, dayNameOf } from '../salon-time'
import {
  daysOf,
  orderIdOf,
  padOrdersOf,
  storedItemsOf,
  storedOrdersOf,
} from './__tests__/arrangements'

/*
 * The purchase orders, against the API. The salon in Tokyo of the seed
 * data has two orders of Beauty Supply Tokyo, entered by an administrator
 * (`__tests__/arrangements.ts`), and keeps a row of each of six products
 * of its own lot, in the order of their codes: the powder at ￥1,200, the
 * colour at ￥800, the conditioner at ￥1,500, the developer at ￥500, the
 * shampoo at ￥1,500 and the mask at ￥2,000. Its tax is 10%. Every member
 * of its staff reads and makes its orders. The salon in Osaka has no
 * orders and keeps no stock. Somebody did something meanwhile where a
 * test says so.
 */

const TITLE = 'Beauty Salon Admin'

/** The address a screen was opened at, and what the page showed in the commit that opened it */
let firstSight: [string, string] = ['', '']

const FirstSight = () => {
  const { pathname, search } = useLocation()
  useLayoutEffect(() => {
    firstSight = [
      `${pathname}${search}`,
      document.querySelector('main')?.textContent ?? '',
    ]
  }, [pathname, search])

  return null
}

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
        <FirstSight />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** Opens a screen, signed in as an account of the seed data. */
const openAs = async (path: string, email: string): Promise<void> => {
  renderAt(path)
  await signInAs(email)
}

const heading = (name: string | RegExp) =>
  screen.findByRole('heading', { level: 1, name })

const ORDERS = '発注'

const NARROWED = '条件に合う発注'

const ENTRY = '発注を作る'

/** Waits for the orders: the heading comes first, the table once the orders were read. */
const openedOrders = async (caption = ORDERS): Promise<void> => {
  await heading(ORDERS)
  await screen.findByRole('table', { name: caption })
}

const POWDER = 'Lightening Powder 500g'
const COLOUR = 'Hair Color - Natural Brown'
const SHAMPOO = 'Professional Shampoo 500ml'

/** The group of the controls of the row of a product, named by the product and the lot the seed drew */
const rowOf = (product: string): HTMLElement =>
  screen.getByRole('group', { name: new RegExp(`^${product}（`) })

/** A control of the row of a product */
const ofRow = (product: string, label: string): HTMLElement =>
  within(rowOf(product)).getByRole('textbox', { name: label })

/** Waits for the form of a new order: its heading comes first, the rows once they were read. */
const openedEntry = async (): Promise<void> => {
  await heading(ENTRY)
  await screen.findByRole('group', { name: new RegExp(`^${POWDER}（`) })
}

/** What the statuses of the screen say: how many orders the table shows among them */
const statuses = (): (string | null)[] =>
  screen.getAllByRole('status').map((status) => status.textContent)

/** The rows of a table, each as the texts of its cells. */
const rowsOf = (caption = ORDERS): string[][] =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent ?? ''))

/** What a card says, term by term */
const termsOf = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
): Promise<void> => {
  await user.selectOptions(screen.getByRole('combobox', { name }), option)
}

const SHOW = '表示する'

/** The rows the seed makes, the latest made first: both on the day the seed ran, the second to be delivered a week later */
const seededRows = async (): Promise<string[][]> => {
  const second = await daysOf('PO-SEED-0002')
  const first = await daysOf('PO-SEED-0001')

  return [
    [
      'PO-SEED-0002',
      dayNameOf(second.ordered),
      'Beauty Supply Tokyo',
      '発注済み',
      '￥27,200',
      dayNameOf(second.delivery ?? ''),
    ],
    [
      'PO-SEED-0001',
      dayNameOf(first.ordered),
      'Beauty Supply Tokyo',
      '承認待ち',
      '￥24,750',
      '未定',
    ],
  ]
}

/** Fills in an order of the rows given, at the price each row is offered at, and a tax of none. */
const fillIn = async (
  user: ReturnType<typeof userEvent.setup>,
  supplier: string,
  quantities: [string, string][],
): Promise<void> => {
  await user.type(screen.getByRole('textbox', { name: '仕入先' }), supplier)
  for (const [product, quantity] of quantities) {
    await user.type(ofRow(product, '数量'), quantity)
  }
  await user.type(screen.getByRole('textbox', { name: '税額（円）' }), '0')
}

describe('the screens of the purchase orders', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead the stylist from the navigation to the orders, the latest made first, and on to an order of an administrator and its rows', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(inventoryHrefOf(salonId), STYLIST)
    await heading('在庫')

    // Act
    await user.click(screen.getByRole('link', { name: ORDERS }))

    // Assert
    await openedOrders()
    expect(firstSight[0]).toBe(purchaseOrdersHrefOf(salonId))
    expect(
      screen.getByRole('heading', { level: 1, name: ORDERS }),
    ).toHaveFocus()
    expect(rowsOf()).toEqual(await seededRows())
    expect(statuses()).toContain('2 件')

    // Act
    await user.click(screen.getByRole('link', { name: 'PO-SEED-0001' }))

    // Assert
    await heading('発注 PO-SEED-0001')
    expect(firstSight[0]).toBe(
      purchaseOrderHrefOf(salonId, await orderIdOf('PO-SEED-0001')),
    )
    expect(
      screen.getByRole('heading', { level: 1, name: '発注 PO-SEED-0001' }),
    ).toHaveFocus()
    const ordered = dayNameOf((await daysOf('PO-SEED-0001')).ordered)
    const terms = termsOf('発注')
    // An administrator entered it: nobody is named
    expect(terms[3]?.[1]).toMatch(new RegExp(`^${ordered} \\d{2}:\\d{2}$`))
    expect(terms.filter(([term]) => term !== '発注日時')).toEqual([
      ['発注番号', 'PO-SEED-0001'],
      ['ステータス', '承認待ち'],
      ['仕入先', 'Beauty Supply Tokyo'],
      ['納品予定日', '未定'],
      ['支払条件', '月末締め翌月末払い'],
      ['メモ', '定期補充'],
      ['納品のメモ', '記録なし'],
    ])
    expect(rowsOf('明細')).toEqual([
      ['SHMP001', SHAMPOO, '10 bottle', '￥1,500', '￥15,000', ''],
      [
        'COND001',
        'Professional Conditioner 500ml',
        '5 bottle',
        '￥1,500',
        '￥7,500',
        '',
      ],
    ])
    expect(termsOf('金額')).toEqual([
      ['小計', '￥22,500'],
      ['税額', '￥2,250'],
      ['送料', 'なし'],
      ['合計', '￥24,750'],
    ])

    // Act
    await user.click(screen.getByRole('link', { name: SHAMPOO }))

    // Assert
    await heading('在庫の行')
    expect(firstSight[0]).toBe(
      stockRowHrefOf(salonId, await rowIdOf(TOKYO, 'SHMP001')),
    )
  })

  it('should say when an order placed with the supplier was approved, by nobody named, when it is to be delivered and what it costs to ship', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const { ordered, delivery } = await daysOf('PO-SEED-0002')

    // Act
    await openAs(
      purchaseOrderHrefOf(salonId, await orderIdOf('PO-SEED-0002')),
      MANAGER,
    )

    // Assert
    await heading('発注 PO-SEED-0002')
    const terms = termsOf('発注')
    expect(terms.slice(4, 7).map(([term]) => term)).toEqual([
      '納品予定日',
      '承認',
      '支払条件',
    ])
    expect(terms[4]?.[1]).toBe(dayNameOf(delivery ?? ''))
    // An administrator approved it when the seed ran
    expect(terms[5]?.[1]).toMatch(
      new RegExp(`^${dayNameOf(ordered)} \\d{2}:\\d{2}$`),
    )
    expect(rowsOf('明細')).toEqual([
      [
        'TREAT001',
        'Intensive Hair Mask 250ml',
        '12 jar',
        '￥2,000',
        '￥24,000',
        '',
      ],
    ])
    expect(termsOf('金額')).toEqual([
      ['小計', '￥24,000'],
      ['税額', '￥2,400'],
      ['送料', '￥800'],
      ['合計', '￥27,200'],
    ])
  })

  it('should narrow the orders by status, supplier and days, kept in the address, and say when none meet them', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const today = (await daysOf('PO-SEED-0001')).ordered
    const seeded = await seededRows()
    await openAs(purchaseOrdersHrefOf(salonId), MANAGER)
    await openedOrders()

    // Act
    await choose(user, 'ステータス', '発注済み')
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    await openedOrders(NARROWED)
    expect(firstSight[0]).toBe(
      `${purchaseOrdersHrefOf(salonId)}?status=ordered`,
    )
    expect(rowsOf(NARROWED)).toEqual(seeded.slice(0, 1))

    // Act: the name of the supplier is matched as a whole
    await choose(user, 'ステータス', 'すべて')
    await user.type(
      screen.getByRole('textbox', { name: '仕入先' }),
      'Beauty Supply',
    )
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    expect(await screen.findByText('条件に合う発注はありません')).toBeVisible()
    expect(firstSight[0]).toBe(
      `${purchaseOrdersHrefOf(salonId)}?supplier=Beauty+Supply`,
    )

    // Act
    await user.type(screen.getByRole('textbox', { name: '仕入先' }), ' Tokyo')
    await user.type(screen.getByLabelText('発注日（から）'), today)
    await user.type(screen.getByLabelText('発注日（まで）'), today)
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    await openedOrders(NARROWED)
    expect(firstSight[0]).toBe(
      `${purchaseOrdersHrefOf(salonId)}?supplier=Beauty+Supply+Tokyo&from=${today}&to=${today}`,
    )
    expect(rowsOf(NARROWED)).toEqual(seeded)

    // Act
    await user.clear(screen.getByLabelText('発注日（から）'))
    await user.type(screen.getByLabelText('発注日（から）'), dayAfter(today, 1))
    await user.clear(screen.getByLabelText('発注日（まで）'))
    await user.type(screen.getByLabelText('発注日（まで）'), dayAfter(today, 1))
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    expect(await screen.findByText('条件に合う発注はありません')).toBeVisible()

    // Act
    await user.click(screen.getByRole('link', { name: '条件をすべて外す' }))

    // Assert
    await openedOrders()
    expect(firstSight[0]).toBe(purchaseOrdersHrefOf(salonId))
    expect(rowsOf()).toEqual(seeded)
  })

  it('should say that the last day is before the first, and keep the address', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(purchaseOrdersHrefOf(salonId), STYLIST)
    await openedOrders()

    // Act
    await user.type(screen.getByLabelText('発注日（から）'), '2026-11-20')
    await user.type(screen.getByLabelText('発注日（まで）'), '2026-11-19')
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    expect(screen.getByLabelText('発注日（まで）')).toHaveAccessibleDescription(
      '終わりの日は、始まりの日と同じか、その後にしてください。',
    )
    expect(screen.getByLabelText('発注日（まで）')).toHaveFocus()
    expect(firstSight[0]).toBe(purchaseOrdersHrefOf(salonId))
  })

  it('should read the orders as they are now when the same conditions are sent again', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(purchaseOrdersHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await openedOrders()
    await padOrdersOf(TOKYO, 1)

    // Act
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    await waitFor(() => expect(rowsOf()).toHaveLength(3))
    expect(rowsOf()[2]?.[0]).toBe('PO-PAD-01')
  })

  it('should read the orders that come after a page, and take the focus to the first of them', async () => {
    // Arrange
    const user = userEvent.setup()
    await padOrdersOf(TOKYO, 19)
    await openAs(purchaseOrdersHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedOrders()
    expect(rowsOf()).toHaveLength(20)
    expect(statuses()).toContain('21 件（20 件を表示しています）')

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    await waitFor(() => expect(rowsOf()).toHaveLength(21))
    expect(rowsOf()[20]?.slice(2, 5)).toEqual(['Pad Supply', '下書き', '￥0'])
    expect(screen.getByRole('link', { name: 'PO-PAD-19' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
  })

  it('should let the stylist make a draft of the rows with a quantity, at the prices offered, work out the subtotal as it is entered, and show the order made by them first in the list', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const stylist = await displayNameOf(STYLIST)
    const delivery = await dayFromToday(5)
    await openAs(purchaseOrdersHrefOf(salonId), STYLIST)
    await openedOrders()
    await user.click(screen.getByRole('link', { name: ENTRY }))
    await openedEntry()
    expect(firstSight[0]).toBe(purchaseOrderEntryHrefOf(salonId))
    expect(ofRow(POWDER, '単価（円）')).toHaveValue('1200')
    expect(ofRow(COLOUR, '単価（円）')).toHaveValue('800')
    expect(ofRow(COLOUR, '数量')).toHaveAccessibleDescription('在庫数 20 tube')

    // Act
    await user.type(
      screen.getByRole('textbox', { name: '仕入先' }),
      'Tokyo Beauty Supply',
    )
    await user.type(ofRow(SHAMPOO, '数量'), '10')
    await user.type(ofRow(COLOUR, '数量'), '2.5')

    // Assert
    expect(screen.getByText('小計 ￥17,000')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: '税額（円）' }),
    ).toHaveAccessibleDescription(
      '仕入先の請求に合わせて入力します。小計の 10% は ￥1,700 です（円未満切り捨て）。',
    )

    // Act
    await user.type(screen.getByRole('textbox', { name: '税額（円）' }), '1700')
    await user.type(screen.getByRole('textbox', { name: '送料（円）' }), '500')
    await user.type(screen.getByLabelText('納品予定日'), delivery)
    await user.type(
      screen.getByRole('textbox', { name: '支払条件' }),
      '月末締め翌月末払い',
    )
    await user.type(screen.getByRole('textbox', { name: 'メモ' }), '年末の分')
    await user.click(screen.getByRole('button', { name: ENTRY }))

    // Assert
    await heading(/^発注 PO-/)
    const made = (await storedOrdersOf(TOKYO))[2]
    const number = made?.orderNumber ?? ''
    expect(
      await screen.findByText(`発注 ${number} を下書きとして作りました。`),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 1, name: `発注 ${number}` }),
    ).toHaveFocus()
    // The order was shown at once: it was not read again first
    expect(firstSight[0]).toBe(
      purchaseOrderHrefOf(salonId, await orderIdOf(number)),
    )
    expect(firstSight[1]).toContain('Tokyo Beauty Supply')
    expect(made).toEqual({
      orderNumber: number,
      supplier: 'Tokyo Beauty Supply',
      status: 'draft',
      subtotal: 17000,
      taxAmount: 1700,
      shippingCost: 500,
      totalAmount: 19200,
      expectedDelivery: `${delivery} 00:00:00`,
      paymentTerms: '月末締め翌月末払い',
      notes: '年末の分',
      createdBy: stylist,
    })
    // In the order of the form, which is that of the codes of the products
    expect(await storedItemsOf(number)).toEqual([
      {
        productCode: 'COLOR001',
        quantity: '2.50',
        unitPrice: 800,
        totalPrice: 2000,
        notes: null,
        kept: true,
      },
      {
        productCode: 'SHMP001',
        quantity: '10.00',
        unitPrice: 1500,
        totalPrice: 15000,
        notes: null,
        kept: true,
      },
    ])
    // The staff are read apart from the order, and may come after it
    await waitFor(() =>
      expect(termsOf('発注')[3]?.[1]).toMatch(new RegExp(`（${stylist}）$`)),
    )
    expect(termsOf('発注')[4]).toEqual(['納品予定日', dayNameOf(delivery)])
    expect(rowsOf('明細').map((row) => row.slice(0, 5))).toEqual([
      ['COLOR001', COLOUR, '2.5 tube', '￥800', '￥2,000'],
      ['SHMP001', SHAMPOO, '10 bottle', '￥1,500', '￥15,000'],
    ])

    // Act
    await user.click(screen.getByRole('link', { name: '発注へ' }))

    // Assert: the list read before was dropped
    await openedOrders()
    expect(firstSight[1]).not.toContain('PO-SEED')
    await waitFor(() => expect(rowsOf()).toHaveLength(3))
    expect(rowsOf()[0]?.slice(0, 5)).toEqual([
      number,
      dayNameOf(await dayFromToday(0)),
      'Tokyo Beauty Supply',
      '下書き',
      '￥19,200',
    ])
  })

  it('should say what is wrong at the controls before sending, and make nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(purchaseOrderEntryHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedEntry()

    // Act
    await user.clear(ofRow(SHAMPOO, '単価（円）'))
    await user.click(screen.getByRole('button', { name: ENTRY }))

    // Assert
    expect(
      screen.getByRole('textbox', { name: '仕入先' }),
    ).toHaveAccessibleDescription(
      '発注を探すときも、この名前で探します。 仕入先を入力してください。',
    )
    expect(screen.getByRole('textbox', { name: '仕入先' })).toHaveFocus()
    expect(ofRow(POWDER, '数量')).toHaveAccessibleDescription(
      '在庫数 20 box 発注する行がありません。発注する行に、数量を入力してください。',
    )
    expect(
      screen.getByRole('textbox', { name: '税額（円）' }),
    ).toHaveAccessibleDescription(
      /税額を入力してください。税がかからなければ 0 にします。$/,
    )

    // Act
    await user.type(screen.getByRole('textbox', { name: '仕入先' }), 'X')
    await user.type(ofRow(COLOUR, '数量'), '0')
    await user.type(ofRow(SHAMPOO, '数量'), '1')
    await user.type(screen.getByRole('textbox', { name: '税額（円）' }), '0')
    await user.click(screen.getByRole('button', { name: ENTRY }))

    // Assert
    expect(ofRow(COLOUR, '数量')).toHaveAccessibleDescription(
      '在庫数 20 tube 数量は、0 より大きく 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
    )
    expect(ofRow(COLOUR, '数量')).toHaveFocus()
    expect(ofRow(SHAMPOO, '単価（円）')).toHaveAccessibleDescription(
      '単価は、0 以上の円の整数で入力してください。',
    )

    // Act: two items, each of ￥1,500,000,000
    await user.clear(ofRow(COLOUR, '数量'))
    await user.clear(ofRow(SHAMPOO, '数量'))
    await user.type(ofRow(SHAMPOO, '単価（円）'), '1000')
    await user.type(ofRow(SHAMPOO, '数量'), '1500000')
    await user.type(ofRow(POWDER, '数量'), '1250000')
    await user.click(screen.getByRole('button', { name: ENTRY }))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '合計が 2,147,483,647 円を超えます。明細を分けて、発注を 2 件以上にしてください。',
    )
    expect(await storedOrdersOf(TOKYO)).toHaveLength(2)
  })

  it('should read the rows anew when a row ordered was removed meanwhile, keep what was entered, and make the order of the rows left', async () => {
    // Arrange
    const user = userEvent.setup()
    const colourRow = await rowIdOf(TOKYO, 'COLOR001')
    await openAs(purchaseOrderEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedEntry()
    await fillIn(user, 'ColorTech Japan', [
      [COLOUR, '3'],
      [SHAMPOO, '2'],
    ])
    await rowRemovedMeanwhile(colourRow)

    // Act
    await user.click(screen.getByRole('button', { name: ENTRY }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '発注する在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数量を確かめて、もう一度作ってください。',
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('group', { name: new RegExp(`^${COLOUR}（`) }),
      ).toBeNull(),
    )
    expect(ofRow(SHAMPOO, '数量')).toHaveValue('2')
    expect(await storedOrdersOf(TOKYO)).toHaveLength(2)

    // Act
    await user.click(screen.getByRole('button', { name: ENTRY }))

    // Assert
    await heading(/^発注 PO-/)
    const made = (await storedOrdersOf(TOKYO))[2]
    expect(await storedItemsOf(made?.orderNumber ?? '')).toEqual([
      {
        productCode: 'SHMP001',
        quantity: '2.00',
        unitPrice: 1500,
        totalPrice: 3000,
        notes: null,
        kept: true,
      },
    ])
  })

  it('should let an administrator make an order, naming nobody', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(purchaseOrderEntryHrefOf(await salonIdOf(TOKYO)), ADMIN)
    await openedEntry()
    await fillIn(user, 'ColorTech Japan', [[POWDER, '4']])

    // Act
    await user.click(screen.getByRole('button', { name: ENTRY }))

    // Assert
    await heading(/^発注 PO-/)
    expect(await storedOrdersOf(TOKYO)).toMatchObject([
      {},
      {},
      {
        supplier: 'ColorTech Japan',
        subtotal: 4800,
        taxAmount: 0,
        shippingCost: null,
        totalAmount: 4800,
        expectedDelivery: null,
        paymentTerms: null,
        notes: null,
        createdBy: null,
      },
    ])
    expect(termsOf('発注')[3]?.[1]).toMatch(/\d{2}:\d{2}$/)
    expect(termsOf('発注')[4]).toEqual(['納品予定日', '未定'])
  })

  it.each<[string, () => Promise<string>, string, string]>([
    [
      'the orders of another salon',
      async () => purchaseOrdersHrefOf(await salonIdOf(OSAKA)),
      STYLIST,
      'このサロンの発注は、見られません。発注を見られるのは、そのサロンのスタッフと、管理者です。',
    ],
    [
      'a new order of another salon',
      async () => purchaseOrderEntryHrefOf(await salonIdOf(OSAKA)),
      MANAGER,
      'このサロンの発注は、見られません。発注を見られるのは、そのサロンのスタッフと、管理者です。',
    ],
    [
      'an order at the address of another salon',
      async () =>
        purchaseOrderHrefOf(
          await salonIdOf(OSAKA),
          await orderIdOf('PO-SEED-0001'),
        ),
      ADMIN,
      'アドレスが正しいか、お確かめください。',
    ],
    [
      'an order that is none',
      async () =>
        purchaseOrderHrefOf(
          await salonIdOf(TOKYO),
          '7d1c9a52-3e4f-4b6a-9c8d-1e2f3a4b5c6d',
        ),
      STYLIST,
      'アドレスが正しいか、お確かめください。',
    ],
  ])('should say what %s is', async (_, pathOf, email, said) => {
    // Act
    await openAs(await pathOf(), email)

    // Assert
    expect(await screen.findByText(said)).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should say that a salon has no orders, and that it keeps no stock to order', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(purchaseOrdersHrefOf(await salonIdOf(OSAKA)), ADMIN)
    expect(await screen.findByText('発注はありません')).toBeVisible()

    // Act
    await user.click(screen.getByRole('link', { name: ENTRY }))

    // Assert
    expect(
      await screen.findByText('発注する在庫の行がありません'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: '在庫へ' })).toBeVisible()
  })

  it.each<[string, string, () => Promise<string>, () => Promise<void>]>([
    [
      'the orders',
      MANAGER,
      async () => purchaseOrdersHrefOf(await salonIdOf(TOKYO)),
      () => openedOrders(),
    ],
    [
      'an order',
      STYLIST,
      async () =>
        purchaseOrderHrefOf(
          await salonIdOf(TOKYO),
          await orderIdOf('PO-SEED-0002'),
        ),
      async () => {
        await heading('発注 PO-SEED-0002')
      },
    ],
    [
      'the form of a new order, with what is wrong',
      OWNER,
      async () => purchaseOrderEntryHrefOf(await salonIdOf(TOKYO)),
      async () => {
        await openedEntry()
        await userEvent.click(screen.getByRole('button', { name: ENTRY }))
      },
    ],
    [
      'a salon without orders',
      ADMIN,
      async () => purchaseOrdersHrefOf(await salonIdOf(OSAKA)),
      async () => {
        await screen.findByText('発注はありません')
      },
    ],
  ])('should show %s accessibly', async (_, email, pathOf, opened) => {
    // Arrange
    await openAs(await pathOf(), email)
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})
