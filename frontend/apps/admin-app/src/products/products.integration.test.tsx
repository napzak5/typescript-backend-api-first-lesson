import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
} from '../bookings/__tests__/arrangements'
import {
  bookingsHrefOf,
  productChangeHrefOf,
  productEntryHrefOf,
  productHrefOf,
  productsHrefOf,
} from '../navigation'
import {
  droppedMeanwhile,
  padsOf,
  productIdOf,
  removalsOf,
  removedMeanwhile,
  reorderPointChangedMeanwhile,
  storedProductsOf,
} from './__tests__/arrangements'

/*
 * The product ledger of a salon, read and kept against the API. The salon
 * in Tokyo of the seed data has seven products, all carried, six of them
 * in stock (all but the wax); its owner and its manager keep them, its
 * stylist reads them. Somebody did something meanwhile where a test says
 * so.
 */

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

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** Waits for the ledger: its heading comes first, the table once the products were read. */
const openedLedger = async (caption = '商品台帳'): Promise<void> => {
  await heading('商品台帳')
  await screen.findByRole('table', { name: caption })
}

/** Waits for a product: its heading comes first, the record once the product was read. */
const openedProduct = async (): Promise<void> => {
  await heading('商品の内容')
  await screen.findByRole('region', { name: '価格' })
}

/** Waits for a form: its heading comes first, the form once what it needs was read. */
const openedForm = async (title: string): Promise<void> => {
  await heading(title)
  await screen.findByRole('textbox', { name: /^商品コード/ })
}

/** The rows of the ledger, each as the texts of its cells. */
const rows = (caption = '商品台帳'): string[][] =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent ?? ''))

/** What a card of the record of a product says, term by term. */
const terms = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

const checkbox = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const SEEDED = [
  [
    'BLEACH001',
    'Lightening Powder 500g',
    'Hair Color',
    'ColorTech',
    '￥2,800',
    '施術',
    '取り扱い中',
  ],
  [
    'COLOR001',
    'Hair Color - Natural Brown',
    'Hair Color',
    'ColorTech',
    '￥1,800',
    '施術',
    '取り扱い中',
  ],
  [
    'COND001',
    'Professional Conditioner 500ml',
    'Hair Care',
    'Salon Pro',
    '￥3,000',
    '店頭販売、施術',
    '取り扱い中',
  ],
  [
    'DEVELOPER001',
    'Developer 6% 1000ml',
    'Hair Color',
    'ColorTech',
    '￥1,000',
    '施術',
    '取り扱い中',
  ],
  [
    'SHMP001',
    'Professional Shampoo 500ml',
    'Hair Care',
    'Salon Pro',
    '￥3,000',
    '店頭販売、施術',
    '取り扱い中',
  ],
  [
    'TREAT001',
    'Intensive Hair Mask 250ml',
    'Hair Treatment',
    'Salon Pro',
    '￥4,000',
    '店頭販売、施術',
    '取り扱い中',
  ],
  [
    'WAX001',
    'Styling Wax 80g',
    'Styling',
    'Style Master',
    '￥1,800',
    '店頭販売',
    '取り扱い中',
  ],
]

