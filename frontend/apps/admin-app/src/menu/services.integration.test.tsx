import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
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
  menuHrefOf,
  serviceChangeHrefOf,
  serviceEntryHrefOf,
  serviceHrefOf,
} from '../navigation'
import {
  categoryIdOf,
  removedMeanwhile,
  serviceDescribedMeanwhile,
  serviceIdOf,
  serviceRemovedMeanwhile,
  storedServicesNamed,
} from './__tests__/arrangements'

/*
 * The services of the menu, added, changed and removed against the API.
 * The salon in Tokyo has ten services of the seed data, Ladies Cut first;
 * Ladies Cut is in a booking that is not over yet, Highlights in none. The
 * salon in Osaka has the package Spa & Cut Package, of Head Spa (30 min),
 * Scalp Treatment and Signature Cut. The manager and the owner keep the
 * menu of the salon in Tokyo, an administrator that of every salon.
 * Somebody did something meanwhile where a test says so.
 */

const TITLE = 'Beauty Salon Admin'

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

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** Waits for a form of a service: its heading comes first, the form once the menu was read. */
const openedForm = async (title: string): Promise<void> => {
  await heading(title)
  await screen.findByRole('group', { name: 'サービス' })
}

const text = (name: string): HTMLElement =>
  within(screen.getByRole('group', { name: 'サービス' })).getByRole('textbox', {
    name,
  })

const field = (part: string, role: 'textbox' | 'combobox', name: string) =>
  within(screen.getByRole('group', { name: part })).getByRole(role, { name })

const row = (name: string): HTMLElement => screen.getByRole('group', { name })

