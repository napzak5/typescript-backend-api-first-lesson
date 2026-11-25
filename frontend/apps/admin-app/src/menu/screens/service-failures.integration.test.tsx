import { languageStore } from '@beauty-salon-frontend/io'
import {
  refuse,
  salonIdOf,
  unreadable,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  optionsOf,
  readAgain,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import { serviceChangeHrefOf } from '../../navigation'
import {
  categoryIdOf,
  pricedMeanwhile,
  removedMeanwhile,
  serviceIdOf,
  storedServicesNamed,
} from '../__tests__/arrangements'
import {
  MENU_UNREAD,
  NOT_KEEPER,
  NOT_THEIRS,
  openedServiceForm,
  SERVICE_UNREAD,
  serviceField,
  serviceText,
} from '../__tests__/screens'

/*
 * The form of a service and its removal when a request fails, and when the
 * account or the menu changes between two requests of the screen. The
 * failures are arranged in the database; what goes well is in
 * `services.integration.test.tsx`.
 */

const TITLE = 'サービスを直す'

type User = ReturnType<typeof userEvent.setup>

/** The address of the form of a service of the salon in Tokyo, by its name */
const formOf = async (name: string): Promise<string> =>
  serviceChangeHrefOf(await salonIdOf(TOKYO), await serviceIdOf(name))

/** The address of the form of the cut for men: ￥4,000, without a discount, and on bookings not over yet */
const mensCutForm = (): Promise<string> => formOf('Mens Cut')

/** Opens the form of the cut for men, once the menu was read */
const openMensCutAs = async (email: string): Promise<void> => {
  await openAs(await mensCutForm(), email)
  await openedServiceForm(TITLE)
}

/** The cut for men as the database has it */
const storedMensCut = () => storedServicesNamed(TOKYO, 'Mens Cut')

const save = (user: User): Promise<void> =>
  user.click(screen.getByRole('button', { name: '変更を保存する' }))

/**
 * Opens the form of the highlights as the owner, a service that no package
 * and no booking not over yet has, and the dialog of its removal
 */
const highlightsRemoval = async (user: User): Promise<HTMLElement> => {
  await openAs(await formOf('Highlights'), OWNER)
  await openedServiceForm(TITLE)
  await user.click(screen.getByRole('button', { name: '削除' }))

  return screen.findByRole('dialog', {
    name: 'サービス「Highlights」を削除しますか？',
  })
}

/** The highlights as the database has them */
const storedHighlights = () => storedServicesNamed(TOKYO, 'Highlights')

describe('a service of the menu, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each<[string, string, string, () => Promise<string>]>([
    ['the service', 'services', SERVICE_UNREAD, () => serviceIdOf('Mens Cut')],
    [
      'the menu',
      'service_categories',
      MENU_UNREAD,
      () => categoryIdOf(TOKYO, 'Styling'),
    ],
  ])(
    'should say that %s could not be read, and show the form when asked again',
    async (_, table, unread, idOf) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(table, 'createdAt', await idOf())
      await openAs(await mensCutForm(), MANAGER)
      expect(await screen.findByText(unread)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await openedServiceForm(TITLE)
      expect(serviceText('名前')).toHaveValue('Mens Cut')
    },
  )

  it('should refuse a stylist the form of a service', async () => {
    // Act
    await openAs(await mensCutForm(), STYLIST)

    // Assert
    expect(await screen.findByText(NOT_KEEPER)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('should say what is wrong before sending a change, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedMensCut()
    await openMensCutAs(MANAGER)
    await user.clear(serviceText('名前'))

    // Act
    await save(user)

    // Assert
    expect(serviceText('名前')).toHaveAccessibleDescription(
      /サービスの名前を、255 文字以内で入力してください。/,
    )
    expect(serviceText('名前')).toHaveFocus()
    expect(await storedMensCut()).toEqual(before)
  })

  it('should say at the category that it was removed meanwhile, and offer what there is now', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedMensCut()
    await openMensCutAs(MANAGER)
    await user.selectOptions(
      serviceField('サービス', 'combobox', 'カテゴリー'),
      'Perm',
    )
    await removedMeanwhile(await categoryIdOf(TOKYO, 'Perm'))

    // Act
    await save(user)

    // Assert
    const category = serviceField('サービス', 'combobox', 'カテゴリー')
    await waitFor(() =>
      expect(category).toHaveAccessibleDescription(
        /このカテゴリーは、その間に削除されていました。/,
      ),
    )
    await waitFor(() => expect(optionsOf(category)).not.toContain('Perm'))
    expect(await storedMensCut()).toEqual(before)
  })

  it('should say at the discounted price that the prices changed meanwhile when the price was lowered below it', async () => {
    // Arrange
    const user = userEvent.setup()
    await openMensCutAs(MANAGER)
    await user.type(
      serviceField('時間と料金', 'textbox', '割引後の料金'),
      '3800',
    )
    await pricedMeanwhile(await serviceIdOf('Mens Cut'), 3500)

    // Act
    await save(user)

    // Assert
    await waitFor(() =>
      expect(
        serviceField('時間と料金', 'textbox', '割引後の料金'),
      ).toHaveAccessibleDescription(
        /その間に、料金か割引後の料金が変わっていて、割引後の料金が料金を上回ります。サービスの画面で、いまの料金を確かめてください。/,
      ),
    )
    expect(await storedMensCut()).toMatchObject([
      { price: 3500, discountPrice: null },
    ])
  })

  it('should say that the account changes no service when it was made a member of the staff meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedMensCut()
    await openMensCutAs(MANAGER)
    await user.type(serviceText('名前'), ' Plus')
    await madeStaffMeanwhile(MANAGER)

    // Act
    await save(user)

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_THEIRS)
    expect(await storedMensCut()).toEqual(before)
  })

  it('should say in the dialog that the service could not be removed, and keep it open to try again', async () => {
    // Arrange
    const user = userEvent.setup()
    const dialog = await highlightsRemoval(user)
    await refuse('update', 'services')

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'サービスを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(await storedHighlights()).toMatchObject([{ removed: false }])
  })

  it('should close the dialog and say above the form that the account removes no service when it was made a member of the staff meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const dialog = await highlightsRemoval(user)
    await madeStaffMeanwhile(OWNER)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await storedHighlights()).toMatchObject([{ removed: false }])
  })
})

describe('a service of the menu changed meanwhile, on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say in English at the discounted price that the prices changed meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(await mensCutForm(), MANAGER, 'en')
    await heading('Edit the service')
    const discount = await within(
      await screen.findByRole('group', { name: 'Time and price' }),
    ).findByRole('textbox', { name: 'Discounted price' })
    await user.type(discount, '3800')
    await pricedMeanwhile(await serviceIdOf('Mens Cut'), 3500)

    // Act
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // Assert
    await waitFor(() =>
      expect(discount).toHaveAccessibleDescription(
        /The price or the discounted price was changed meanwhile, and the discounted price would be above the price\. Check the prices on the page of the service\./,
      ),
    )
  })
})