describe('the product ledger of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead the stylist from the header to the ledger and to a product, and offer no change', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(bookingsHrefOf(salonId), STYLIST)
    await heading('予約台帳')

    // Act
    await user.click(
      within(await screen.findByRole('navigation')).getByRole('link', {
        name: '商品',
      }),
    )

    // Assert
    await openedLedger()
    expect(firstSight[0]).toBe(productsHrefOf(salonId))
    expect(rows()).toEqual(SEEDED)
    expect(screen.getByText('7 件')).toBeVisible()
    expect(
      screen.queryByRole('link', { name: '商品を足す' }),
    ).not.toBeInTheDocument()

    // Act
    await user.click(
      screen.getByRole('link', { name: 'Professional Shampoo 500ml' }),
    )

    // Assert
    await openedProduct()
    expect(terms('商品')).toEqual([
      ['商品コード', 'SHMP001'],
      ['商品名', 'Professional Shampoo 500ml'],
      ['説明', 'Salon-grade moisturizing shampoo for all hair types'],
      ['カテゴリー', 'Hair Care'],
      ['ブランド', 'Salon Pro'],
      ['単位', 'bottle'],
      ['用途', '店頭販売、施術'],
      ['状態', '取り扱い中'],
    ])
    expect(terms('価格')).toEqual([
      ['仕入価格', '￥1,500'],
      ['定価', '￥3,500'],
      ['販売価格', '￥3,000'],
    ])
    expect(terms('在庫の水準')).toEqual([
      ['最低在庫数', '5 bottle'],
      ['発注点', '10 bottle'],
      ['最大在庫数', '50 bottle'],
    ])
    expect(terms('仕入れ')).toEqual(
      expect.arrayContaining([['仕入先', 'Tokyo Beauty Supply']]),
    )
    expect(
      screen.queryByRole('link', { name: '商品を直す' }),
    ).not.toBeInTheDocument()
  })

  it('should find the products by a keyword, a category, what they are for, a barcode and whether they are carried, and keep the conditions in the address', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(productsHrefOf(salonId), STYLIST)
    await openedLedger()

    // Act
    await user.type(
      screen.getByRole('searchbox', { name: 'キーワード' }),
      'HAIR',
    )
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await openedLedger('条件に合う商品')
    expect(rows('条件に合う商品').map(([code]) => code)).toEqual([
      'COLOR001',
      'TREAT001',
    ])
    expect(firstSight[0]).toBe(`${productsHrefOf(salonId)}?keyword=HAIR`)

    // Act
    await user.clear(screen.getByRole('searchbox', { name: 'キーワード' }))
    expect(
      within(combobox('カテゴリー'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'すべて',
      'Hair Care',
      'Hair Color',
      'Hair Treatment',
      'Styling',
    ])
    await user.selectOptions(combobox('カテゴリー'), 'Hair Color')
    await user.selectOptions(combobox('用途'), '施術で使う')
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await screen.findByText('3 件')
    expect(rows('条件に合う商品').map(([code]) => code)).toEqual([
      'BLEACH001',
      'COLOR001',
      'DEVELOPER001',
    ])
    expect(firstSight[0]).toBe(
      `${productsHrefOf(salonId)}?category=Hair+Color&use=treatment`,
    )

    // Act
    await user.click(screen.getByRole('link', { name: '条件を外す' }))

    // Assert
    await screen.findByText('7 件')
    expect(rows()).toEqual(SEEDED)
    expect(combobox('カテゴリー')).toHaveValue('')

    // Act
    await user.type(
      screen.getByRole('textbox', { name: 'バーコード' }),
      '4901234567896',
    )
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await screen.findByText('1 件')
    expect(rows('条件に合う商品').map(([code]) => code)).toEqual(['WAX001'])

    // Act
    await user.clear(screen.getByRole('textbox', { name: 'バーコード' }))
    await user.selectOptions(combobox('取り扱い'), '取り扱いをやめた')
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(
      await screen.findByText('条件に合う商品はありません'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('should read the products that come next, and move the focus to the first of them', async () => {
    // Arrange
    const user = userEvent.setup()
    await padsOf(TOKYO, 20)
    await openAs(productsHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await openedLedger()
    expect(rows()).toHaveLength(20)
    expect(screen.getByText('27 件（20 件を表示しています）')).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    await screen.findByText('27 件')
    expect(rows()).toHaveLength(27)
    expect(
      rows()
        .map(([code]) => code)
        .slice(19, 21),
    ).toEqual(['PAD16', 'PAD17'])
    expect(screen.getByRole('link', { name: 'Cotton Pad 17' })).toHaveFocus()
    expect(
      screen.queryByRole('button', { name: 'さらに表示' }),
    ).not.toBeInTheDocument()
  })

  it('should let the manager add a product from the ledger, and show it', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(productsHrefOf(salonId), MANAGER)
    await openedLedger()
    await user.click(screen.getByRole('link', { name: '商品を足す' }))
    await openedForm('商品を足す')
    expect(text(/最低在庫数/)).toHaveValue('0')
    expect(checkbox('施術で使う')).toBeChecked()
    expect(checkbox('店頭で販売する')).not.toBeChecked()

    // Act
    await user.type(text(/^商品コード/), 'OIL001')
    await user.type(text(/^単位/), 'bottle')
    await user.type(text(/^商品名/), 'Hair Oil 100ml')
    await user.type(text(/^カテゴリー/), 'Hair Care')
    await user.type(text('仕入価格'), '１,２００')
    await user.type(text(/^販売価格/), '2,800')
    await user.type(text(/^最低在庫数/), '.5')
    await user.type(text(/^発注点/), '3')
    await user.type(text(/^最大在庫数/), '12')
    await user.type(text(/^仕入先$/), 'Tokyo Beauty Supply')
    await user.type(text(/^納品までの日数/), '4')
    await user.type(
      text(/^安全データシートの URL/),
      'https://docs.example.com/sds/oil001.pdf',
    )
    await user.click(checkbox('店頭で販売する'))
    await user.click(checkbox('施術で使う'))
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      await screen.findByText('商品「Hair Oil 100ml」を足しました。'),
    ).toBeInTheDocument()
    await openedProduct()
    const added = await productIdOf(TOKYO, 'OIL001')
    // What the record alone says: the notification names the product as well
    expect(firstSight).toEqual([
      productHrefOf(salonId, added),
      expect.stringContaining('商品コードOIL001'),
    ])
    expect(terms('在庫の水準')).toEqual([
      ['最低在庫数', '0.5 bottle'],
      ['発注点', '3 bottle'],
      ['最大在庫数', '12 bottle'],
    ])
    expect((await storedProductsOf(TOKYO))[4]).toEqual({
      productCode: 'OIL001',
      name: 'Hair Oil 100ml',
      description: null,
      category: 'Hair Care',
      brand: null,
      purchasePrice: 1200,
      retailPrice: null,
      salonPrice: 2800,
      unit: 'bottle',
      minimumStock: '0.50',
      reorderPoint: '3.00',
      maximumStock: '12.00',
      supplier: 'Tokyo Beauty Supply',
      supplierProductCode: null,
      leadTimeDays: 4,
      imageUrl: null,
      barcode: null,
      isForSale: true,
      isForTreatment: false,
      requiresLotTracking: false,
      expiryMonths: null,
      storageConditions: null,
      safetyDataSheet: 'https://docs.example.com/sds/oil001.pdf',
      isActive: true,
      updatedAt: expect.any(String),
    })

    // Act
    await user.click(screen.getByRole('link', { name: '商品台帳へ' }))

    // Assert
    await openedLedger()
    expect(rows()[4]).toEqual([
      'OIL001',
      'Hair Oil 100ml',
      'Hair Care',
      '記録なし',
      '￥2,800',
      '店頭販売',
      '取り扱い中',
    ])
  })

  it('should let the manager change a product from its screen, and change nothing else', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    const salonId = await salonIdOf(TOKYO)
    await openAs(
      productHrefOf(salonId, await productIdOf(TOKYO, 'TREAT001')),
      MANAGER,
    )
    await openedProduct()
    await user.click(screen.getByRole('link', { name: '商品を直す' }))
    await openedForm('商品を直す')

    // Act
    await user.clear(text(/^販売価格/))
    await user.type(text(/^販売価格/), '4200')
    await user.clear(text(/^ブランド/))
    await user.click(checkbox('在庫をロット番号で分ける'))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText(
        '商品「Intensive Hair Mask 250ml」を直しました。',
      ),
    ).toBeInTheDocument()
    await openedProduct()
    expect(firstSight[1]).toContain('￥4,200')
    expect(terms('価格')).toEqual(
      expect.arrayContaining([['販売価格', '￥4,200']]),
    )
    expect(await storedProductsOf(TOKYO)).toEqual(
      before.map((product) =>
        product.productCode === 'TREAT001'
          ? {
              ...product,
              salonPrice: 4200,
              brand: null,
              requiresLotTracking: false,
              updatedAt: expect.any(String),
            }
          : product,
      ),
    )
  })

  it('should let the owner stop carrying a product, which the ledger then says', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      productChangeHrefOf(
        await salonIdOf(TOKYO),
        await productIdOf(TOKYO, 'COND001'),
      ),
      OWNER,
    )
    await openedForm('商品を直す')

    // Act
    await user.click(checkbox('取り扱い中'))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))
    await openedProduct()
    await user.click(screen.getByRole('link', { name: '商品台帳へ' }))

    // Assert
    await openedLedger()
    expect(rows()[2]).toEqual([
      'COND001',
      'Professional Conditioner 500ml',
      'Hair Care',
      'Salon Pro',
      '￥3,000',
      '店頭販売、施術',
      '取り扱いをやめた',
    ])
    expect((await storedProductsOf(TOKYO))[2]).toMatchObject({
      productCode: 'COND001',
      isActive: false,
    })
  })

  it('should let the owner remove a product the salon keeps no stock of, after asking', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      productChangeHrefOf(
        await salonIdOf(TOKYO),
        await productIdOf(TOKYO, 'WAX001'),
      ),
      OWNER,
    )
    await openedForm('商品を直す')
    await user.click(screen.getByRole('button', { name: '削除' }))
    const dialog = screen.getByRole('dialog', {
      name: '商品「Styling Wax 80g」を削除しますか？',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText('商品「Styling Wax 80g」を削除しました。'),
    ).toBeInTheDocument()
    await openedLedger()
    expect(rows().map(([code]) => code)).toEqual([
      'BLEACH001',
      'COLOR001',
      'COND001',
      'DEVELOPER001',
      'SHMP001',
      'TREAT001',
    ])
    expect(await removalsOf(TOKYO, 'WAX001')).toEqual([true])
  })

  it('should keep a product the salon keeps stock of, and say to stop carrying it instead', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    await openAs(
      productChangeHrefOf(
        await salonIdOf(TOKYO),
        await productIdOf(TOKYO, 'SHMP001'),
      ),
      OWNER,
    )
    await openedForm('商品を直す')
    await user.click(screen.getByRole('button', { name: '削除' }))

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '削除する',
      }),
    )

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '商品「Professional Shampoo 500ml」には在庫の記録があるので、削除できません。取り扱いをやめるときは、「取り扱い中」の印を外して保存してください。',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should say at the code that another product has it, one the salon no longer carries as well', async () => {
    // Arrange
    const user = userEvent.setup()
    await droppedMeanwhile(TOKYO, 'WAX001')
    const before = await storedProductsOf(TOKYO)
    await openAs(productEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm('商品を足す')
    await user.type(text(/^商品コード/), 'WAX001')
    await user.type(text(/^単位/), 'jar')
    await user.type(text(/^商品名/), 'Styling Wax 80g (new)')

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      await screen.findByText(
        /^この商品コードは、このサロンのほかの商品が使っています。/,
      ),
    ).toBeInTheDocument()
    expect(text(/^商品コード/)).toHaveAccessibleDescription(
      expect.stringContaining('取り扱いをやめた商品のコードも使えません。'),
    )
    expect(text(/^商品コード/)).toHaveFocus()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should say what is wrong before sending a new product, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    await openAs(productEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm('商品を足す')
    await user.clear(text(/^最低在庫数/))
    await user.type(text(/^最低在庫数/), '10')
    await user.type(text(/^発注点/), '5')
    await user.type(text('仕入価格'), '-100')
    await user.type(text(/^商品画像の URL/), 'javascript:alert(1)')

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(text(/^商品コード/)).toHaveAccessibleDescription(
      expect.stringContaining('商品コードを、100 文字以内で入力してください。'),
    )
    expect(text(/^商品コード/)).toHaveFocus()
    expect(text(/^発注点/)).toHaveAccessibleDescription(
      expect.stringContaining(
        '発注点は、最低在庫数と同じか、それより大きい数にしてください。',
      ),
    )
    expect(text('仕入価格')).toHaveAccessibleDescription(
      '仕入価格は、0 以上の円の整数で入力してください。',
    )
    expect(text(/^商品画像の URL/)).toHaveAccessibleDescription(
      expect.stringContaining(
        'ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      ),
    )
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should say at the minimum what the API compared with a reorder point somebody changed meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      productChangeHrefOf(
        await salonIdOf(TOKYO),
        await productIdOf(TOKYO, 'COLOR001'),
      ),
      MANAGER,
    )
    await openedForm('商品を直す')
    await reorderPointChangedMeanwhile(TOKYO, 'COLOR001', 12)
    const before = await storedProductsOf(TOKYO)
    await user.clear(text(/^最低在庫数/))
    await user.type(text(/^最低在庫数/), '15')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText(
        '最低在庫数は、発注点と最大在庫数と同じか、それより小さい数にしてください。',
      ),
    ).toBeInTheDocument()
    expect(text(/^最低在庫数/)).toHaveFocus()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should ask the API for nothing when the form is sent as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    await openAs(
      productChangeHrefOf(
        await salonIdOf(TOKYO),
        await productIdOf(TOKYO, 'BLEACH001'),
      ),
      OWNER,
    )
    await openedForm('商品を直す')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeInTheDocument()
    await openedProduct()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should say that a product removed meanwhile is not found, and write nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      productChangeHrefOf(
        await salonIdOf(TOKYO),
        await productIdOf(TOKYO, 'WAX001'),
      ),
      OWNER,
    )
    await openedForm('商品を直す')
    await removedMeanwhile(TOKYO, 'WAX001')
    await user.clear(text(/^販売価格/))
    await user.type(text(/^販売価格/), '1900')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await heading('商品が見つかりません')).toBeInTheDocument()
    expect(await removalsOf(TOKYO, 'WAX001')).toEqual([true])
  })

  it.each<[string, (salonId: string) => string]>([
    ['the entry', productEntryHrefOf],
    ['the change', (salonId) => productChangeHrefOf(salonId, 'product')],
  ])('should refuse a stylist the form of %s', async (_case, hrefOf) => {
    // Act
    await openAs(hrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このアカウントでは、商品を変えられません。商品を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it.each<[string, (salonId: string, productId: string) => string]>([
    ['the ledger', (salonId) => productsHrefOf(salonId)],
    ['a product', productHrefOf],
  ])(
    'should tell the manager of another salon that %s of its products is not theirs to see',
    async (_case, hrefOf) => {
      // Act
      await openAs(
        hrefOf(await salonIdOf(OSAKA), await productIdOf(OSAKA, 'SPA001')),
        MANAGER,
      )

      // Assert
      expect(
        await screen.findByText(
          'このサロンの商品は、見られません。商品を見られるのは、そのサロンのスタッフと、管理者です。',
        ),
      ).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    },
  )

  it.each<[string, string]>([
    ['an ID of no product', '0b0c4a39-5b5f-4f0e-8d5a-0c0a5e0d9999'],
    ['no ID at all', 'product'],
  ])(
    'should say that there is no product at an address with %s',
    async (_case, productId) => {
      // Act
      await openAs(productHrefOf(await salonIdOf(TOKYO), productId), STYLIST)

      // Assert
      expect(await heading('商品が見つかりません')).toBeInTheDocument()
    },
  )

  it.each<
    [
      string,
      (salonId: string, productId: string) => string,
      () => Promise<void>,
    ]
  >([
    ['the ledger', (salonId) => productsHrefOf(salonId), () => openedLedger()],
    ['a product', productHrefOf, openedProduct],
    [
      'the entry',
      (salonId) => productEntryHrefOf(salonId),
      () => openedForm('商品を足す'),
    ],
    ['the change', productChangeHrefOf, () => openedForm('商品を直す')],
  ])(
    'should have no accessibility violations on %s',
    async (_case, hrefOf, opened) => {
      // Arrange
      const { container } = renderAt(
        hrefOf(await salonIdOf(TOKYO), await productIdOf(TOKYO, 'SHMP001')),
      )
      await signInAs(OWNER)

      // Act
      await opened()

      // Assert
      expect(await findAccessibilityViolations(container)).toEqual([])
    },
  )
})
