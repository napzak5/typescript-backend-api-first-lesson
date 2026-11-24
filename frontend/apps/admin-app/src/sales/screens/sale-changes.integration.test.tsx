import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  refuse,
  salonIdOf,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  firstSight,
  heading,
  notifications,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import { OWNER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import {
  arrangeVisit,
  paySale,
  refundSale,
  storedRecordOf,
  storedRefundsOf,
  voidSale,
} from '../__tests__/arrangements'
import { describedIn, openAt, part, theSale } from '../__tests__/screens'

/** What a member of the staff is told where a sale would be voided or given back */
const UNDONE_BY_OTHERS =
  '売上の取り消しと返金は、オーナーとマネージャーができます。'

const field = (name: string): HTMLElement => screen.getByLabelText(name)

/** The number the arrangements give the cash payment of a sale */
const cashOf = (saleId: string): string => `PT-TEST-${saleId.slice(0, 8)}`

const TO_VOID = '売上を取り消しますか？'

describe('changing, voiding and giving back a sale, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('changing a sale', () => {
    it('should let a member of the staff change who took a sale, when, and its note, and show the sale so at once', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0201')
      const yesterday = await dayFromToday(-1)
      const user = userEvent.setup()
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/sales/${saleId}`,
        STYLIST,
      )
      await theSale()
      await user.click(screen.getByRole('link', { name: '売上を直す' }))
      await heading('売上を直す')
      await screen.findByRole('combobox', { name: '会計の担当' })
      expect(
        screen.getByText(
          '明細と金額は、ここでは直せません。誤りがあるときは、オーナーかマネージャーが、支払いを全額返金して売上を取り消し、予約から会計を入れ直します。',
        ),
      ).toBeVisible()
      expect(field('会計の時刻')).toHaveValue('09:30')

      // Act
      await user.selectOptions(field('会計の担当'), 'Mika Suzuki')
      await user.clear(field('会計日'))
      await user.type(field('会計日'), yesterday)
      await user.clear(field('会計の時刻'))
      await user.type(field('会計の時刻'), '18:45')
      await user.type(field('メモ'), '前日の閉店後に入れ忘れた会計')
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert: the sale the API answered is shown at first sight
      await heading('売上の内容')
      expect(address()).toBe(`/salons/${tokyo}/sales/${saleId}`)
      expect(firstSight()[1]).toContain('Mika Suzuki')
      expect(notifications()).toContain('売上を直しました。')
      expect(describedIn('売上')).toMatchObject({
        会計日: dayNameOf(yesterday).ja,
        会計の担当: 'Mika Suzuki',
        メモ: '前日の閉店後に入れ忘れた会計',
      })
      expect(await storedRecordOf(saleId)).toMatchObject({
        staffCode: 'STF002',
        saleTime: `${yesterday} 18:45`,
        saleDate: yesterday,
        notes: '前日の閉店後に入れ忘れた会計',
      })
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('link', { name: 'この日の売上へ' }))

      // Assert: the sale is in the ledger of the day it was moved to
      await heading('売上台帳')
      expect(
        await screen.findByRole('link', { name: 'SL-TEST-0201' }),
      ).toBeVisible()
    })

    it('should drop the ledger that was read, when the day of a sale was changed', async () => {
      // Arrange
      await arrangeVisit('0207')
      const yesterday = await dayFromToday(-1)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales`)
      await heading('売上台帳')
      await user.click(
        await screen.findByRole('link', { name: 'SL-TEST-0207' }),
      )
      await theSale()
      await user.click(screen.getByRole('link', { name: '売上を直す' }))
      await screen.findByRole('combobox', { name: '会計の担当' })
      await user.clear(field('会計日'))
      await user.type(field('会計日'), yesterday)
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))
      await theSale()

      // Act
      await user.click(
        within(
          screen.getByRole('navigation', { name: 'メインメニュー' }),
        ).getByRole('link', { name: '売上' }),
      )

      // Assert: the ledger of today is read anew, without the sale
      await heading('売上台帳')
      expect(firstSight()[1]).not.toContain('SL-TEST-0207')
      expect(await screen.findByText(/の売上はありません$/)).toBeVisible()
    })

    it('should ask the API for nothing when nothing was changed', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0202')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/edit`)
      await screen.findByRole('combobox', { name: '会計の担当' })
      const before = await storedRecordOf(saleId)

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await theSale()
      expect(notifications()).toContain('変更された項目はありません。')
      expect(await storedRecordOf(saleId)).toEqual(before)
    })

    it('should say at its control that a sale is not entered at a time to come, and send nothing', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0203')
      const tomorrow = await dayFromToday(1)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/edit`)
      await screen.findByRole('combobox', { name: '会計の担当' })
      const before = await storedRecordOf(saleId)

      // Act
      await user.clear(field('会計日'))
      await user.type(field('会計日'), tomorrow)
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await waitFor(() =>
        expect(field('会計の時刻')).toHaveAccessibleDescription(
          expect.stringContaining('会計日時は、いまより前にしてください。'),
        ),
      )
      expect(field('会計の時刻')).toHaveFocus()
      expect(await storedRecordOf(saleId)).toEqual(before)
    })

    it('should show a sale that was voided meanwhile as it is now, and say why it is not changed', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0204')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/edit`)
      await screen.findByRole('combobox', { name: '会計の担当' })
      await voidSale(saleId)

      // Act
      await user.type(field('メモ'), 'メモを足す')
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(
        await screen.findByText(
          '取り消した売上は、直せません。取り消しの記録として残ります。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('combobox', { name: '会計の担当' })).toBeNull()
      expect(screen.getByRole('link', { name: '売上の内容へ' })).toBeVisible()
      expect((await storedRecordOf(saleId)).notes).toBeNull()
    })

    it('should offer no change of a voided sale, and say why at the address of the change', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0205')
      await voidSale(saleId)
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()

      // Assert
      expect(screen.queryByRole('link', { name: '売上を直す' })).toBeNull()
      expect(screen.queryByRole('heading', { name: '取り消し' })).toBeNull()

      // Act
      await user.click(screen.getByRole('link', { name: 'この日の売上へ' }))
      await heading('売上台帳')
      renderAt(`/salons/${tokyo}/sales/${saleId}/edit`)

      // Assert
      expect(
        await screen.findByText(
          '取り消した売上は、直せません。取り消しの記録として残ります。',
        ),
      ).toBeVisible()
    })

    it('should say that a change was not saved when the database refused it', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0206')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/edit`)
      await screen.findByRole('combobox', { name: '会計の担当' })
      await refuse('update', 'sales')

      // Act
      await user.type(field('メモ'), 'メモを足す')
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(
        await screen.findByText(
          '売上を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(field('メモ')).toHaveValue('メモを足す')
    })
  })

  describe('voiding a sale', () => {
    it('should void a sale entered by mistake, asking why, and let its booking be billed again', async () => {
      // Arrange
      const { bookingId, saleId } = await arrangeVisit('0211')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/bookings/${bookingId}`)
      await user.click(
        await within(
          await screen.findByRole('region', { name: '会計' }),
        ).findByRole('link', { name: 'SL-TEST-0211' }),
      )
      await theSale()
      await user.click(
        within(part('取り消し')).getByRole('button', {
          name: '売上を取り消す',
        }),
      )
      const dialog = screen.getByRole('dialog', { name: TO_VOID })

      // Act: without a reason
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      const reason = within(dialog).getByRole('textbox', {
        name: '取り消しの理由',
      })
      await waitFor(() =>
        expect(reason).toHaveAccessibleDescription(
          expect.stringContaining('取り消しの理由を入力してください。'),
        ),
      )
      expect(reason).toHaveFocus()

      // Act
      await user.type(reason, '別のお客様の会計と取り違えた')
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert: the sale is shown voided, with the focus on its heading
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: '売上' })).toHaveFocus(),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(notifications()).toContain(
        '売上を取り消しました。予約の会計を、入れ直せます。',
      )
      expect(describedIn('売上')).toMatchObject({
        支払い: '取り消し',
        取り消しの理由: '別のお客様の会計と取り違えた',
      })
      expect(screen.queryByRole('heading', { name: '取り消し' })).toBeNull()
      expect(screen.queryByRole('link', { name: '売上を直す' })).toBeNull()
      expect(await storedRecordOf(saleId)).toMatchObject({
        isVoid: true,
        voidReason: '別のお客様の会計と取り違えた',
        voided: true,
      })
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('link', { name: '予約の内容' }))

      // Assert: the part of the booking that was read before is read anew
      expect(firstSight()[1]).toContain('BK-TEST-0211')
      expect(firstSight()[1]).not.toContain('SL-TEST-0211')
      const billing = await screen.findByRole('region', { name: '会計' })
      expect(
        await within(billing).findByRole('link', { name: '会計を入れる' }),
      ).toBeVisible()
    })

    it('should say why a paid sale is not voided, and void it once its payment was given back whole', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0212')
      await paySale(saleId)
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      expect(
        within(part('取り消し')).getByText(
          '受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。',
        ),
      ).toBeVisible()

      // Act
      await user.click(
        screen.getByRole('link', { name: `${cashOf(saleId)} を返金する` }),
      )
      await heading('返金する')
      await screen.findByRole('textbox', { name: '返金する金額' })
      expect(describedIn('返金する支払い')).toMatchObject({
        取引番号: cashOf(saleId),
        支払い方法: 'Cash',
        金額: '￥5,500',
      })
      expect(field('返金する金額')).toHaveValue('5500')
      await user.type(field('返金の理由'), '施術のやり直しで、払い直す')
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert: the sale is read anew
      await theSale()
      expect(address()).toBe(`/salons/${tokyo}/sales/${saleId}`)
      expect(firstSight()[1]).not.toContain('受け取った支払いがあるため')
      expect(notifications()).toContain(
        '返金を記録しました。すべての支払いを全額返金したので、売上を取り消せます。',
      )
      const [given] = rowsOf('支払い')
      expect(given?.slice(-2)).toEqual([
        '返金済み',
        expect.stringMatching(/^￥5,500、\d{4}年.+ \d{2}:\d{2}$/),
      ])
      expect(describedIn('支払い')).toEqual({
        [`${cashOf(saleId)} の返金の理由`]: '施術のやり直しで、払い直す',
      })
      expect(await storedRefundsOf(saleId)).toEqual([
        {
          amount: 5500,
          status: 'refunded',
          refundAmount: 5500,
          refundReason: '施術のやり直しで、払い直す',
          refunded: true,
        },
      ])

      // Act
      await user.click(
        await within(part('取り消し')).findByRole('button', {
          name: '売上を取り消す',
        }),
      )
      const dialog = screen.getByRole('dialog', { name: TO_VOID })
      await user.type(
        within(dialog).getByRole('textbox', { name: '取り消しの理由' }),
        '全額返金して、払い直す',
      )
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      await waitFor(() =>
        expect(describedIn('売上')).toMatchObject({ 支払い: '取り消し' }),
      )
      expect(await storedRecordOf(saleId)).toMatchObject({
        paymentStatus: 'refunded',
        isVoid: true,
      })
    })

    it('should show a sale that was paid meanwhile, and say why it was not voided', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0213')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      await user.click(
        within(part('取り消し')).getByRole('button', {
          name: '売上を取り消す',
        }),
      )
      await paySale(saleId)
      const dialog = screen.getByRole('dialog', { name: TO_VOID })

      // Act
      await user.type(
        within(dialog).getByRole('textbox', { name: '取り消しの理由' }),
        '入れ間違い',
      )
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: '取り消し' })).toHaveFocus(),
      )
      const why =
        '受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。'
      expect(notifications()).toContain(
        `その間に、この売上の支払いが変わりました。${why}`,
      )
      expect(within(part('取り消し')).getByText(why)).toBeVisible()
      expect(rowsOf('支払い')).toHaveLength(1)
      expect((await storedRecordOf(saleId)).isVoid).toBe(false)
    })

    it('should say in the dialog that a sale was not voided when the database refused it', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0214')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      await refuse('update', 'sales')
      await user.click(
        within(part('取り消し')).getByRole('button', {
          name: '売上を取り消す',
        }),
      )
      const dialog = screen.getByRole('dialog', { name: TO_VOID })

      // Act
      await user.type(
        within(dialog).getByRole('textbox', { name: '取り消しの理由' }),
        '入れ間違い',
      )
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '売上を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect((await storedRecordOf(saleId)).isVoid).toBe(false)
    })

    it('should offer a member of the staff neither the voiding nor the refund, and say who may', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0215')
      const paymentId = await paySale(saleId)
      const user = userEvent.setup()
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/sales/${saleId}`,
        STYLIST,
      )
      await theSale()

      // Assert
      expect(within(part('取り消し')).getByText(UNDONE_BY_OTHERS)).toBeVisible()
      expect(
        screen.queryByRole('button', { name: '売上を取り消す' }),
      ).toBeNull()
      expect(rowsOf('支払い')[0]?.at(-1)).toBe('なし')
      expect(screen.queryByRole('link', { name: /を返金する$/ })).toBeNull()

      // Act
      await user.click(screen.getByRole('link', { name: 'この日の売上へ' }))
      await heading('売上台帳')
      renderAt(`/salons/${tokyo}/sales/${saleId}/payments/${paymentId}/refund`)

      // Assert
      expect(await screen.findByText(UNDONE_BY_OTHERS)).toBeVisible()
    })
  })

  describe('giving a payment back', () => {
    it('should give a part of a payment back, and say that the sale is not voided after it', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0221')
      await paySale(saleId)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      await user.click(
        screen.getByRole('link', { name: `${cashOf(saleId)} を返金する` }),
      )
      await screen.findByRole('textbox', { name: '返金する金額' })

      // Act
      await user.clear(field('返金する金額'))
      await user.type(field('返金する金額'), '１,０００')
      await user.type(field('返金の理由'), 'お釣りの渡し忘れ')
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert
      await theSale()
      expect(notifications()).toContain('返金を記録しました。')
      const [given] = rowsOf('支払い')
      expect(given?.slice(-2)).toEqual([
        '一部返金',
        expect.stringMatching(/^￥1,000、\d{4}年.+ \d{2}:\d{2}$/),
      ])
      expect(describedIn('支払い')).toEqual({
        [`${cashOf(saleId)} の返金の理由`]: 'お釣りの渡し忘れ',
      })
      expect(
        within(part('取り消し')).getByText(
          '一部を返金した支払いがあるため、この売上は取り消せません。1 件の支払いの返金は 1 回で、残りは返金できません。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('link', { name: /を返金する$/ })).toBeNull()
      expect(describedIn('金額')).toMatchObject({ 返金した金額: '￥1,000' })
      expect(await storedRefundsOf(saleId)).toEqual([
        {
          amount: 5500,
          status: 'partial_refund',
          refundAmount: 1000,
          refundReason: 'お釣りの渡し忘れ',
          refunded: true,
        },
      ])
      expect(await findAccessibilityViolations(document.body)).toEqual([])
    })

    it('should say at its control that more than the payment is not given back, and send nothing', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0222')
      await paySale(saleId)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      await user.click(
        screen.getByRole('link', { name: `${cashOf(saleId)} を返金する` }),
      )
      await screen.findByRole('textbox', { name: '返金する金額' })

      // Act
      await user.clear(field('返金する金額'))
      await user.type(field('返金する金額'), '5501')
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert
      await waitFor(() =>
        expect(field('返金する金額')).toHaveAccessibleDescription(
          expect.stringContaining(
            '返金する金額は、支払いの金額（￥5,500）以下にしてください。',
          ),
        ),
      )
      expect(field('返金の理由')).toHaveAccessibleDescription(
        expect.stringContaining('返金の理由を入力してください。'),
      )
      expect(field('返金する金額')).toHaveFocus()
      expect((await storedRefundsOf(saleId))[0]?.status).toBe('completed')
    })

    it('should show a payment that was given back meanwhile as it is now', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0223')
      await paySale(saleId)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      await user.click(
        screen.getByRole('link', { name: `${cashOf(saleId)} を返金する` }),
      )
      await screen.findByRole('textbox', { name: '返金する金額' })
      await refundSale(saleId)

      // Act
      await user.type(field('返金の理由'), '施術のやり直し')
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert
      expect(
        await screen.findByText('この支払いは、全額を返金しました。'),
      ).toBeVisible()
      expect(screen.queryByRole('textbox', { name: '返金する金額' })).toBeNull()
      expect((await storedRefundsOf(saleId))[0]?.refundReason).toBe('返金済み')
    })

    it('should say that a payment is not one of the sale of the address', async () => {
      // Arrange: a sale with a payment, and an address that names another
      const { saleId } = await arrangeVisit('0224')
      await paySale(saleId)

      // Act
      await openAt(
        (salon) => `/salons/${salon}/sales/${saleId}/payments/${saleId}/refund`,
      )

      // Assert
      expect(
        await screen.findByText(
          'この売上に、この支払いはありません。アドレスが正しいか、お確かめください。',
        ),
      ).toBeVisible()
    })

    it('should say that a refund was not recorded when the database refused it', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0225')
      await paySale(saleId)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      await user.click(
        screen.getByRole('link', { name: `${cashOf(saleId)} を返金する` }),
      )
      await screen.findByRole('textbox', { name: '返金する金額' })
      await refuse('update', 'payment_transactions')

      // Act
      await user.type(field('返金の理由'), '施術のやり直し')
      await user.click(screen.getByRole('button', { name: '返金を記録する' }))

      // Assert
      expect(
        await screen.findByText(
          '返金を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect((await storedRefundsOf(saleId))[0]?.status).toBe('completed')
    })
  })
})

