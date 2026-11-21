import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  ADMIN,
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
} from '../bookings/__tests__/arrangements'
import {
  categoryChangeHrefOf,
  categoryEntryHrefOf,
  menuHrefOf,
  serviceHrefOf,
} from '../navigation'
import {
  arrangeChild,
  categoryIdOf,
  describedMeanwhile,
  putBelow,
  removedMeanwhile,
  serviceIdOf,
  storedCategoriesOf,
  storedServicesOf,
} from './__tests__/arrangements'

/*
 * The menu of a salon, read and kept against the API: the categories of
 * the seed data, Hair Cut to Other Services, and the services of the salon
 * in Tokyo in the first four of them. The manager and the owner keep the
 * menu of the salon in Tokyo; a stylist reads it. Somebody did something
 * meanwhile where a test says so.
 */

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** Opens a screen, signed in as an account of the seed data. */
const openAs = async (path: string, email: string): Promise<void> => {
  renderAt(path)
  await signInAs(email)
}

const TOP_CATEGORIES = [
  'Hair Cut',
  'Hair Color',
  'Perm',
  'Hair Treatment',
  'Head Spa',
  'Styling',
  'Hair Extension',
  'Other Services',
]

/** The rows of a table, each as the texts of its cells. */
const rowsOf = (table: HTMLElement): (string | null)[][] =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

const menuHeading = () =>
  screen.findByRole('heading', { level: 1, name: 'メニュー' })

/** The tables of the services, by their categories, once the menu was read */
const serviceTables = async (): Promise<HTMLElement[]> => {
  const part = await screen.findByRole('region', { name: 'サービス' })

  return within(part).getAllByRole('table')
}

const captionsOf = (tables: HTMLElement[]): (string | null | undefined)[] =>
  tables.map((table) => table.querySelector('caption')?.textContent)

const categoryTable = (): HTMLElement =>
  screen.getByRole('table', { name: 'カテゴリー' })

const parentChoices = (): (string | null)[] =>
  within(screen.getByRole('combobox', { name: '親カテゴリー' }))
    .getAllByRole('option')
    .map((option) => option.textContent)

const formHeading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** Waits for a form of a category: its heading comes first, the form once the categories were read. */
const openedForm = async (title: string): Promise<void> => {
  await formHeading(title)
  await screen.findByRole('textbox', { name: /名前/ })
}

