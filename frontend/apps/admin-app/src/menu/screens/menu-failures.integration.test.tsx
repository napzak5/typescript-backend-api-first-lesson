import {
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { salonRemovedMeanwhile } from '../../bookings/__tests__/arrangements'
import {
  categoryEntryHrefOf,
  menuHrefOf,
  serviceEntryHrefOf,
  serviceHrefOf,
  servicesChangeHrefOf,
} from '../../navigation'
import {
  categoryIdOf,
  everyCategoryRemoved,
  everyServiceRemoved,
  serviceIdOf,
  serviceRemovedMeanwhile,
  storedCategoriesOf,
} from '../__tests__/arrangements'
import {
  CATEGORIES_UNREAD,
  MENU_UNREAD,
  openedCategoryForm,
  openedMenu,
  openedServiceForm,
  openedServicesForm,
  SERVICE_UNREAD,
  serviceField,
  serviceText,
} from '../__tests__/screens'

/*
 * The menu, a service, the forms of a new category and of a new service,
 * and the form that changes several services, when a read fails and when
 * the salon changes before a form is sent. The failures are arranged in
 * the database; what goes well is in `menu.integration.test.tsx`,
 * `services.integration.test.tsx` and
 * `services-change.integration.test.tsx`.
 */

type User = ReturnType<typeof userEvent.setup>

/** Lets the categories of the salon in Tokyo be read no more, and gives back what lets them be read again */
const categoriesUnreadable = async (): Promise<() => Promise<void>> =>
  unreadable(
    'service_categories',
    'createdAt',
    await categoryIdOf(TOKYO, 'Styling'),
  )

/** Fills what a new category must have */
const fillNewCategory = async (user: User): Promise<void> => {
  await user.type(screen.getByRole('textbox', { name: /名前/ }), 'Updo')
  await user.selectOptions(
    screen.getByRole('combobox', { name: /種類/ }),
    'カット',
  )
}

/** Fills what a new service must have */
const fillNewService = async (user: User): Promise<void> => {
  await user.type(serviceText('名前'), 'Updo')
  await user.type(serviceField('時間と料金', 'textbox', '所要時間（分）'), '60')
  await user.type(serviceField('時間と料金', 'textbox', '料金'), '6000')
}

describe('the menu and its new parts, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each<[string, (salonId: string) => string, string, () => Promise<void>]>([
    ['the menu', menuHrefOf, MENU_UNREAD, openedMenu],
    [
      'the form of a new category',
      categoryEntryHrefOf,
      CATEGORIES_UNREAD,
      () => openedCategoryForm('カテゴリーを足す'),
    ],
    [
      'the form of a new service',
      serviceEntryHrefOf,
      MENU_UNREAD,
      () => openedServiceForm('サービスを足す'),
    ],
    [
      'the form that changes several services',
      servicesChangeHrefOf,
      MENU_UNREAD,
      openedServicesForm,
    ],
  ])(
    'should say that what %s needs could not be read, and show it when asked again',
    async (_, hrefOf, unread, opened) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await categoriesUnreadable()
      await openAs(hrefOf(await salonIdOf(TOKYO)), MANAGER)
      expect(await screen.findByText(unread)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await opened()
    },
  )

  it('should say that the menu could not be read when the salon was removed after it was read', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    whenAskedFor(`GET /salons/${tokyo}/service-categories`, () =>
      salonRemovedMeanwhile(TOKYO),
    )

    // Act
    await openAs(menuHrefOf(tokyo), STYLIST)

    // Assert
    expect(await screen.findByText(MENU_UNREAD)).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should say that the menu has no services yet, and lead to dividing it', async () => {
    // Arrange
    await everyServiceRemoved(TOKYO)
    await everyCategoryRemoved(TOKYO)

    // Act
    await openAs(menuHrefOf(await salonIdOf(TOKYO)), MANAGER)

    // Assert
    const services = await screen.findByRole('region', { name: 'サービス' })
    expect(
      within(services).getByText('メニューにサービスはありません'),
    ).toBeInTheDocument()
    expect(
      within(services).getByText(
        'カテゴリーを足して、メニューを分けておけます。',
      ),
    ).toBeInTheDocument()
    expect(rowsOf(screen.getByRole('table', { name: 'カテゴリー' }))).toEqual([
      ['カテゴリーはありません'],
    ])
  })

  it('should show every service under none when the salon has no categories', async () => {
    // Arrange
    await everyCategoryRemoved(TOKYO)

    // Act
    await openAs(menuHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    const services = await screen.findByRole('region', { name: 'サービス' })
    const tables = within(services).getAllByRole('table')
    expect(
      tables.map((table) => table.querySelector('caption')?.textContent),
    ).toEqual(['未分類'])
    expect(rowsOf(tables[0] ?? document.body)).toHaveLength(10)
  })

  it.each<[string, string, string, () => Promise<string>]>([
    ['the service', 'services', SERVICE_UNREAD, () => serviceIdOf('Mens Cut')],
    [
      'the menu of the service',
      'service_categories',
      MENU_UNREAD,
      () => categoryIdOf(TOKYO, 'Styling'),
    ],
  ])(
    'should say on the page of a service that %s could not be read, and show it when asked again',
    async (_, table, unread, idOf) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(table, 'createdAt', await idOf())
      await openAs(
        serviceHrefOf(await salonIdOf(TOKYO), await serviceIdOf('Mens Cut')),
        STYLIST,
      )
      expect(await screen.findByText(unread)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('region', { name: 'サービス' }),
      ).toBeInTheDocument()
    },
  )

  it('should say that a service removed from the menu is not found on its page', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    const balayage = await serviceIdOf('Balayage')
    await serviceRemovedMeanwhile(balayage)

    // Act
    await openAs(serviceHrefOf(tokyo, balayage), STYLIST)

    // Assert
    await heading('サービスが見つかりません')
    expect(screen.getByRole('link', { name: 'メニューへ' })).toHaveAttribute(
      'href',
      menuHrefOf(tokyo),
    )
  })

  it('should say what is wrong before sending a new category, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedCategoriesOf(TOKYO)
    await openAs(categoryEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedCategoryForm('カテゴリーを足す')

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    const name = screen.getByRole('textbox', { name: /名前/ })
    expect(name).toHaveAccessibleDescription(
      /カテゴリーの名前を、100 文字以内で入力してください。/,
    )
    expect(name).toHaveFocus()
    expect(await storedCategoriesOf(TOKYO)).toEqual(before)
  })

  it.each<
    [
      string,
      (salonId: string) => string,
      () => Promise<void>,
      (user: User) => Promise<void>,
    ]
  >([
    [
      'category',
      categoryEntryHrefOf,
      () => openedCategoryForm('カテゴリーを足す'),
      fillNewCategory,
    ],
    [
      'service',
      serviceEntryHrefOf,
      () => openedServiceForm('サービスを足す'),
      fillNewService,
    ],
  ])(
    'should say that the salon is not found when it was removed as a new %s was sent',
    async (_, hrefOf, opened, fill) => {
      // Arrange
      const user = userEvent.setup()
      // A member of the salon is refused a removed salon: an administrator is told it is not found
      await openAs(hrefOf(await salonIdOf(TOKYO)), OPERATOR)
      await opened()
      await fill(user)
      await salonRemovedMeanwhile(TOKYO)

      // Act
      await user.click(screen.getByRole('button', { name: '足す' }))

      // Assert
      await heading('サロンが見つかりません')
    },
  )
})
