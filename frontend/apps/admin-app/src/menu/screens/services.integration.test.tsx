import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  heading,
  optionsOf,
  rowsOf,
  termsOnceThere,
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
  menuHrefOf,
  serviceChangeHrefOf,
  serviceEntryHrefOf,
  serviceHrefOf,
} from '../../navigation'
import {
  categoryIdOf,
  removedMeanwhile,
  serviceDescribedMeanwhile,
  serviceIdOf,
  serviceRemovedMeanwhile,
  storedServicesNamed,
} from '../__tests__/arrangements'

/*
 * The services of the menu, added, changed and removed against the API.
 * The salon in Tokyo has ten services of the seed data, Ladies Cut first;
 * Ladies Cut is in a booking that is not over yet, Highlights in none. The
 * salon in Osaka has the package Spa & Cut Package, of Head Spa (30 min),
 * Scalp Treatment and Signature Cut. The manager and the owner keep the
 * menu of the salon in Tokyo, an administrator that of every salon.
 * Somebody did something meanwhile where a test says so.
 */

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

describe('the services of the menu, against the API', () => {
  beforeEach(() => {
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
    expect(await termsOnceThere('サービス')).toEqual(
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
    expect(await termsOnceThere('サービス')).toEqual(
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
      OPERATOR,
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
      await screen.findByText('変更された項目はありません。'),
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
        OPERATOR,
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
    await waitFor(() => expect(optionsOf(category)).not.toContain('Styling'))
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
      expect(optionsOf(row('構成サービス 2'))).not.toContain('Straight Perm'),
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
    await signInAs(OPERATOR)

    // Act
    await openedForm('サービスを直す')

    // Assert
    expect(await findAccessibilityViolations(container)).toEqual([])
  })
})

describe('the services of the menu on a page in English', () => {
  /** Waits for a form of a service in English: its heading, then the form. */
  const openedFormInEnglish = async (title: string): Promise<void> => {
    await heading(title)
    await screen.findByRole('group', { name: 'Service' })
  }

  const textInEnglish = (name: string): HTMLElement =>
    within(screen.getByRole('group', { name: 'Service' })).getByRole(
      'textbox',
      { name },
    )

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should let the manager add a service with an option in English, and show it', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(menuHrefOf(tokyo), MANAGER, 'en')
    await user.click(await screen.findByRole('link', { name: 'Add a service' }))
    await openedFormInEnglish('Add a service')

    // Act
    await user.type(textInEnglish('Name'), 'Bangs Trim')
    await user.selectOptions(
      within(row('Service')).getByRole('combobox', { name: 'Category' }),
      'Hair Cut',
    )
    await user.type(
      field('Time and price', 'textbox', 'Duration (minutes)'),
      '15',
    )
    await user.type(field('Time and price', 'textbox', 'Price'), '1500')
    await user.type(
      field('Time and price', 'textbox', 'Discounted price'),
      '1200',
    )
    await user.selectOptions(
      field('Booking', 'combobox', 'Staff who can do it'),
      'Stylist or above',
    )
    await user.click(screen.getByRole('button', { name: 'Add an option' }))
    await user.type(
      within(row('Option 1')).getByRole('textbox', { name: 'Name' }),
      'Fringe Styling',
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Assert
    expect(
      await screen.findByText('Added the service “Bangs Trim” to the menu.'),
    ).toBeInTheDocument()
    await heading('Service details')
    expect(await termsOnceThere('Service')).toEqual(
      expect.arrayContaining([
        ['Name', 'Bangs Trim'],
        ['Category', 'Hair Cut'],
        ['Duration', '15 min'],
        ['Price', '¥1,200 (discounted from ¥1,500) · Tax included'],
      ]),
    )
    expect(
      within(screen.getByRole('region', { name: 'Booking' })).getByText(
        'Stylist or above',
      ),
    ).toBeInTheDocument()
    expect(rowsOf(screen.getByRole('table', { name: 'Options' }))).toEqual([
      [
        'Fringe Styling',
        'Add-on',
        '0 min',
        '¥0',
        'Up to 1',
        'Optional',
        'Active',
      ],
    ])
  })

  it('should say in English what is wrong before sending, at the control and at the package', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(serviceEntryHrefOf(tokyo), MANAGER, 'en')
    await openedFormInEnglish('Add a service')
    await user.type(textInEnglish('Name'), 'Quick Blow')
    await user.type(
      field('Time and price', 'textbox', 'Duration (minutes)'),
      '2000',
    )
    await user.type(field('Time and price', 'textbox', 'Price'), '2000')
    await user.type(
      field('Time and price', 'textbox', 'Discounted price'),
      '2500',
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Make it a package' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Remove packaged service 2' }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Assert
    expect(
      field('Time and price', 'textbox', 'Duration (minutes)'),
    ).toHaveAccessibleDescription(
      'A whole number from 1 to 1,440. Enter the duration as a whole number of minutes from 1 to 1,440.',
    )
    expect(
      field('Time and price', 'textbox', 'Discounted price'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('The discounted price can be at most the price.'),
    )
    expect(
      screen.getByRole('checkbox', { name: 'Make it a package' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'Choose 2 to 20 packaged services for a package.',
      ),
    )
    expect(await storedServicesNamed(TOKYO, 'Quick Blow')).toEqual([])
  })

  it('should remove a service after asking in English, and say so', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(
      serviceChangeHrefOf(tokyo, await serviceIdOf('Highlights')),
      OWNER,
      'en',
    )
    await openedFormInEnglish('Edit the service')

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Remove the service “Highlights”?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    // Assert
    expect(
      await screen.findByText(
        'Removed the service “Highlights” from the menu.',
      ),
    ).toBeInTheDocument()
    await heading('Menu')
  })

  it.each<[string, string, string, string]>([
    [
      'a package has',
      OSAKA,
      'Head Spa (30 min)',
      'The service “Head Spa (30 min)” is in the package “Spa & Cut Package”, so it cannot be removed. Take it out of the packaged services first.',
    ],
    [
      'a booking not over yet has',
      TOKYO,
      'Ladies Cut',
      'The service “Ladies Cut” is on the lines of bookings that are not finished, so it cannot be removed. Finish or cancel those bookings, or take the lines off them, then remove it.',
    ],
  ])(
    'should keep a service %s, and say in English what to do first',
    async (_, salon, name, message) => {
      // Arrange
      const user = userEvent.setup()
      await openAs(
        serviceChangeHrefOf(await salonIdOf(salon), await serviceIdOf(name)),
        OPERATOR,
        'en',
      )
      await openedFormInEnglish('Edit the service')

      // Act
      await user.click(screen.getByRole('button', { name: 'Remove' }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
    },
  )

  it('should say in English at the package that one of its services was removed meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(serviceEntryHrefOf(tokyo), MANAGER, 'en')
    await openedFormInEnglish('Add a service')
    await user.type(textInEnglish('Name'), 'Cut & Perm')
    await user.type(
      field('Time and price', 'textbox', 'Duration (minutes)'),
      '150',
    )
    await user.type(field('Time and price', 'textbox', 'Price'), '14000')
    await user.click(
      screen.getByRole('checkbox', { name: 'Make it a package' }),
    )
    await user.selectOptions(
      within(row('Packaged service 1')).getByRole('combobox', {
        name: 'Service',
      }),
      'Mens Cut',
    )
    await user.selectOptions(
      within(row('Packaged service 2')).getByRole('combobox', {
        name: 'Service',
      }),
      'Straight Perm',
    )
    await serviceRemovedMeanwhile(await serviceIdOf('Straight Perm'))

    // Act
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Make it a package' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining(
          'One of the packaged services was removed or made a package meanwhile. Choose again.',
        ),
      ),
    )
  })

  it('should say in English that a service removed meanwhile is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const balayage = await serviceIdOf('Balayage')
    await openAs(serviceChangeHrefOf(tokyo, balayage), MANAGER, 'en')
    await openedFormInEnglish('Edit the service')
    await user.type(textInEnglish('Name'), ' Plus')
    await serviceRemovedMeanwhile(balayage)

    // Act
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // Assert
    expect(await heading('Service not found')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Check that the address is right. A service removed from the menu cannot be shown.',
      ),
    ).toBeInTheDocument()
  })

  it('should refuse a stylist the form of a new service in English', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)

    // Act
    await openAs(serviceEntryHrefOf(tokyo), STYLIST, 'en')

    // Assert
    expect(
      await screen.findByText(
        'This account cannot change the menu. Only the owners and managers of the salon, and administrators, can change the menu.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