describe('the menu, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead a stylist from the navigation to the menu, by category in its order, without the ways to change it', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(`/salons/${tokyo}/bookings`, STYLIST)

    // Act
    await user.click(
      await within(
        await screen.findByRole('navigation', { name: 'メインメニュー' }),
      ).findByRole('link', { name: 'メニュー' }),
    )

    // Assert
    await menuHeading()
    const tables = await serviceTables()
    expect(captionsOf(tables)).toEqual(TOP_CATEGORIES)
    expect(tables.slice(0, 2).map(rowsOf)).toEqual([
      [
        ['Ladies Cut', '60 分', '￥5,500・税込', '受ける', '有効'],
        ['Mens Cut', '45 分', '￥4,000・税込', '受ける', '有効'],
        ['Kids Cut (Under 12)', '30 分', '￥2,500・税込', '受ける', '有効'],
      ],
      [
        [
          'Full Color',
          '120 分',
          '￥7,200（￥8,000 から割引）・税込',
          '受ける',
          '有効',
        ],
        ['Highlights', '150 分', '￥12,000・税込', '受ける', '有効'],
        ['Balayage', '180 分', '￥15,000・税込', '受けない', '有効'],
      ],
    ])
    expect(rowsOf(tables[4] ?? document.body)).toEqual([
      ['このカテゴリーのサービスはありません'],
    ])
    expect(rowsOf(categoryTable()).slice(0, 2)).toEqual([
      ['Hair Cut', 'なし', 'カット', '1', '#FF6B6B', '有効'],
      ['Hair Color', 'なし', 'カラー', '2', '#4ECDC4', '有効'],
    ])
    expect(within(categoryTable()).queryAllByRole('link')).toEqual([])
    expect(
      screen.queryByRole('link', { name: 'カテゴリーを足す' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'サービスを足す' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'まとめて変える' }),
    ).not.toBeInTheDocument()
    expect(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: 'メニュー' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('should show what is switched off and the services of no category, last', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    await testApi().query(
      `update services set "isActive" = false, "serviceStatus" = 'coming_soon' where name = 'Balayage'`,
    )
    await testApi().query(
      `update services set "categoryId" = null where name = 'Keratin Treatment'`,
    )
    await testApi().query(
      `update service_categories set "isActive" = false where name = 'Perm' and "salonId" = $1`,
      [tokyo],
    )

    // Act
    await openAs(menuHrefOf(tokyo), STYLIST)

    // Assert
    const tables = await serviceTables()
    expect(captionsOf(tables)).toEqual([...TOP_CATEGORIES, '未分類'])
    expect(rowsOf(tables[1] ?? document.body)[2]).toEqual([
      'Balayage',
      '180 分',
      '￥15,000・税込',
      '受けない',
      '無効・近日公開',
    ])
    expect(rowsOf(tables[8] ?? document.body)).toEqual([
      ['Keratin Treatment', '90 分', '￥8,000・税込', '受ける', '有効'],
    ])
    expect(rowsOf(categoryTable())[2]).toEqual([
      'Perm',
      'なし',
      'パーマ',
      '3',
      '#45B7D1',
      '無効',
    ])
  })

  it('should lead from the menu to everything it keeps of a service, with its options', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(menuHrefOf(tokyo), STYLIST)

    // Act
    await user.click(
      within((await serviceTables())[0] ?? document.body).getByRole('link', {
        name: 'Ladies Cut',
      }),
    )

    // Assert
    await formHeading('サービスの内容')
    const service = await screen.findByRole('region', { name: 'サービス' })
    expect(
      within(service)
        .getAllByRole('term')
        .map((term) => [term.textContent, term.nextElementSibling?.textContent])
        .slice(0, 9),
    ).toEqual([
      ['名前', 'Ladies Cut'],
      ['カテゴリー', 'Hair Cut'],
      ['状態', '有効'],
      ['所要時間', '60 分'],
      ['料金', '￥5,500・税込'],
      ['価格の決め方', '固定価格'],
      ['提供日', '常時提供'],
      ['表示順', '1'],
      ['短い紹介', 'Includes shampoo, cut, and blow dry'],
    ])
    expect(
      within(screen.getByRole('region', { name: '予約' })).getByText(
        'スタイリスト以上',
      ),
    ).toBeInTheDocument()
    expect(rowsOf(screen.getByRole('table', { name: 'オプション' }))).toEqual([
      ['Fringe Trim', 'アドオン', '10 分', '￥500', '1 まで', '任意', '有効'],
      [
        'Hair Treatment Add-on',
        'アドオン',
        '20 分',
        '￥2,000',
        '1 まで',
        '任意',
        '有効',
      ],
    ])
  })

  it('should show an administrator the services of a package, each leading to its own', async () => {
    // Arrange
    const user = userEvent.setup()
    const osaka = await salonIdOf(OSAKA)
    await openAs(
      serviceHrefOf(osaka, await serviceIdOf('Spa & Cut Package')),
      ADMIN,
    )

    // Act
    const packaged = await screen.findByRole('region', {
      name: 'パッケージのサービス',
    })

    // Assert
    expect(
      within(packaged)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Head Spa (30 min)', 'Scalp Treatment', 'Signature Cut'])

    // Act
    await user.click(
      within(packaged).getByRole('link', { name: 'Signature Cut' }),
    )

    // Assert
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'サービス' })).getAllByRole(
          'definition',
        )[0]?.textContent,
      ).toBe('Signature Cut'),
    )
  })

  it('should let the manager add a category below another, at the end of the menu', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(menuHrefOf(tokyo), MANAGER)

    // Act
    await user.click(
      await screen.findByRole('link', { name: 'カテゴリーを足す' }),
    )
    await openedForm('カテゴリーを足す')
    expect(screen.getByRole('textbox', { name: /表示順/ })).toHaveValue('9')
    await user.type(screen.getByRole('textbox', { name: /名前/ }), 'Bob Cut')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /種類/ }),
      'カット',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '親カテゴリー' }),
      'Hair Cut',
    )
    await user.type(screen.getByRole('textbox', { name: '色' }), '#aa66cc')
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      await screen.findByText(
        'カテゴリー「Bob Cut」を、メニューに足しました。',
      ),
    ).toBeInTheDocument()
    await menuHeading()
    expect(captionsOf(await serviceTables())).toEqual([
      ...TOP_CATEGORIES,
      'Hair Cut › Bob Cut',
    ])
    expect(rowsOf(categoryTable())[8]).toEqual([
      'Bob Cut',
      'Hair Cut',
      'カット',
      '9',
      '#AA66CC',
      '有効',
    ])
    expect(
      (await storedCategoriesOf(TOKYO)).find(({ name }) => name === 'Bob Cut'),
    ).toMatchObject({
      description: null,
      parent: 'Hair Cut',
      category: 'cut',
      displayOrder: 9,
      iconUrl: null,
      color: '#AA66CC',
      isActive: true,
    })
  })

  it('should let the owner change only what was changed, and leave what somebody else wrote meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const color = await categoryIdOf(TOKYO, 'Hair Color')
    await openAs(menuHrefOf(tokyo), OWNER)
    await user.click(
      await within(
        await screen.findByRole('table', { name: 'カテゴリー' }),
      ).findByRole('link', { name: 'Hair Color' }),
    )
    await openedForm('カテゴリーを直す')
    await describedMeanwhile(color, 'Written by the manager')

    // Act
    await user.clear(screen.getByRole('textbox', { name: '色' }))
    await user.type(screen.getByRole('textbox', { name: '色' }), '#123456')
    await user.click(screen.getByRole('checkbox', { name: '有効' }))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('カテゴリー「Hair Color」を直しました。'),
    ).toBeInTheDocument()
    await menuHeading()
    expect(
      (await storedCategoriesOf(TOKYO)).find(
        ({ name }) => name === 'Hair Color',
      ),
    ).toMatchObject({
      description: 'Written by the manager',
      color: '#123456',
      isActive: false,
    })
  })

  it('should not offer a category itself nor what is below it as its parent', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    const color = await categoryIdOf(TOKYO, 'Hair Color')
    await arrangeChild(TOKYO, 'Hair Color', 'Highlights Group')

    // Act
    await openAs(categoryChangeHrefOf(tokyo, color), OWNER)

    // Assert
    await openedForm('カテゴリーを直す')
    expect(screen.getByRole('textbox', { name: /名前/ })).toHaveValue(
      'Hair Color',
    )
    expect(parentChoices()).toEqual([
      'なし（最上位のカテゴリー）',
      ...TOP_CATEGORIES.filter((name) => name !== 'Hair Color'),
    ])
  })

  it('should ask the API for nothing when the form is sent as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const before = await storedCategoriesOf(TOKYO)
    await openAs(
      categoryChangeHrefOf(tokyo, await categoryIdOf(TOKYO, 'Perm')),
      MANAGER,
    )
    await openedForm('カテゴリーを直す')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('変更はありませんでした。'),
    ).toBeInTheDocument()
    await menuHeading()
    expect(await storedCategoriesOf(TOKYO)).toEqual(before)
  })

  it('should remove a category after asking, and keep its children at the top and its services of none', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await arrangeChild(TOKYO, 'Hair Cut', 'Short Cut')
    await openAs(
      categoryChangeHrefOf(tokyo, await categoryIdOf(TOKYO, 'Hair Cut')),
      OWNER,
    )
    await openedForm('カテゴリーを直す')

    // Act
    await user.click(screen.getByRole('button', { name: '削除' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'カテゴリー「Hair Cut」を削除しますか？',
    })
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText(
        'カテゴリー「Hair Cut」を、メニューから削除しました。',
      ),
    ).toBeInTheDocument()
    await menuHeading()
    const tables = await serviceTables()
    expect(captionsOf(tables)).toEqual([
      ...TOP_CATEGORIES.slice(1),
      'Short Cut',
      '未分類',
    ])
    expect(rowsOf(tables[8] ?? document.body).map(([name]) => name)).toEqual([
      'Ladies Cut',
      'Mens Cut',
      'Kids Cut (Under 12)',
    ])
    const stored = await storedCategoriesOf(TOKYO)
    expect(stored.map(({ name }) => name)).not.toContain('Hair Cut')
    expect(stored.find(({ name }) => name === 'Short Cut')?.parent).toBeNull()
    expect(
      (await storedServicesOf(TOKYO)).filter(
        ({ category }) => category === null,
      ),
    ).toEqual([
      { name: 'Kids Cut (Under 12)', category: null },
      { name: 'Ladies Cut', category: null },
      { name: 'Mens Cut', category: null },
    ])
  })

  it('should say at the parent that it was removed meanwhile, and offer what there is now', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(categoryEntryHrefOf(tokyo), MANAGER)
    await openedForm('カテゴリーを足す')
    await user.type(screen.getByRole('textbox', { name: /名前/ }), 'Updo')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /種類/ }),
      'スタイリング',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '親カテゴリー' }),
      'Styling',
    )
    await removedMeanwhile(await categoryIdOf(TOKYO, 'Styling'))

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: '親カテゴリー' }),
      ).toHaveAccessibleDescription(
        /この親カテゴリーは、その間に削除されていました。親を選び直してください。/,
      ),
    )
    await waitFor(() => expect(parentChoices()).not.toContain('Styling'))
    expect(screen.getByRole('textbox', { name: /名前/ })).toHaveValue('Updo')
    expect(
      (await storedCategoriesOf(TOKYO)).map(({ name }) => name),
    ).not.toContain('Updo')
  })

  it('should say at the parent that it came below the category meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const perm = await categoryIdOf(TOKYO, 'Perm')
    await openAs(categoryChangeHrefOf(tokyo, perm), OWNER)
    await openedForm('カテゴリーを直す')
    await user.selectOptions(
      screen.getByRole('combobox', { name: '親カテゴリー' }),
      'Hair Treatment',
    )
    await putBelow(await categoryIdOf(TOKYO, 'Hair Treatment'), perm)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: '親カテゴリー' }),
      ).toHaveAccessibleDescription(
        /このカテゴリーの下にあるカテゴリーは、親にできません。/,
      ),
    )
    await waitFor(() => expect(parentChoices()).not.toContain('Hair Treatment'))
    expect(
      (await storedCategoriesOf(TOKYO)).find(({ name }) => name === 'Perm')
        ?.parent,
    ).toBeNull()
  })

  it('should say a category removed meanwhile is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const spa = await categoryIdOf(TOKYO, 'Head Spa')
    await openAs(categoryChangeHrefOf(tokyo, spa), MANAGER)
    await openedForm('カテゴリーを直す')
    await user.type(screen.getByRole('textbox', { name: /名前/ }), ' Plus')
    await removedMeanwhile(spa)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await formHeading('カテゴリーが見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'メニューへ' })).toHaveAttribute(
      'href',
      menuHrefOf(tokyo),
    )
  })

  it('should refuse a stylist the forms of the menu', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)

    // Act
    await openAs(
      categoryChangeHrefOf(tokyo, await categoryIdOf(TOKYO, 'Perm')),
      STYLIST,
    )

    // Assert
    expect(
      await screen.findByText(
        'このアカウントでは、メニューを変えられません。メニューを変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('should tell the manager of another salon that its menu is not theirs to change', async () => {
    // Arrange
    const user = userEvent.setup()
    const osaka = await salonIdOf(OSAKA)
    await openAs(categoryEntryHrefOf(osaka), MANAGER)
    await openedForm('カテゴリーを足す')
    await user.type(screen.getByRole('textbox', { name: /名前/ }), 'Nail')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /種類/ }),
      'その他',
    )

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    )
    expect(
      (await storedCategoriesOf(OSAKA)).map(({ name }) => name),
    ).not.toContain('Nail')
  })

  it('should have no accessibility violations on the menu', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    const { container } = renderAt(menuHrefOf(tokyo))
    await signInAs(OWNER)

    // Act
    await serviceTables()

    // Assert
    expect(await findAccessibilityViolations(container)).toEqual([])
  })

  it('should have no accessibility violations on the form of a category', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    const { container } = renderAt(
      categoryChangeHrefOf(tokyo, await categoryIdOf(TOKYO, 'Hair Color')),
    )
    await signInAs(OWNER)

    // Act
    await openedForm('カテゴリーを直す')

    // Assert
    expect(await findAccessibilityViolations(container)).toEqual([])
  })
})
