import {
  giveBack,
  takeAway,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, readAgain } from '@beauty-salon-frontend/testing/screens'
import { OWNER, STYLIST } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  madeStaffMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import {
  arrangeVisit,
  paySale,
  refundSale,
  saleRemovedMeanwhile,
  storedRecordOf,
  storedRefundsOf,
} from '../__tests__/arrangements'
import { openAt, part, theSale } from '../__tests__/screens'

/*
 * Changing, voiding and giving back a sale when the sale, the account or
 * the staff changes between two requests of the screen, or cannot be read.
 * The failures are arranged in the database; what goes well is in
 * `sale-changes.integration.test.tsx`.
 */

/** The members of the staff the stylist of the seed data is, and another one */
const STYLIST_NAME = 'Hiroshi Tanaka'
const ANOTHER_STYLIST = 'Mika Suzuki'

const field = (name: string): HTMLElement => screen.getByLabelText(name)

/** The change of a sale of today, nothing paid, opened as somebody, with its form. */
const openTheChange = async (
  number: string,
  email = OWNER,
): Promise<string> => {
  const { saleId } = await arrangeVisit(number)
  await openAt((salon) => `/salons/${salon}/sales/${saleId}/edit`, email)
  await screen.findByRole('combobox', { name: '会計の担当' })

  return saleId
}

/** The page of a sale of today, opened by the owner, with the dialog of its voiding filled in. */
const fillTheVoiding = async (
  user: ReturnType<typeof userEvent.setup>,
  saleId: string,
): Promise<HTMLElement> => {
  await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
  await theSale()
  await user.click(
    within(part('取り消し')).getByRole('button', { name: '売上を取り消す' }),
  )
  const dialog = screen.getByRole('dialog', { name: '売上を取り消しますか？' })
  await user.type(
    within(dialog).getByRole('textbox', { name: '取り消しの理由' }),
    '入れ間違い',
  )

  return dialog
}

/** The refund of the payment of a sale of today, paid in cash, opened by the owner and filled in. */
const fillTheRefund = async (
  user: ReturnType<typeof userEvent.setup>,
  number: string,
): Promise<{ saleId: string; paymentId: string }> => {
  const { saleId } = await arrangeVisit(number)
  const paymentId = await paySale(saleId)
  await openAt(
    (salon) => `/salons/${salon}/sales/${saleId}/payments/${paymentId}/refund`,
  )
  await screen.findByRole('textbox', { name: '返金する金額' })
  await user.type(field('返金の理由'), '施術のやり直し')

  return { saleId, paymentId }
}

describe('changing, voiding and giving back a sale, when something changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('changing a sale', () => {
    it('should say at the cashier that the member chosen was removed meanwhile, and change nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const saleId = await openTheChange('0701')
      await user.selectOptions(field('会計の担当'), ANOTHER_STYLIST)
      await staffRemovedMeanwhile(ANOTHER_STYLIST)

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(
        await screen.findByText(
          'このスタッフは、その間に削除されたため、選べません。選び直してください。',
        ),
      ).toBeVisible()
      expect(field('会計の担当')).toHaveFocus()
      expect((await storedRecordOf(saleId)).staffCode).toBe('STF001')
    })

    it('should say that the sale is not found when it was gone as the change was sent', async () => {
      // Arrange
      const user = userEvent.setup()
      const saleId = await openTheChange('0702')
      await user.type(field('メモ'), 'メモを足す')
      whenAskedFor(`PATCH /sales/${saleId}`, () => saleRemovedMeanwhile(saleId))

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await heading('売上が見つかりません')
    })

    it('should say that the account changes no sale when it belonged to the salon no more as the change was sent', async () => {
      // Arrange
      const user = userEvent.setup()
      const saleId = await openTheChange('0703', STYLIST)
      await user.type(field('メモ'), 'メモを足す')
      whenAskedFor(`PATCH /sales/${saleId}`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(
        await screen.findByText('このアカウントでは、この売上を直せません。'),
      ).toBeVisible()
      expect((await storedRecordOf(saleId)).notes).toBeNull()
    })

    it('should say that the staff could not be read, and open the form when asked again', async () => {
      // Arrange: the sign-in reads a few columns of the staff, the profiles all of them
      const { saleId } = await arrangeVisit('0704')
      await takeAway('staff', 'bio')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/edit`)
      expect(
        await screen.findByText(
          'スタッフを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('staff', 'bio')

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('combobox', { name: '会計の担当' }),
      ).toHaveDisplayValue(STYLIST_NAME)
    })
  })

  describe('voiding a sale', () => {
    it('should say that the sale is not found when it was gone as the voiding was sent', async () => {
      // Arrange
      const user = userEvent.setup()
      const { saleId } = await arrangeVisit('0711')
      const dialog = await fillTheVoiding(user, saleId)
      whenAskedFor(`POST /sales/${saleId}/void`, () =>
        saleRemovedMeanwhile(saleId),
      )

      // Act
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      await heading('売上が見つかりません')
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('should say in the dialog that the account voids no sale when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const { saleId } = await arrangeVisit('0712')
      const dialog = await fillTheVoiding(user, saleId)
      whenAskedFor(`POST /sales/${saleId}/void`, () =>
        madeStaffMeanwhile(OWNER),
      )

      // Act
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'このアカウントでは、売上を取り消せません。売上の取り消しと返金は、オーナーとマネージャーができます。',
      )
      expect((await storedRecordOf(saleId)).isVoid).toBe(false)
    })

    it('should say that the sale is not found when it was paid meanwhile and gone before it was read again', async () => {
      // Arrange: the voiding is refused, and the sale is gone before it is read again
      const user = userEvent.setup()
      const { saleId } = await arrangeVisit('0713')
      const dialog = await fillTheVoiding(user, saleId)
      await paySale(saleId)
      whenAskedFor(`GET /sales/${saleId}`, () => saleRemovedMeanwhile(saleId))

      // Act
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      await heading('売上が見つかりません')
    })
  })

  describe('giving a payment back', () => {
    it('should say that the sale is not found when it was gone as the refund was sent', async () => {
      // Arrange
      const user = userEvent.setup()
      const { saleId, paymentId } = await fillTheRefund(user, '0721')
      whenAskedFor(`POST /payments/${paymentId}/refund`, () =>
        saleRemovedMeanwhile(saleId),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert
      await heading('売上が見つかりません')
    })

    it('should say that the account records no refund when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const { saleId, paymentId } = await fillTheRefund(user, '0722')
      whenAskedFor(`POST /payments/${paymentId}/refund`, () =>
        madeStaffMeanwhile(OWNER),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert
      expect(
        await screen.findByText(
          'このアカウントでは、返金を記録できません。返金は、オーナーとマネージャーができます。',
        ),
      ).toBeVisible()
      expect((await storedRefundsOf(saleId))[0]?.status).toBe('completed')
    })

    it('should say that the sale is not found when the payment was given back meanwhile and the sale gone before it was read again', async () => {
      // Arrange
      const user = userEvent.setup()
      const { saleId } = await fillTheRefund(user, '0723')
      await refundSale(saleId)
      whenAskedFor(`GET /sales/${saleId}`, () => saleRemovedMeanwhile(saleId))

      // Act
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert
      await heading('売上が見つかりません')
    })
  })
})
