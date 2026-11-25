import {
  refuse,
  salonIdOf,
  unreadable,
} from '@beauty-salon-frontend/testing/api'
import { readAgain } from '@beauty-salon-frontend/testing/screens'
import { MANAGER, OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import { categoryChangeHrefOf } from '../../navigation'
import { categoryIdOf, storedCategoriesOf } from '../__tests__/arrangements'
import {
  CATEGORIES_UNREAD,
  NOT_THEIRS,
  openedCategoryForm,
} from '../__tests__/screens'

/*
 * The form of a category and its removal when a request fails, and when
 * the account changes between two requests of the screen. The failures are
 * arranged in the database; what goes well is in
 * `menu.integration.test.tsx`.
 */

const TITLE = 'カテゴリーを直す'

const name = (): HTMLElement => screen.getByRole('textbox', { name: /名前/ })

/** Opens the form of the head spa of the salon in Tokyo, once it was read */
const openHeadSpaAs = async (email: string): Promise<void> => {
  await openAs(
    categoryChangeHrefOf(
      await salonIdOf(TOKYO),
      await categoryIdOf(TOKYO, 'Head Spa'),
    ),
    email,
  )
  await openedCategoryForm(TITLE)
}

/** Opens the dialog of the removal of the head spa */
const removalDialog = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(screen.getByRole('button', { name: '削除' }))

  return screen.findByRole('dialog', {
    name: 'カテゴリー「Head Spa」を削除しますか？',
  })
}

describe('a category of the menu, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each<[string, string]>([
    ['the category', 'Head Spa'],
    ['the other categories', 'Styling'],
  ])(
    'should say that %s could not be read, and show the form when asked again',
    async (_, unread) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'service_categories',
        'createdAt',
        await categoryIdOf(TOKYO, unread),
      )
      await openAs(
        categoryChangeHrefOf(
          await salonIdOf(TOKYO),
          await categoryIdOf(TOKYO, 'Head Spa'),
        ),
        MANAGER,
      )
      expect(await screen.findByText(CATEGORIES_UNREAD)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await openedCategoryForm(TITLE)
      expect(name()).toHaveValue('Head Spa')
    },
  )

  it('should say what is wrong before sending a change, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedCategoriesOf(TOKYO)
    await openHeadSpaAs(MANAGER)
    await user.clear(name())

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(name()).toHaveAccessibleDescription(
      /カテゴリーの名前を、100 文字以内で入力してください。/,
    )
    expect(name()).toHaveFocus()
    expect(await storedCategoriesOf(TOKYO)).toEqual(before)
  })

  it('should say that the account changes no category when it was made a member of the staff meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedCategoriesOf(TOKYO)
    await openHeadSpaAs(MANAGER)
    await user.type(name(), ' Plus')
    await madeStaffMeanwhile(MANAGER)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_THEIRS)
    expect(await storedCategoriesOf(TOKYO)).toEqual(before)
  })

  it('should say in the dialog that the category could not be removed, and close it when asked to go back', async () => {
    // Arrange
    const user = userEvent.setup()
    await openHeadSpaAs(OWNER)
    const dialog = await removalDialog(user)
    await refuse('delete', 'service_categories')
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'カテゴリーを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(
      (await storedCategoriesOf(TOKYO)).map((category) => category.name),
    ).toContain('Head Spa')
  })

  it('should close the dialog and say above the form that the account removes no category when it was made a member of the staff meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openHeadSpaAs(OWNER)
    const dialog = await removalDialog(user)
    await madeStaffMeanwhile(OWNER)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      (await storedCategoriesOf(TOKYO)).map((category) => category.name),
    ).toContain('Head Spa')
  })
})