describe('changing, voiding and giving back a sale on a page in English', () => {
  /** Waits for the page of a sale in English: its heading, then its parts. */
  const theSaleInEnglish = async (): Promise<void> => {
    await heading('Sale details')
    await screen.findByRole('table', { name: 'Line items' })
  }

  /** Opens the page of a sale of the salon in Tokyo in English, signed in. */
  const openSaleInEnglish = async (
    saleId: string,
    email = OWNER,
  ): Promise<void> => {
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/sales/${saleId}`,
      email,
      'en',
    )
    await theSaleInEnglish()
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

  it('should change who took a sale and its note, and say so, in English', async () => {
    // Arrange
    const { saleId } = await arrangeVisit('0301')
    const user = userEvent.setup()
    await openSaleInEnglish(saleId, STYLIST)
    await user.click(screen.getByRole('link', { name: 'Edit the sale' }))
    await heading('Edit the sale')
    await screen.findByRole('combobox', { name: 'Cashier' })
    expect(
      screen.getByText(
        'The line items and the amounts are not edited here. When they are wrong, an owner or a manager refunds the payments in full, voids the sale and checks the booking out again.',
      ),
    ).toBeVisible()

    // Act
    await user.selectOptions(field('Cashier'), 'Mika Suzuki')
    await user.type(field('Notes'), 'Entered after closing')
    await user.click(screen.getByRole('button', { name: 'Save the changes' }))

    // Assert
    await theSaleInEnglish()
    expect(notifications()).toContain('Saved the sale.')
    expect(describedIn('Sale')).toMatchObject({
      Cashier: 'Mika Suzuki',
      Notes: 'Entered after closing',
    })
  })

  it('should say in English at its control that a sale is not entered at a time to come', async () => {
    // Arrange
    const { saleId } = await arrangeVisit('0302')
    const user = userEvent.setup()
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/sales/${saleId}/edit`,
      OWNER,
      'en',
    )
    await screen.findByRole('combobox', { name: 'Cashier' })
    await user.clear(field('Date of sale'))
    await user.type(field('Date of sale'), await dayFromToday(1))

    // Act
    await user.click(screen.getByRole('button', { name: 'Save the changes' }))

    // Assert
    await waitFor(() =>
      expect(field('Time of the sale')).toHaveAccessibleDescription(
        expect.stringContaining('The time of the sale must be before now.'),
      ),
    )
  })

  it('should void a sale entered by mistake, asking why, in English', async () => {
    // Arrange
    const { saleId } = await arrangeVisit('0303')
    const user = userEvent.setup()
    await openSaleInEnglish(saleId)
    await user.click(
      within(part('Voiding')).getByRole('button', { name: 'Void the sale' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Void the sale?' })

    // Act: without a reason
    await user.click(within(dialog).getByRole('button', { name: 'Void' }))

    // Assert
    const reason = within(dialog).getByRole('textbox', {
      name: 'Reason for voiding',
    })
    await waitFor(() =>
      expect(reason).toHaveAccessibleDescription(
        expect.stringContaining('Enter the reason for voiding.'),
      ),
    )

    // Act
    await user.type(reason, 'Mixed up with another customer')
    await user.click(within(dialog).getByRole('button', { name: 'Void' }))

    // Assert
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Sale' })).toHaveFocus(),
    )
    expect(notifications()).toContain(
      'Voided the sale. The booking can be checked out again.',
    )
    expect(describedIn('Sale')).toMatchObject({
      Payment: 'Voided',
      'Reason for voiding': 'Mixed up with another customer',
    })
  })

  it('should give a part of a payment back, and say why the sale is not voided after it, in English', async () => {
    // Arrange
    const { saleId } = await arrangeVisit('0304')
    await paySale(saleId)
    const user = userEvent.setup()
    await openSaleInEnglish(saleId)
    expect(
      within(part('Voiding')).getByText(
        'This sale has payments that were received, so it cannot be voided as it is. Refund every payment in full first.',
      ),
    ).toBeVisible()
    await user.click(
      screen.getByRole('link', { name: `Refund ${cashOf(saleId)}` }),
    )
    await heading('Refund a payment')
    await screen.findByRole('textbox', { name: 'Amount to refund' })

    // Act
    await user.clear(field('Amount to refund'))
    await user.type(field('Amount to refund'), '1000')
    await user.type(field('Reason for the refund'), 'Forgot the change')
    await user.click(screen.getByRole('button', { name: 'Record the refund' }))

    // Assert
    await theSaleInEnglish()
    expect(notifications()).toContain('Recorded the refund.')
    expect(rowsOf('Payments')[0]?.slice(-2)).toEqual([
      'Partly refunded',
      expect.stringMatching(
        /^¥1,000, \w{3}, \w+ \d{1,2}, \d{4} at \d{2}:\d{2}$/,
      ),
    ])
    expect(describedIn('Payments')).toEqual({
      [`Reason for the refund of ${cashOf(saleId)}`]: 'Forgot the change',
    })
    expect(
      within(part('Voiding')).getByText(
        'A payment of this sale was partly refunded, so the sale cannot be voided. A payment is refunded once, so the rest cannot be refunded.',
      ),
    ).toBeVisible()
  })

  it('should tell a member of the staff in English who voids sales and records refunds', async () => {
    // Arrange
    const { saleId } = await arrangeVisit('0305')
    await paySale(saleId)

    // Act
    await openSaleInEnglish(saleId, STYLIST)

    // Assert
    expect(
      within(part('Voiding')).getByText(
        'Owners and managers void sales and record refunds.',
      ),
    ).toBeVisible()
    expect(rowsOf('Payments')[0]?.at(-1)).toBe('None')
  })
})