/** What the record of a service says, term by term, once it was read. */
const termsOf = async (card: string): Promise<[string, string][]> =>
  within(await screen.findByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('the services of the menu, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should let the manager add a service with an option from the menu, and show it', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(menuHrefOf(tokyo), MANAGER)
    await user.click(
      await screen.findByRole('link', { name: 'サービスを足す' }),
    )
    await openedForm('サービスを足す')
    expect(text('表示順')).toHaveValue('11')

    // Act
    await user.type(text('名前'), 'Bangs Trim')
    await user.selectOptions(
      within(row('サービス')).getByRole('combobox', { name: 'カテゴリー' }),
      'Hair Cut',
    )
    await user.type(text('タグ'), '人気、早い')
    await user.type(field('時間と料金', 'textbox', '所要時間（分）'), '15')
    await user.type(field('時間と料金', 'textbox', '料金'), '１５００')
    await user.type(field('時間と料金', 'textbox', '割引後の料金'), '1200')
    await user.click(screen.getByRole('checkbox', { name: 'パッチテスト必須' }))
    await user.selectOptions(
      field('予約', 'combobox', '担当できるスタッフ'),
      'スタイリスト以上',
    )
    await user.click(screen.getByRole('button', { name: 'オプションを足す' }))
    await user.type(
      within(row('オプション 1')).getByRole('textbox', { name: '名前' }),
      'Fringe Styling',
    )
    await user.clear(
      within(row('オプション 1')).getByRole('textbox', { name: '追加の料金' }),
    )
    await user.type(
      within(row('オプション 1')).getByRole('textbox', { name: '追加の料金' }),
      '300',
    )
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      await screen.findByText(
        'サービス「Bangs Trim」を、メニューに足しました。',
      ),
    ).toBeInTheDocument()
    await heading('サービスの内容')
    expect(await termsOf('サービス')).toEqual(
      expect.arrayContaining([
        ['名前', 'Bangs Trim'],
        ['カテゴリー', 'Hair Cut'],
        ['料金', '￥1,200（￥1,500 から割引）・税込'],
      ]),
    )
    expect(await storedServicesNamed(TOKYO, 'Bangs Trim')).toEqual([
      {
        name: 'Bangs Trim',
        category: 'Hair Cut',
        description: null,
        duration: 15,
        price: 1500,
        discountPrice: 1200,
        taxIncluded: true,
        requiredStaffLevel: 'stylist',
        bookingRequirements: ['patch_test_required'],
        tags: ['人気', '早い'],
        isPackage: false,
        packaged: [],
        options: [
          { name: 'Fringe Styling', additionalPrice: 300, sortOrder: 0 },
        ],
        removed: false,
      },
    ])
  })

  it('should let the manager add a package of two services, in the order chosen', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(serviceEntryHrefOf(tokyo), MANAGER)
    await openedForm('サービスを足す')
    await user.type(text('名前'), 'Cut & Color')
    await user.type(field('時間と料金', 'textbox', '所要時間（分）'), '180')
    await user.type(field('時間と料金', 'textbox', '料金'), '12000')

    // Act
    await user.click(screen.getByRole('checkbox', { name: 'パッケージにする' }))
    await user.selectOptions(
      within(row('構成サービス 1')).getByRole('combobox', { name: 'サービス' }),
      'Full Color',
    )
    await user.selectOptions(
      within(row('構成サービス 2')).getByRole('combobox', { name: 'サービス' }),
      'Ladies Cut',
    )
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    await heading('サービスの内容')
    expect(await storedServicesNamed(TOKYO, 'Cut & Color')).toMatchObject([
      { isPackage: true, packaged: ['Full Color', 'Ladies Cut'] },
    ])
  })

  it('should say what is wrong before sending, at the control and at the package', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(serviceEntryHrefOf(tokyo), MANAGER)
    await openedForm('サービスを足す')
    await user.type(text('名前'), 'Quick Blow')
    await user.type(field('時間と料金', 'textbox', '所要時間（分）'), '20')
    await user.type(field('時間と料金', 'textbox', '料金'), '2000')
    await user.type(field('時間と料金', 'textbox', '割引後の料金'), '2500')
    await user.click(screen.getByRole('checkbox', { name: 'パッケージにする' }))
    await user.click(
      screen.getByRole('button', { name: '構成サービス 2 を外す' }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      field('時間と料金', 'textbox', '割引後の料金'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('割引後の料金は、料金以下にしてください。'),
    )
    expect(field('時間と料金', 'textbox', '割引後の料金')).toHaveFocus()
    expect(
      screen.getByRole('checkbox', { name: 'パッケージにする' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'パッケージにするときは、構成サービスを 2 件から 20 件まで選んでください。',
      ),
    )
    expect(await storedServicesNamed(TOKYO, 'Quick Blow')).toEqual([])
  })

  it('should let the owner change only what was changed, from the page of the service, and leave what somebody else wrote meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const highlights = await serviceIdOf('Highlights')
    await openAs(serviceHrefOf(tokyo, highlights), OWNER)
    await user.click(
      await screen.findByRole('link', { name: 'サービスを直す' }),
    )
    await openedForm('サービスを直す')
    await serviceDescribedMeanwhile(highlights, 'Written by the manager')

    // Act
    await user.clear(field('時間と料金', 'textbox', '料金'))
    await user.type(field('時間と料金', 'textbox', '料金'), '13000')
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('サービス「Highlights」を直しました。'),
    ).toBeInTheDocument()
    await heading('サービスの内容')
    expect(await termsOf('サービス')).toEqual(
      expect.arrayContaining([['料金', '￥13,000・税込']]),
    )
    expect(await storedServicesNamed(TOKYO, 'Highlights')).toMatchObject([
      { description: 'Written by the manager', price: 13000 },
    ])
  })

  it('should put the options of the form in place of those of the service', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(
      serviceChangeHrefOf(tokyo, await serviceIdOf('Ladies Cut')),
      MANAGER,
    )
    await openedForm('サービスを直す')

    // Act
    await user.click(
      screen.getByRole('button', { name: 'オプション 1 を外す' }),
    )
    await user.click(screen.getByRole('button', { name: 'オプションを足す' }))
    await user.type(
      within(row('オプション 2')).getByRole('textbox', { name: '名前' }),
      'Scalp Massage',
    )
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await heading('サービスの内容')
    expect(
      (await storedServicesNamed(TOKYO, 'Ladies Cut'))[0]?.options,
    ).toEqual([
      { name: 'Hair Treatment Add-on', additionalPrice: 2000, sortOrder: 0 },
      { name: 'Scalp Massage', additionalPrice: 0, sortOrder: 1 },
    ])
  })

  it('should undo a package, its services and its box both', async () => {
    // Arrange
    const user = userEvent.setup()
    const osaka = await salonIdOf(OSAKA)
    await openAs(
      serviceChangeHrefOf(osaka, await serviceIdOf('Spa & Cut Package')),
      ADMIN,
    )
    await openedForm('サービスを直す')

    // Act
    await user.click(screen.getByRole('checkbox', { name: 'パッケージにする' }))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await heading('サービスの内容')
    expect(await storedServicesNamed(OSAKA, 'Spa & Cut Package')).toMatchObject(
      [{ isPackage: false, packaged: [] }],
    )
  })

  it('should ask the API for nothing when the form is sent as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const before = await storedServicesNamed(TOKYO, 'Ladies Cut')
    await openAs(
      serviceChangeHrefOf(tokyo, await serviceIdOf('Ladies Cut')),
      MANAGER,
    )
    await openedForm('サービスを直す')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('変更はありませんでした。'),
    ).toBeInTheDocument()
    await heading('サービスの内容')
    expect(await storedServicesNamed(TOKYO, 'Ladies Cut')).toEqual(before)
  })

  it('should remove a service after asking, and leave the menu without it', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(
      serviceChangeHrefOf(tokyo, await serviceIdOf('Highlights')),
      OWNER,
    )
    await openedForm('サービスを直す')

    // Act
    await user.click(screen.getByRole('button', { name: '削除' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'サービス「Highlights」を削除しますか？',
    })
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText(
        'サービス「Highlights」を、メニューから削除しました。',
      ),
    ).toBeInTheDocument()
    await heading('メニュー')
    expect(
      within(
        await screen.findByRole('table', { name: 'Hair Color' }),
      ).queryByRole('link', { name: 'Highlights' }),
    ).toBeNull()
    expect(await storedServicesNamed(TOKYO, 'Highlights')).toMatchObject([
      { removed: true },
    ])
  })

  it.each<[string, string, string, string]>([
    [
      'a package has',
      OSAKA,
      'Head Spa (30 min)',
      'サービス「Head Spa (30 min)」は、パッケージ「Spa & Cut Package」に入っているので、削除できません。先に、パッケージの構成サービスから外してください。',
    ],
    [
      'a booking not over yet has',
      TOKYO,
      'Ladies Cut',
      'サービス「Ladies Cut」は、終わっていない予約の施術明細にあるので、削除できません。その予約を終えるか、キャンセルするか、明細を外してから削除してください。',
    ],
  ])(
    'should keep a service %s, and say what to do first',
    async (_, salon, name, message) => {
      // Arrange
      const user = userEvent.setup()
      await openAs(
        serviceChangeHrefOf(await salonIdOf(salon), await serviceIdOf(name)),
        ADMIN,
      )
      await openedForm('サービスを直す')

      // Act
      await user.click(screen.getByRole('button', { name: '削除' }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await storedServicesNamed(salon, name)).toMatchObject([
        { removed: false },
      ])
    },
  )

  it('should say at the category that it was removed meanwhile, and offer what there is now', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(serviceEntryHrefOf(tokyo), MANAGER)
    await openedForm('サービスを足す')
    await user.type(text('名前'), 'Updo')
    await user.selectOptions(
      within(row('サービス')).getByRole('combobox', { name: 'カテゴリー' }),
      'Styling',
    )
    await user.type(field('時間と料金', 'textbox', '所要時間（分）'), '60')
    await user.type(field('時間と料金', 'textbox', '料金'), '6000')
    await removedMeanwhile(await categoryIdOf(TOKYO, 'Styling'))

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    const category = within(row('サービス')).getByRole('combobox', {
      name: 'カテゴリー',
    })
    await waitFor(() =>
      expect(category).toHaveAccessibleDescription(
        /このカテゴリーは、その間に削除されていました。/,
      ),
    )
    await waitFor(() =>
      expect(
        within(category)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).not.toContain('Styling'),
    )
    expect(text('名前')).toHaveValue('Updo')
    expect(await storedServicesNamed(TOKYO, 'Updo')).toEqual([])
  })

  it('should say at the package that one of its services was removed meanwhile, and offer what there is now', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(serviceEntryHrefOf(tokyo), MANAGER)
    await openedForm('サービスを足す')
    await user.type(text('名前'), 'Cut & Perm')
    await user.type(field('時間と料金', 'textbox', '所要時間（分）'), '150')
    await user.type(field('時間と料金', 'textbox', '料金'), '14000')
    await user.click(screen.getByRole('checkbox', { name: 'パッケージにする' }))
    await user.selectOptions(
      within(row('構成サービス 1')).getByRole('combobox', { name: 'サービス' }),
      'Mens Cut',
    )
    await user.selectOptions(
      within(row('構成サービス 2')).getByRole('combobox', { name: 'サービス' }),
      'Straight Perm',
    )
    await serviceRemovedMeanwhile(await serviceIdOf('Straight Perm'))

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'パッケージにする' }),
      ).toHaveAccessibleDescription(
        /構成サービスのどれかが、その間に削除されたか、パッケージになっていました。/,
      ),
    )
    await waitFor(() =>
      expect(
        within(row('構成サービス 2'))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).not.toContain('Straight Perm'),
    )
    expect(await storedServicesNamed(TOKYO, 'Cut & Perm')).toEqual([])
  })

  it('should say a service removed meanwhile is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const balayage = await serviceIdOf('Balayage')
    await openAs(serviceChangeHrefOf(tokyo, balayage), MANAGER)
    await openedForm('サービスを直す')
    await user.type(text('名前'), ' Plus')
    await serviceRemovedMeanwhile(balayage)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await heading('サービスが見つかりません')).toBeInTheDocument()
  })

  it('should offer a stylist no way to change a service', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)

    // Act
    await openAs(serviceHrefOf(tokyo, await serviceIdOf('Mens Cut')), STYLIST)

    // Assert
    expect(
      await screen.findByRole('region', { name: 'サービス' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'サービスを直す' }),
    ).not.toBeInTheDocument()
  })

  it('should refuse a stylist the form of a new service', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)

    // Act
    await openAs(serviceEntryHrefOf(tokyo), STYLIST)

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
    await openAs(serviceEntryHrefOf(osaka), MANAGER)
    await openedForm('サービスを足す')
    await user.type(text('名前'), 'Nail Care')
    await user.type(field('時間と料金', 'textbox', '所要時間（分）'), '30')
    await user.type(field('時間と料金', 'textbox', '料金'), '3000')

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    )
    expect(await storedServicesNamed(OSAKA, 'Nail Care')).toEqual([])
  })

  it('should have no accessibility violations on the form of a service', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    const { container } = renderAt(
      serviceChangeHrefOf(tokyo, await serviceIdOf('Ladies Cut')),
    )
    await signInAs(OWNER)

    // Act
    await openedForm('サービスを直す')

    // Assert
    expect(await findAccessibilityViolations(container)).toEqual([])
  })

  it('should have no accessibility violations on the form of a package', async () => {
    // Arrange
    const osaka = await salonIdOf(OSAKA)
    const { container } = renderAt(
      serviceChangeHrefOf(osaka, await serviceIdOf('Spa & Cut Package')),
    )
    await signInAs(ADMIN)

    // Act
    await openedForm('サービスを直す')

    // Assert
    expect(await findAccessibilityViolations(container)).toEqual([])
  })
})
