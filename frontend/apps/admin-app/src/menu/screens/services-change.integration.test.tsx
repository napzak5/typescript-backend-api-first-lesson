import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { heading, optionsOf } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import { menuHrefOf, servicesChangeHrefOf } from '../../navigation'
import {
  categoryIdOf,
  removedMeanwhile,
  serviceIdOf,
  serviceRemovedMeanwhile,
  storedStatesOf,
} from '../__tests__/arrangements'

/*
 * Several services of the menu changed at once against the API. The salon
 * in Tokyo has ten services of the seed data in the first four of its
 * categories, every one of them switched on and given, and all but
 * Balayage and Straight Perm booked online; its categories Head Spa to
 * Other Services have no service. The manager and
 * the owner keep its menu. Somebody did something meanwhile where a test
 * says so.
 */

/** Waits for the form: its heading comes first, the form once the menu was read. */
const openedForm = async (): Promise<void> => {
  await heading('サービスをまとめて変える')
  await screen.findByRole('group', { name: '変えるサービス' })
}

const service = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

const choice = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

describe('several services of the menu changed at once, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should let the manager stop the online booking of two services from the menu, and leave the others', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedStatesOf(TOKYO)
    await openAs(menuHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await user.click(
      await screen.findByRole('link', { name: 'まとめて変える' }),
    )
    await openedForm()

    // Act
    await user.click(service('Ladies Cut（Hair Cut）'))
    await user.click(service('Mens Cut（Hair Cut）'))
    await user.selectOptions(choice('オンライン予約'), '受けない')
    await user.click(screen.getByRole('button', { name: '変える' }))

    // Assert
    expect(
      await screen.findByText('2 件のサービスを変えました。'),
    ).toBeInTheDocument()
    await heading('メニュー')
    expect(await storedStatesOf(TOKYO)).toEqual(
      before.map((state) =>
        ['Ladies Cut', 'Mens Cut'].includes(state.name)
          ? { ...state, allowOnlineBooking: false }
          : state,
      ),
    )
    expect(
      within(
        await screen.findByRole('table', { name: 'Hair Cut' }),
      ).getAllByText('受けない'),
    ).toHaveLength(2)
  })

  it('should let the owner move services to another category and give them a state', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedStatesOf(TOKYO)
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedForm()

    // Act
    await user.click(service('Highlights（Hair Color）'))
    await user.click(service('Balayage（Hair Color）'))
    await user.selectOptions(choice('カテゴリー'), 'Styling')
    await user.selectOptions(choice('提供の状態'), '近日公開')
    await user.click(screen.getByRole('button', { name: '変える' }))

    // Assert
    await heading('メニュー')
    expect(await storedStatesOf(TOKYO)).toEqual(
      before.map((state) =>
        ['Balayage', 'Highlights'].includes(state.name)
          ? { ...state, category: 'Styling', serviceStatus: 'coming_soon' }
          : state,
      ),
    )
    expect(
      within(
        await screen.findByRole('table', { name: 'Styling' }),
      ).getAllByText('有効・近日公開'),
    ).toHaveLength(2)
  })

  it('should say what is wrong before sending, and ask the API for nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedStatesOf(TOKYO)
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm()

    // Act
    await user.click(screen.getByRole('button', { name: '変える' }))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '変える項目を、1 つ以上選んでください。',
    )
    expect(
      screen.getByRole('group', { name: '変えるサービス' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('変えるサービスを、1 件以上選んでください。'),
    )
    await user.click(service('Ladies Cut（Hair Cut）'))
    await user.click(screen.getByRole('button', { name: '変える' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      '変える項目を、1 つ以上選んでください。',
    )
    expect(
      screen.getByRole('group', { name: '変えるサービス' }),
    ).not.toHaveAccessibleDescription(
      expect.stringContaining('変えるサービスを、1 件以上選んでください。'),
    )
    expect(await storedStatesOf(TOKYO)).toEqual(before)
  })

  it('should change none of the services when one was removed meanwhile, and offer what there is now', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm()
    await user.click(service('Ladies Cut（Hair Cut）'))
    await user.click(service('Mens Cut（Hair Cut）'))
    await user.selectOptions(choice('有効'), '無効にする')
    await serviceRemovedMeanwhile(await serviceIdOf('Mens Cut'))

    // Act
    await user.click(screen.getByRole('button', { name: '変える' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '選んだサービスのどれかが、その間にメニューから削除されていました。どのサービスも変えていません。',
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('checkbox', { name: 'Mens Cut（Hair Cut）' }),
      ).not.toBeInTheDocument(),
    )
    expect(service('Ladies Cut（Hair Cut）')).toBeChecked()
    expect(
      (await storedStatesOf(TOKYO)).find(({ name }) => name === 'Ladies Cut')
        ?.isActive,
    ).toBe(true)
  })

  it('should say at the category that it was removed meanwhile, and offer what there is now', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm()
    await user.click(service('Ladies Cut（Hair Cut）'))
    await user.selectOptions(choice('カテゴリー'), 'Styling')
    await removedMeanwhile(await categoryIdOf(TOKYO, 'Styling'))

    // Act
    await user.click(screen.getByRole('button', { name: '変える' }))

    // Assert
    await waitFor(() =>
      expect(choice('カテゴリー')).toHaveAccessibleDescription(
        /このカテゴリーは、その間に削除されていました。/,
      ),
    )
    await waitFor(() =>
      expect(optionsOf(choice('カテゴリー'))).not.toContain('Styling'),
    )
    expect(
      (await storedStatesOf(TOKYO)).find(({ name }) => name === 'Ladies Cut')
        ?.category,
    ).toBe('Hair Cut')
  })

  it('should refuse a stylist the form', async () => {
    // Act
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このアカウントでは、メニューを変えられません。メニューを変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('should tell the manager of another salon that its menu is not theirs to change', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedStatesOf(OSAKA)
    await openAs(servicesChangeHrefOf(await salonIdOf(OSAKA)), MANAGER)
    await openedForm()
    await user.click(service('Signature Cut（Hair Cut）'))
    await user.selectOptions(choice('有効'), '無効にする')

    // Act
    await user.click(screen.getByRole('button', { name: '変える' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    )
    expect(await storedStatesOf(OSAKA)).toEqual(before)
  })

  it('should have no accessibility violations on the form', async () => {
    // Arrange
    const { container } = renderAt(servicesChangeHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Act
    await openedForm()

    // Assert
    expect(await findAccessibilityViolations(container)).toEqual([])
  })
})

describe('several services of the menu changed at once on a page in English', () => {
  /** Waits for the form in English: its heading, then the form. */
  const openedFormInEnglish = async (): Promise<void> => {
    await heading('Change several services at once')
    await screen.findByRole('group', { name: 'Services to change' })
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

  it('should let the manager stop the online booking of two services in English, and count them', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(menuHrefOf(await salonIdOf(TOKYO)), MANAGER, 'en')
    await user.click(
      await screen.findByRole('link', { name: 'Change several at once' }),
    )
    await openedFormInEnglish()

    // Act
    await user.click(service('Ladies Cut (Hair Cut)'))
    await user.click(service('Mens Cut (Hair Cut)'))
    await user.selectOptions(choice('Online booking'), 'Not accepted')
    await user.click(screen.getByRole('button', { name: 'Change' }))

    // Assert
    expect(await screen.findByText('Changed 2 services.')).toBeInTheDocument()
    await heading('Menu')
    expect(
      within(
        await screen.findByRole('table', { name: 'Hair Cut' }),
      ).getAllByText('Not accepted'),
    ).toHaveLength(2)
  })

  it('should say in English what is wrong before sending', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), MANAGER, 'en')
    await openedFormInEnglish()

    // Act
    await user.click(screen.getByRole('button', { name: 'Change' }))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose at least one value to change. Left at “Keep”, nothing changes.',
    )
    expect(
      screen.getByRole('group', { name: 'Services to change' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Choose at least one service to change.'),
    )
  })

  it('should say in English that none of the services changed when one was removed meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), MANAGER, 'en')
    await openedFormInEnglish()
    await user.click(service('Ladies Cut (Hair Cut)'))
    await user.click(service('Mens Cut (Hair Cut)'))
    await user.selectOptions(choice('Active'), 'Make inactive')
    await serviceRemovedMeanwhile(await serviceIdOf('Mens Cut'))

    // Act
    await user.click(screen.getByRole('button', { name: 'Change' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'One of the chosen services was removed from the menu meanwhile. No service was changed. Choose again from the menu as it is now.',
    )
  })

  it('should refuse a stylist the form in English', async () => {
    // Act
    await openAs(servicesChangeHrefOf(await salonIdOf(TOKYO)), STYLIST, 'en')

    // Assert
    expect(
      await screen.findByText(
        'This account cannot change the menu. Only the owners and managers of the salon, and administrators, can change the menu.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
