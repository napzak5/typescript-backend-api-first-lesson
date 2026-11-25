import {
  refuse,
  salonIdOf,
  testApi,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, readAgain } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { salonRemovedMeanwhile } from '../../bookings/__tests__/arrangements'
import {
  madeStaffMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import {
  paymentMethodChangeHrefOf,
  paymentMethodEntryHrefOf,
  paymentMethodHrefOf,
  paymentMethodsHrefOf,
} from '../../navigation'
import { methodIdOf, storedMethodsOf } from '../__tests__/arrangements'

/*
 * The payment methods of a salon when they cannot be read, are refused,
 * or change between two requests of a screen. The failures are arranged
 * in the database; what goes well is in
 * `payment-methods.integration.test.tsx`.
 */

/** The members of the staff the stylist and the manager of the seed data are */
const STYLIST_NAME = 'Hiroshi Tanaka'
const MANAGER_NAME = 'Kenji Sato'

const NOT_THEIRS =
  'このサロンの支払い方法は、見られません。支払い方法を見られるのは、そのサロンのスタッフと、管理者です。'

const NOT_TO_CHANGE =
  'このサロンの支払い方法は、変えられません。支払い方法を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'

const UNREAD_METHODS =
  '支払い方法を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** Waits for a form: its heading comes first, the form once what it needs was read. */
const openedForm = async (title: string): Promise<void> => {
  await heading(title)
  await screen.findByRole('textbox', { name: /表示名/ })
}

/** The line of a request for a method of the salon in Tokyo, as `whenAskedFor` names it */
const lineOf = async (method: string, displayName?: string) => {
  const methods = `/salons/${await salonIdOf(TOKYO)}/payment-methods`

  return displayName === undefined
    ? `${method} ${methods}`
    : `${method} ${methods}/${await methodIdOf(TOKYO, displayName)}`
}

/** Opens the change of a method of the salon in Tokyo, and waits for its form. */
const openTheChange = async (displayName: string, email = OWNER) => {
  await openAs(
    paymentMethodChangeHrefOf(
      await salonIdOf(TOKYO),
      await methodIdOf(TOKYO, displayName),
    ),
    email,
  )
  await openedForm('支払い方法を直す')
}

/** Opens the entry of a method of the salon in Tokyo, fills in a cash payment, and waits. */
const fillTheEntry = async (
  user: ReturnType<typeof userEvent.setup>,
  email: string,
) => {
  await openAs(paymentMethodEntryHrefOf(await salonIdOf(TOKYO)), email)
  await openedForm('支払い方法を足す')
  await user.selectOptions(
    screen.getByRole('combobox', { name: /種類/ }),
    '現金',
  )
  await user.type(text(/表示名/), '小銭')
}

describe('the payment methods of a salon, when a request fails or something changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('reading them', () => {
    it('should say that the list could not be read, and show it when asked again', async () => {
      // Arrange
      const readable = await unreadable(
        'payment_methods',
        'createdAt',
        await methodIdOf(TOKYO, 'Cash'),
      )
      const user = userEvent.setup()
      await openAs(paymentMethodsHrefOf(await salonIdOf(TOKYO)), STYLIST)
      expect(await screen.findByText(UNREAD_METHODS)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('table', { name: '支払い方法' }),
      ).toBeVisible()
    })

    it('should say that a method could not be read, and show it when asked again', async () => {
      // Arrange
      const id = await methodIdOf(TOKYO, 'Cash')
      const readable = await unreadable('payment_methods', 'createdAt', id)
      const user = userEvent.setup()
      await openAs(paymentMethodHrefOf(await salonIdOf(TOKYO), id), STYLIST)
      expect(
        await screen.findByText(
          '支払い方法を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('region', { name: '支払い方法' }),
      ).toBeVisible()
    })

    it('should tell an account that belongs to the salon no more that a method is not for it', async () => {
      // Arrange
      whenAskedFor(await lineOf('GET', 'Cash'), () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await openAs(
        paymentMethodHrefOf(
          await salonIdOf(TOKYO),
          await methodIdOf(TOKYO, 'Cash'),
        ),
        STYLIST,
      )

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('region', { name: '支払い方法' })).toBeNull()
    })
  })

  describe('adding one', () => {
    it('should say that the methods the order follows could not be read, and open the form when asked again', async () => {
      // Arrange
      const readable = await unreadable(
        'payment_methods',
        'createdAt',
        await methodIdOf(TOKYO, 'Cash'),
      )
      const user = userEvent.setup()
      await openAs(paymentMethodEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
      expect(await screen.findByText(UNREAD_METHODS)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await openedForm('支払い方法を足す')
      expect(text(/並び順/)).toHaveValue('8')
    })

    it('should tell a manager who belongs to the salon no more that its methods are not theirs to see', async () => {
      // Arrange
      whenAskedFor(await lineOf('GET'), () =>
        staffRemovedMeanwhile(MANAGER_NAME),
      )

      // Act
      await openAs(paymentMethodEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('should say that the salon is not found when it was removed as the method was sent', async () => {
      // Arrange
      const user = userEvent.setup()
      await fillTheEntry(user, OPERATOR)
      whenAskedFor(await lineOf('POST'), () => salonRemovedMeanwhile(TOKYO))

      // Act
      await user.click(screen.getByRole('button', { name: '足す' }))

      // Assert
      await heading('サロンが見つかりません')
    })

    it('should say that the account adds no method when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedMethodsOf(TOKYO)
      await fillTheEntry(user, MANAGER)
      whenAskedFor(await lineOf('POST'), () => madeStaffMeanwhile(MANAGER))

      // Act
      await user.click(screen.getByRole('button', { name: '足す' }))

      // Assert
      expect(await screen.findByText(NOT_TO_CHANGE)).toBeVisible()
      expect(text(/表示名/)).toHaveValue('小銭')
      expect(await storedMethodsOf(TOKYO)).toEqual(before)
    })
  })

  describe('changing one', () => {
    it('should say that the method could not be read, and open the form when asked again', async () => {
      // Arrange
      const id = await methodIdOf(TOKYO, 'Cash')
      const readable = await unreadable('payment_methods', 'createdAt', id)
      const user = userEvent.setup()
      await openAs(paymentMethodChangeHrefOf(await salonIdOf(TOKYO), id), OWNER)
      expect(
        await screen.findByText(
          '支払い方法を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await openedForm('支払い方法を直す')
      expect(text(/表示名/)).toHaveValue('Cash')
    })

    it('should tell a manager who belongs to the salon no more that the method is not theirs to see', async () => {
      // Arrange
      whenAskedFor(await lineOf('GET', 'Cash'), () =>
        staffRemovedMeanwhile(MANAGER_NAME),
      )

      // Act
      await openAs(
        paymentMethodChangeHrefOf(
          await salonIdOf(TOKYO),
          await methodIdOf(TOKYO, 'Cash'),
        ),
        MANAGER,
      )

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('should say what is wrong with a change before sending it, and send nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedMethodsOf(TOKYO)
      await openTheChange('Cash')
      await user.clear(text(/表示名/))

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(text(/表示名/)).toHaveAccessibleDescription(
        expect.stringContaining('表示名を、100 文字以内で入力してください。'),
      )
      expect(await storedMethodsOf(TOKYO)).toEqual(before)
    })

    it('should say at the smallest amount that it is above the largest one, which was lowered meanwhile', async () => {
      // Arrange: the form opened without a largest amount
      const user = userEvent.setup()
      const id = await methodIdOf(TOKYO, 'Credit Card')
      await openTheChange('Credit Card')
      await testApi().query(
        'update payment_methods set "maximumAmount" = 1500 where id = $1',
        [id],
      )
      await user.clear(text('1 回の金額の下限（円）'))
      await user.type(text('1 回の金額の下限（円）'), '2000')

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(
        await screen.findByText(
          '下限は、上限と同じか、上限より小さい金額にしてください。',
        ),
      ).toBeVisible()
      expect(text('1 回の金額の下限（円）')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(
        (await storedMethodsOf(TOKYO)).find(
          ({ displayName }) => displayName === 'Credit Card',
        ),
      ).toMatchObject({ minimumAmount: 1000, maximumAmount: 1500 })
    })

    it('should say that the method is not found when it was removed as the change was sent', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await methodIdOf(TOKYO, 'Cash')
      await openTheChange('Cash')
      await user.type(text('説明'), '釣り銭あり')
      whenAskedFor(await lineOf('PATCH', 'Cash'), () =>
        testApi().query('delete from payment_methods where id = $1', [id]),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await heading('支払い方法が見つかりません')
      expect(screen.getByRole('link', { name: '支払い方法へ' })).toBeVisible()
    })

    it('should say that the account changes no method when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedMethodsOf(TOKYO)
      await openTheChange('Cash', MANAGER)
      await user.type(text('説明'), '釣り銭あり')
      whenAskedFor(await lineOf('PATCH', 'Cash'), () =>
        madeStaffMeanwhile(MANAGER),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(await screen.findByText(NOT_TO_CHANGE)).toBeVisible()
      expect(await storedMethodsOf(TOKYO)).toEqual(before)
    })
  })

  describe('removing one', () => {
    it('should say in the dialog that a method was not removed when the database refused it, and keep it', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedMethodsOf(TOKYO)
      await openTheChange('Bank Transfer')
      await refuse('delete', 'payment_methods')
      await user.click(screen.getByRole('button', { name: '削除' }))
      const dialog = screen.getByRole('dialog', {
        name: '支払い方法「Bank Transfer」を削除しますか？',
      })

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '支払い方法を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await storedMethodsOf(TOKYO)).toEqual(before)

      // Act
      await user.click(within(dialog).getByRole('button', { name: '戻る' }))

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should say that the account removes no method when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedMethodsOf(TOKYO)
      await openTheChange('Bank Transfer')
      await user.click(screen.getByRole('button', { name: '削除' }))
      whenAskedFor(await lineOf('DELETE', 'Bank Transfer'), () =>
        madeStaffMeanwhile(OWNER),
      )

      // Act
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: '削除する',
        }),
      )

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_TO_CHANGE)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await storedMethodsOf(TOKYO)).toEqual(before)
    })
  })
})
