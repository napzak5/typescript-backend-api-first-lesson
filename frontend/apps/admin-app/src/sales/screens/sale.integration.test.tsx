import { languageStore } from '@beauty-salon-frontend/io'
import {
  salonIdOf,
  testApi,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  notifications,
  readAgain,
} from '@beauty-salon-frontend/testing/screens'
import {
  OPERATOR,
  OSAKA,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { arrange } from '../../bookings/__tests__/arrangements'
import {
  customerIdOf,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import {
  arrangeSale,
  arrangeVisit,
  paySale,
  saleRemovedMeanwhile,
  sellAtTheCounter,
  sellToNobody,
} from '../__tests__/arrangements'
import { describedIn, openAt, part, theSale } from '../__tests__/screens'

/*
 * A sale and its receipt when they cannot be read, are refused, are of
 * another salon, or name what is not there: a customer, a booking. The
 * failures are arranged in the database.
 */

/** The member of the staff the stylist of the seed data is */
const STYLIST_NAME = 'Hiroshi Tanaka'

const NOT_THEIRS =
  'このサロンの売上は、見られません。売上を見られるのは、そのサロンのスタッフと、管理者です。'

/** A sale of the salon in Osaka, of a visit of today. */
const arrangeSaleInOsaka = async (): Promise<string> =>
  arrangeSale({
    saleNumber: 'SL-TEST-0599',
    bookingId: await arrange({
      bookingNumber: 'BK-TEST-0599',
      day: 0,
      at: '10:00',
      status: 'completed',
      salon: OSAKA,
      staffCode: 'STF003',
      service: 'Signature Cut',
      minutes: 75,
    }),
    at: '11:30',
  })

describe('a sale and its receipt, when they cannot be read or are not for the account, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('a sale', () => {
    it('should say that the sale could not be read, and show it when asked again', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0501')
      const readable = await unreadable('sales', 'createdAt', saleId)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      expect(
        await screen.findByText(
          '売上を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await theSale()
      expect(describedIn('売上')['売上番号']).toBe('SL-TEST-0501')
    })

    it('should tell an account that belongs to the salon no more that its sales are not for it', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0502')
      whenAskedFor(`GET /sales/${saleId}`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`, STYLIST)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('table', { name: '明細' })).toBeNull()
    })

    it('should say that a sale of another salon is not found at the address of this one', async () => {
      // Arrange
      const saleId = await arrangeSaleInOsaka()

      // Act
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/sales/${saleId}`,
        OPERATOR,
      )

      // Assert
      await heading('売上が見つかりません')
      expect(
        screen.getByRole('link', { name: '今日の売上へ' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/sales`)
      expect(screen.queryByText('SL-TEST-0599')).toBeNull()
    })

    it('should say that the details of a sale could not be read when its customer could not be, and show them when asked again', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0503')
      const readable = await unreadable(
        'customers',
        'createdAt',
        await customerIdOf(YUKI.email),
      )
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      expect(
        await screen.findByText(
          '売上の内容を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await theSale()
      expect(describedIn('売上')['お客様']).toBe(YUKI.name)
    })

    it('should show a sale entered for nobody of the ledger, with no points to record', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0504')
      await sellToNobody(saleId)

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)

      // Assert
      await theSale()
      expect(describedIn('売上')['お客様']).toBe('記録なし')
      expect(screen.queryByRole('heading', { name: 'ポイント' })).toBeNull()
    })

    it('should name the customer of a sale who was removed from the ledger as such, with no points to record', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0505')
      await testApi().query(
        'update customers set "deletedAt" = now() where email = $1',
        [YUKI.email],
      )

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)

      // Assert
      await theSale()
      expect(describedIn('売上')['お客様']).toBe('削除された顧客')
      expect(screen.queryByRole('heading', { name: 'ポイント' })).toBeNull()
    })

    it('should void a sale that bills no booking, and say only that it was voided', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0506')
      await sellAtTheCounter(saleId)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      expect(screen.queryByRole('link', { name: '予約の内容' })).toBeNull()
      await user.click(
        within(part('取り消し')).getByRole('button', {
          name: '売上を取り消す',
        }),
      )
      const dialog = screen.getByRole('dialog', {
        name: '売上を取り消しますか？',
      })
      await user.type(
        within(dialog).getByRole('textbox', { name: '取り消しの理由' }),
        '入れ間違い',
      )

      // Act
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      await waitFor(() =>
        expect(notifications()).toContain('売上を取り消しました。'),
      )
      expect(describedIn('売上')['支払い']).toBe('取り消し')
    })
  })

  describe('the receipt of a sale', () => {
    it('should say that the receipt could not be read, and show it when asked again', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0511')
      await paySale(saleId)
      const readable = await unreadable('sales', 'saleTime', saleId)
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/receipt`)
      expect(
        await screen.findByText(
          'レシートを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      const receipt = await screen.findByRole('article', { name: TOKYO })
      expect(within(receipt).getByText('SL-TEST-0511')).toBeVisible()
    })

    it('should tell an account that belongs to the salon no more that the receipt is not for it', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0512')
      await paySale(saleId)
      whenAskedFor(`GET /sales/${saleId}/receipt`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await openAt(
        (salon) => `/salons/${salon}/sales/${saleId}/receipt`,
        STYLIST,
      )

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('button', { name: '印刷する' })).toBeNull()
    })

    it('should say that the receipt of a sale of another salon is not found at the address of this one', async () => {
      // Arrange
      const saleId = await arrangeSaleInOsaka()
      await paySale(saleId)

      // Act
      await openAt(
        (salon) => `/salons/${salon}/sales/${saleId}/receipt`,
        OPERATOR,
      )

      // Assert
      await heading('売上が見つかりません')
      expect(screen.queryByRole('article')).toBeNull()
    })

    it('should say that the sale has no receipt now when it was paid after the receipt was refused', async () => {
      // Arrange: the receipt is refused, and the sale is paid before it is read again
      const { saleId } = await arrangeVisit('0513')
      whenAskedFor(`GET /sales/${saleId}`, () => paySale(saleId))

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/receipt`)

      // Assert
      expect(
        await screen.findByText(
          'この売上のレシートは、いまは出せません。売上の内容を確かめてください。',
        ),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: '売上の内容へ' })).toBeVisible()
    })

    it('should say that the sale of a receipt is not found when the sale is gone', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0515')
      await paySale(saleId)
      await saleRemovedMeanwhile(saleId)

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/receipt`)

      // Assert
      await heading('売上が見つかりません')
      expect(screen.queryByRole('article')).toBeNull()
    })

    it('should say that the sale is not found when it was gone after the receipt was refused', async () => {
      // Arrange
      const { saleId } = await arrangeVisit('0514')
      whenAskedFor(`GET /sales/${saleId}`, () => saleRemovedMeanwhile(saleId))

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/receipt`)

      // Assert
      await heading('売上が見つかりません')
    })
  })
})

describe('a sale on a page in English, when it is not for the account', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say in English that a sale of another salon is not found at the address of this one', async () => {
    // Arrange
    const saleId = await arrangeSaleInOsaka()

    // Act
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/sales/${saleId}`,
      OPERATOR,
      'en',
    )

    // Assert
    await heading('Sale not found')
    expect(
      screen.getByRole('link', { name: 'Go to today’s sales' }),
    ).toBeVisible()
  })
})
