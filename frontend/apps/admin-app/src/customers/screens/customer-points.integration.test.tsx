import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked } from '@beauty-salon-frontend/testing/answers'
import {
  dayFromToday,
  giveBack,
  refuse,
  salonIdOf,
  signInAs,
  takeAway,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  columnsOf,
  firstSight,
  heading,
  notifications,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import type { Locale } from '@beauty-salon-shared/i18n'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { arrange } from '../../bookings/__tests__/arrangements'
import {
  arrangeSale,
  sellToNobody,
  voidSale,
} from '../../sales/__tests__/arrangements'
import {
  arrangePoints,
  arrangeVisitPoints,
  customerIdOf,
  removeMeanwhile,
  storedBalanceOf,
  storedPointsOf,
} from '../__tests__/arrangements'

/*
 * The customer of these tests is Tanaka Yuki of the seed data, who has
 * 2,500 points from the opening balance of the ledger; Yamamoto Kenji has
 * 800. The seed data has no sales: the tests arrange them, at the salon in
 * Tokyo unless a test says otherwise. A member of the staff records at the
 * counter, and an owner adjusts.
 */

/** What is said when the points could not be recorded, whatever the reason */
const RECORD_AGAIN =
  'ポイントを記録できませんでした。通信の状態を確かめて、もう一度お試しください。'

/**
 * Holds the readings of the record of a customer until `release` is
 * called: a screen that opens meanwhile shows what was read of the
 * customer before, as it does when the reading is slow.
 */
const holdReadingsOf = (customerId: string): (() => void) => {
  const answer = globalThis.fetch
  const held = Promise.withResolvers<void>()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    if (
      request.method === 'GET' &&
      new URL(request.url).pathname.endsWith(`/customers/${customerId}`)
    ) {
      await held.promise
    }

    return answer(input, init)
  })

  return () => held.resolve()
}

/** What is said of what could not be read, by what it is */
const unread = (what: string): string =>
  `${what}を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。`

/** Takes the balance of the customers away the moment the screen asks for that of the customer. */
const takeTheBalanceAwayWhenAskedFor = (customerId: string): void =>
  whenAskedFor(`GET /points/customer/${customerId}/balance`, () =>
    takeAway('customers', 'loyaltyPoints'),
  )

/** The rows of the history without the times, which are those of the test. */
const historyShown = (): string[][] =>
  rowsOf('ポイントの履歴').map(([, ...rest]) => rest)

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** Opens a page of the salon in Tokyo at its address, signed in. */
const openAt = async (
  path: (tokyo: string) => string,
  email = STYLIST,
  language: Locale = 'ja',
) => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(path(tokyo))
  await signInAs(email, language)

  return tokyo
}

/** Opens the form that records points of a customer, at its address. */
const openForm = async (
  email: string,
  query = '',
  account = STYLIST,
): Promise<string> => {
  const customer = await customerIdOf(email)
  const tokyo = await openAt(
    (salon) => `/salons/${salon}/customers/${customer}/points/new${query}`,
    account,
  )
  await heading('ポイントを記録する')
  await screen.findByRole('radiogroup', { name: '記録すること' })

  return tokyo
}

/** Arranges a sale of Tanaka Yuki today, for a booking of hers that was finished. */
const aSaleOfYuki = async (number: string): Promise<string> =>
  arrangeSale({
    saleNumber: `SL-TEST-${number}`,
    bookingId: await arrange({
      bookingNumber: `BK-TEST-${number}`,
      day: 0,
      at: '10:00',
      status: 'completed',
    }),
    at: '11:00',
  })

/** Opens the page of a sale, and goes from its part 「ポイント」 to the form with what the button asks for. */
const fromTheSale = async (
  user: ReturnType<typeof userEvent.setup>,
  saleId: string,
  button: '使ったポイントを記録する' | 'ポイントを付与する',
): Promise<string> => {
  const tokyo = await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
  await heading('売上の内容')
  await user.click(
    within(await screen.findByRole('region', { name: 'ポイント' })).getByRole(
      'link',
      { name: button },
    ),
  )
  await heading('ポイントを記録する')
  await screen.findByRole('checkbox', { name: /^売上番号 SL-TEST-/ })

  return tokyo
}

describe('the points of customers, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('reading the points', () => {
    it('should lead from the page of a customer to the balance, the points that expire soon with those past their day, and the history with the record each was made for', async () => {
      // Arrange
      const user = userEvent.setup()
      const saleId = await arrangeSale({
        saleNumber: 'SL-TEST-0301',
        bookingId: await arrange({
          bookingNumber: 'BK-TEST-0301',
          day: -20,
          at: '10:00',
          status: 'completed',
        }),
        at: '11:00',
      })
      const bookingId = await arrange({
        bookingNumber: 'BK-TEST-0302',
        day: -10,
        at: '10:00',
        status: 'completed',
      })
      const ofOsaka = await arrangeSale({
        saleNumber: 'SL-TEST-0303',
        bookingId: await arrange({
          bookingNumber: 'BK-TEST-0303',
          day: -5,
          at: '10:00',
          status: 'completed',
          salon: OSAKA,
          staffCode: 'STF003',
          service: 'Signature Cut',
          minutes: 75,
        }),
        at: '12:00',
      })
      await arrangePoints(YUKI.email, [
        {
          type: 'earned',
          points: 300,
          daysAgo: 35,
          description: '紹介のお礼',
          expiresIn: -1,
        },
        {
          type: 'earned',
          points: 500,
          daysAgo: 20,
          description: 'お会計のポイント',
          expiresIn: 10,
          reference: { type: 'sale', id: saleId },
        },
        {
          type: 'used',
          points: -200,
          daysAgo: 10,
          reference: { type: 'booking', id: bookingId },
        },
        {
          type: 'earned',
          points: 400,
          daysAgo: 5,
          expiresIn: 90,
          reference: { type: 'sale', id: ofOsaka },
        },
        {
          type: 'adjusted',
          points: 100,
          daysAgo: 1,
          description: '入れ間違いを直す',
        },
      ])
      const yuki = await customerIdOf(YUKI.email)
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${yuki}`,
      )
      await heading('お客様の台帳')

      // Act
      await user.click(
        within(
          await screen.findByRole('region', { name: '来店とポイント' }),
        ).getByRole('link', { name: 'ポイントの履歴' }),
      )

      // Assert
      await heading('ポイント')
      expect(address()).toBe(`/salons/${tokyo}/customers/${yuki}/points`)
      expect(
        await screen.findByRole('region', { name: '残高' }),
      ).toHaveTextContent('3,600 ポイント')
      const yesterday = dayNameOf(await dayFromToday(-1)).ja
      const soon = dayNameOf(await dayFromToday(10)).ja
      const expiring = await screen.findByRole('region', {
        name: '期限が近いポイント',
      })
      expect(expiring).toHaveTextContent(
        `30 日以内に期限が来るポイントは、600 ポイントです。最も早い期限は、${yesterday}です。`,
      )
      expect(expiring).toHaveTextContent(
        '期限を過ぎたポイントも、失効させるまでは使えます。',
      )
      expect(
        rowsOf('期限が近いポイントの内訳').map(
          ([day, kind, points, , description]) => [
            day,
            kind,
            points,
            description,
          ],
        ),
      ).toEqual([
        [`${yesterday}（期限切れ）`, '付与', '300 ポイント', '紹介のお礼'],
        [soon, '付与', '500 ポイント', 'お会計のポイント'],
      ])
      await screen.findByRole('table', { name: 'ポイントの履歴' })
      expect(
        await screen.findByRole('link', { name: '売上 SL-TEST-0301' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/sales/${saleId}`)
      expect(
        await screen.findByRole('link', { name: '予約 BK-TEST-0302' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/bookings/${bookingId}`)
      await screen.findByText('ほかのサロンの売上')
      expect(historyShown()).toEqual([
        ['調整', '+100', '3,600 ポイント', '', '', '入れ間違いを直す'],
        [
          '付与',
          '+400',
          '3,500 ポイント',
          dayNameOf(await dayFromToday(90)).ja,
          'ほかのサロンの売上',
          '記録なし',
        ],
        ['利用', '−200', '3,100 ポイント', '', '予約 BK-TEST-0302', '記録なし'],
        [
          '付与',
          '+500',
          '3,300 ポイント',
          soon,
          '売上 SL-TEST-0301',
          'お会計のポイント',
        ],
        ['付与', '+300', '2,800 ポイント', yesterday, '', '紹介のお礼'],
        ['調整', '+2,500', '2,500 ポイント', '', '', 'ポイント台帳の開始残高'],
      ])
      expect(await findAccessibilityViolations(document.body)).toEqual([])
    })

    it('should show the transactions that come after the first twenty, and move the focus to the first of them', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeVisitPoints(YUKI.email, 20)
      const yuki = await customerIdOf(YUKI.email)
      await openAt((salon) => `/salons/${salon}/customers/${yuki}/points`)
      await screen.findByRole('table', { name: 'ポイントの履歴' })
      expect(historyShown()).toHaveLength(20)
      expect(historyShown()[0]).toEqual([
        '付与',
        '+10',
        '2,700 ポイント',
        '',
        '',
        'ご来店 20',
      ])

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      await screen.findByText('ポイント台帳の開始残高')
      expect(historyShown()).toHaveLength(21)
      const rows = within(
        screen.getByRole('table', { name: 'ポイントの履歴' }),
      ).getAllByRole('row')
      expect(
        within(rows.at(-1) ?? document.body).getByRole('rowheader'),
      ).toHaveFocus()
      expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
    })

    it('should name a booking of another salon, and lead to the customer a merge moved points from', async () => {
      // Arrange
      const ofOsaka = await arrange({
        bookingNumber: 'BK-TEST-0311',
        day: -5,
        at: '10:00',
        status: 'completed',
        salon: OSAKA,
        staffCode: 'STF003',
        service: 'Signature Cut',
        minutes: 75,
      })
      const [yuki, kenji] = await Promise.all([
        customerIdOf(YUKI.email),
        customerIdOf(KENJI.email),
      ])
      await arrangePoints(YUKI.email, [
        {
          type: 'used',
          points: -100,
          daysAgo: 3,
          reference: { type: 'booking', id: ofOsaka },
        },
        {
          type: 'transferred',
          points: 800,
          daysAgo: 1,
          reference: { type: 'customer', id: kenji },
        },
      ])

      // Act
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${yuki}/points`,
      )

      // Assert
      await screen.findByText('ほかのサロンの予約')
      expect(
        screen.getByRole('link', { name: '統合したお客様' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/customers/${kenji}`)
      expect(historyShown().map(([, , , , reference]) => reference)).toEqual([
        '統合したお客様',
        'ほかのサロンの予約',
        '',
      ])
    })

    it('should say in each part what could not be read, and show each when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await customerIdOf(YUKI.email)
      await takeAway('customer_points')
      takeTheBalanceAwayWhenAskedFor(yuki)
      await openAt((salon) => `/salons/${salon}/customers/${yuki}/points`)
      await waitFor(() =>
        expect(
          screen.getAllByRole('alert').map((alert) => alert.textContent),
        ).toHaveLength(3),
      )
      expect(
        screen.getAllByRole('alert').map((alert) => alert.textContent),
      ).toEqual(
        expect.arrayContaining(
          [
            unread('残高'),
            unread('期限が近いポイント'),
            unread('ポイントの履歴'),
          ].map((said) => expect.stringContaining(said)),
        ),
      )
      await giveBack('customer_points')
      await giveBack('customers', 'loyaltyPoints')

      // Act
      for (const button of screen.getAllByRole('button', {
        name: 'もう一度読み込む',
      })) {
        await user.click(button)
      }

      // Assert
      expect(
        await screen.findByRole('region', { name: '残高' }),
      ).toHaveTextContent('2,500 ポイント')
      await screen.findByRole('table', { name: 'ポイントの履歴' })
      expect(historyShown()).toEqual([
        ['調整', '+2,500', '2,500 ポイント', '', '', 'ポイント台帳の開始残高'],
      ])
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    })

    it('should keep the transactions it has when the next ones do not come, and add them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeVisitPoints(YUKI.email, 20)
      const yuki = await customerIdOf(YUKI.email)
      await openAt((salon) => `/salons/${salon}/customers/${yuki}/points`)
      await screen.findByRole('table', { name: 'ポイントの履歴' })
      await takeAway('customer_points')
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(historyShown()).toHaveLength(20)
      await giveBack('customer_points')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await screen.findByText('ポイント台帳の開始残高')
      expect(historyShown()).toHaveLength(21)
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('recording points', () => {
    it('should open the form without the balance when it could not be read', async () => {
      // Arrange
      takeTheBalanceAwayWhenAskedFor(await customerIdOf(YUKI.email))

      // Act
      await openForm(YUKI.email)

      // Assert
      expect(text('ポイント数')).toHaveAccessibleDescription(
        '1 以上の整数で入れます。減らすときも、減らす数を入れます。',
      )
    })

    it('should give points that expire on a day, say so with the balance, and show them first in the history and on the page of the customer', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await customerIdOf(YUKI.email)
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${yuki}/points`,
      )
      await user.click(
        within(await screen.findByRole('region', { name: '残高' })).getByRole(
          'link',
          { name: 'ポイントを記録する' },
        ),
      )
      await heading('ポイントを記録する')
      expect(
        await screen.findByRole('radio', { name: 'ポイントを付与する' }),
      ).toBeChecked()
      expect(text('ポイント数')).toHaveAccessibleDescription(
        expect.stringContaining('いまの残高は 2,500 ポイントです。'),
      )
      const day = await dayFromToday(30)
      await user.type(text('ポイント数'), '500')
      await user.type(screen.getByLabelText('有効期限'), day)
      await user.type(text('説明'), '誕生月のポイント')
      const release = holdReadingsOf(yuki)

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      await heading('ポイント')
      expect(address()).toBe(`/salons/${tokyo}/customers/${yuki}/points`)
      expect(notifications()).toContain(
        '500 ポイントを付与しました。残高は 3,000 ポイントです。',
      )
      await screen.findByRole('table', { name: 'ポイントの履歴' })
      expect(historyShown()[0]).toEqual([
        '付与',
        '+500',
        '3,000 ポイント',
        dayNameOf(day).ja,
        '',
        '誕生月のポイント',
      ])
      expect((await storedPointsOf(YUKI.email))[0]).toEqual({
        transactionType: 'earned',
        points: 500,
        balance: 3000,
        description: '誕生月のポイント',
        referenceType: null,
        referenceId: null,
        expiryDate: day,
      })
      expect(await storedBalanceOf(YUKI.email)).toBe(3000)

      // Act
      await user.click(screen.getByRole('link', { name: 'お客様の台帳へ' }))

      // Assert: the balance before the recording is not shown, although the customer is not read anew yet
      await heading('お客様の台帳')
      expect(firstSight()).toEqual([
        `/salons/${tokyo}/customers/${yuki}`,
        expect.stringContaining('3,000 ポイント'),
      ])
      expect(firstSight()[1]).not.toContain('2,500 ポイント')
      release()
      expect(
        await screen.findByRole('region', { name: '来店とポイント' }),
      ).toHaveTextContent('3,000 ポイント')
    })

    it('should record from the page of a sale the points used for it', async () => {
      // Arrange
      const user = userEvent.setup()
      const saleId = await aSaleOfYuki('0401')
      await fromTheSale(user, saleId, '使ったポイントを記録する')
      expect(
        screen.getByRole('radio', { name: '使ったポイントを記録する' }),
      ).toBeChecked()
      expect(
        screen.getByRole('checkbox', { name: /^売上番号 SL-TEST-0401（/ }),
      ).toBeChecked()
      expect(screen.queryByLabelText('有効期限')).toBeNull()
      await user.type(text('ポイント数'), '300')

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      await heading('ポイント')
      expect(notifications()).toContain(
        '300 ポイントを使いました。残高は 2,200 ポイントです。',
      )
      expect(
        await screen.findByRole('link', { name: '売上 SL-TEST-0401' }),
      ).toBeVisible()
      expect((await storedPointsOf(YUKI.email))[0]).toEqual({
        transactionType: 'used',
        points: -300,
        balance: 2200,
        description: null,
        referenceType: 'sale',
        referenceId: saleId,
        expiryDate: null,
      })
    })

    it('should say that the sale has points given already, and record nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const saleId = await aSaleOfYuki('0402')
      await arrangePoints(YUKI.email, [
        {
          type: 'earned',
          points: 100,
          daysAgo: 0,
          reference: { type: 'sale', id: saleId },
        },
      ])
      await fromTheSale(user, saleId, 'ポイントを付与する')
      await user.type(text('ポイント数'), '100')

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'この売上には、もうポイントを付与しています。ポイントの履歴をお確かめください。',
      )
      expect(await storedPointsOf(YUKI.email)).toHaveLength(2)
    })

    it('should say that a sale voided meanwhile takes no points, and record nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const saleId = await aSaleOfYuki('0403')
      await fromTheSale(user, saleId, '使ったポイントを記録する')
      await user.type(text('ポイント数'), '100')
      await voidSale(saleId)

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '取り消した売上には、ポイントを付与も利用もできません。',
      )
      expect(await storedBalanceOf(YUKI.email)).toBe(2500)
    })

    it('should say at the count that no more points can be used than the balance', async () => {
      // Arrange
      const user = userEvent.setup()
      await openForm(KENJI.email, '?kind=used')
      await user.type(text('ポイント数'), '1000')

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      await vi.waitFor(() =>
        expect(text('ポイント数')).toHaveAccessibleDescription(
          expect.stringContaining(
            '残高（800 ポイント）より多くは減らせません。',
          ),
        ),
      )
      expect(text('ポイント数')).toBeInvalid()
      expect(await storedBalanceOf(KENJI.email)).toBe(800)
    })

    it('should let an owner take points away with why, without a day of expiry', async () => {
      // Arrange
      const user = userEvent.setup()
      await openForm(YUKI.email, '', OWNER)
      await user.click(screen.getByRole('radio', { name: '調整で減らす' }))
      expect(screen.queryByLabelText('有効期限')).toBeNull()
      await user.type(text('ポイント数'), '200')
      await user.type(text('説明'), '二重に付与したため')

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      await heading('ポイント')
      expect(notifications()).toContain(
        '調整で200 ポイント減らしました。残高は 2,300 ポイントです。',
      )
      expect((await storedPointsOf(YUKI.email))[0]).toMatchObject({
        transactionType: 'adjusted',
        points: -200,
        balance: 2300,
        description: '二重に付与したため',
      })
    })

    it('should offer a member of the staff only what the counter records', async () => {
      // Act
      await openForm(YUKI.email)

      // Assert
      expect(
        within(screen.getByRole('radiogroup', { name: '記録すること' }))
          .getAllByRole('radio')
          .map((radio) => radio.getAttribute('value')),
      ).toEqual(['earned', 'used'])
      expect(await findAccessibilityViolations(document.body)).toEqual([])
    })

    it.each<[string, string, string, string]>([
      [
        'a count of nought',
        'ポイント数',
        '0',
        'ポイント数は、1 から 2,147,483,647 までの整数で入力してください。',
      ],
      [
        'a day of expiry before today',
        '有効期限',
        '2026-01-01',
        '有効期限は、今日以降の日付にしてください。',
      ],
    ])(
      'should say what is wrong with %s at its control, and send nothing',
      async (_case, label, typed, error) => {
        // Arrange
        const user = userEvent.setup()
        await openForm(YUKI.email)
        const fetched = vi.spyOn(globalThis, 'fetch')
        if (label !== 'ポイント数') {
          await user.type(text('ポイント数'), '100')
        }
        await user.type(screen.getByLabelText(label), typed)

        // Act
        await user.click(screen.getByRole('button', { name: '記録する' }))

        // Assert
        expect(screen.getByLabelText(label)).toHaveAccessibleDescription(
          expect.stringContaining(error),
        )
        expect(
          asked(fetched).filter((line) => line.startsWith('POST ')),
        ).toEqual([])
        expect(await storedPointsOf(YUKI.email)).toHaveLength(1)
      },
    )

    it('should show the customer as not found when they were removed from the ledger meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      await openForm(YUKI.email)
      await user.type(text('ポイント数'), '100')
      await removeMeanwhile(YUKI.email)

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(await heading('お客様が見つかりません')).toBeVisible()
    })

    it('should say that the points were not recorded when the database fails, and keep what was typed', async () => {
      // Arrange
      const user = userEvent.setup()
      await openForm(YUKI.email)
      await user.type(text('ポイント数'), '100')
      await refuse('insert', 'customer_points')

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(RECORD_AGAIN)
      expect(text('ポイント数')).toHaveValue('100')
      expect(await storedBalanceOf(YUKI.email)).toBe(2500)
    })
  })

  describe('the sale the address names', () => {
    it.each<[string, (saleId: string) => Promise<unknown>, string]>([
      [
        'a sale that was voided',
        voidSale,
        'アドレスの売上は取り消されています。取り消した売上には、ポイントを付与も利用もできないため、売上に結びつけずに記録します。',
      ],
      [
        'a sale of nobody of the ledger',
        sellToNobody,
        'アドレスの売上は、お客様を記録していない売上です。売上に結びつけずに記録します。',
      ],
    ])(
      'should not offer %s, and record the points for no sale',
      async (_case, arrangeIt, why) => {
        // Arrange
        const user = userEvent.setup()
        const saleId = await aSaleOfYuki('0501')
        await arrangeIt(saleId)
        await openForm(YUKI.email, `?saleId=${saleId}&kind=used`)
        expect(screen.getByText(why)).toBeVisible()
        expect(screen.queryByRole('checkbox')).toBeNull()
        await user.type(text('ポイント数'), '100')

        // Act
        await user.click(screen.getByRole('button', { name: '記録する' }))

        // Assert
        await heading('ポイント')
        expect((await storedPointsOf(YUKI.email))[0]).toMatchObject({
          transactionType: 'used',
          referenceType: null,
          referenceId: null,
        })
      },
    )

    it('should say that a sale of another salon is not found', async () => {
      // Arrange
      const saleId = await arrangeSale({
        saleNumber: 'SL-TEST-0502',
        bookingId: await arrange({
          bookingNumber: 'BK-TEST-0502',
          day: 0,
          at: '10:00',
          status: 'completed',
          salon: OSAKA,
          staffCode: 'STF003',
          service: 'Signature Cut',
          minutes: 75,
        }),
        at: '12:00',
      })

      // Act
      await openForm(YUKI.email, `?saleId=${saleId}`)

      // Assert
      expect(
        screen.getByText(
          'アドレスの売上が見つかりません。売上に結びつけずに記録します。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('checkbox')).toBeNull()
    })

    it.each<[string, (saleId: string) => Promise<unknown>]>([
      ['a sale that was voided', voidSale],
      ['a sale of nobody of the ledger', sellToNobody],
    ])('should not lead from %s to the points', async (_case, arrangeIt) => {
      // Arrange
      const saleId = await aSaleOfYuki('0503')
      await arrangeIt(saleId)

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)

      // Assert
      await heading('売上の内容')
      await screen.findByRole('region', { name: 'レシート' })
      expect(screen.queryByRole('region', { name: 'ポイント' })).toBeNull()
    })
  })
})

describe('the points of customers on a page in English, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should show the balance, the points that expire soon and the history with the record each was made for, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const saleId = await aSaleOfYuki('0701')
    const bookingId = await arrange({
      bookingNumber: 'BK-TEST-0702',
      day: -10,
      at: '10:00',
      status: 'completed',
    })
    await arrangePoints(YUKI.email, [
      {
        type: 'earned',
        points: 300,
        daysAgo: 35,
        description: 'Thanks for a referral',
        expiresIn: -1,
      },
      {
        type: 'earned',
        points: 500,
        daysAgo: 20,
        expiresIn: 10,
        reference: { type: 'sale', id: saleId },
      },
      {
        type: 'used',
        points: -200,
        daysAgo: 10,
        reference: { type: 'booking', id: bookingId },
      },
    ])
    const yuki = await customerIdOf(YUKI.email)
    await openAt((salon) => `/salons/${salon}/customers/${yuki}`, STYLIST, 'en')
    await heading('Customer record')

    // Act
    await user.click(
      within(
        await screen.findByRole('region', { name: 'Visits and points' }),
      ).getByRole('link', { name: 'Point history' }),
    )

    // Assert
    await heading('Points')
    expect(
      await screen.findByRole('region', { name: 'Balance' }),
    ).toHaveTextContent('3,100 points')
    const yesterday = dayNameOf(await dayFromToday(-1)).en
    const soon = dayNameOf(await dayFromToday(10)).en
    const expiring = await screen.findByRole('region', {
      name: 'Points expiring soon',
    })
    expect(expiring).toHaveTextContent(
      `Points expiring within 30 days: 600 points. The earliest expiry date is ${yesterday}.`,
    )
    expect(
      rowsOf('Breakdown of the points expiring soon').map(
        ([day, kind, points]) => [day, kind, points],
      ),
    ).toEqual([
      [`${yesterday} (expired)`, 'Given', '300 points'],
      [soon, 'Given', '500 points'],
    ])
    await screen.findByRole('table', { name: 'Point history' })
    expect(
      await screen.findByRole('link', { name: 'Sale SL-TEST-0701' }),
    ).toBeVisible()
    expect(
      await screen.findByRole('link', { name: 'Booking BK-TEST-0702' }),
    ).toBeVisible()
    expect(columnsOf('Point history')).toEqual([
      'Date and time',
      'Kind',
      'Change',
      'Balance',
      'Expiry date',
      'Recorded for',
      'Description',
    ])
    expect(rowsOf('Point history').map(([, ...rest]) => rest)).toEqual([
      [
        'Used',
        '−200',
        '3,100 points',
        '',
        'Booking BK-TEST-0702',
        'Not recorded',
      ],
      [
        'Given',
        '+500',
        '3,300 points',
        soon,
        'Sale SL-TEST-0701',
        'Not recorded',
      ],
      ['Given', '+300', '2,800 points', yesterday, '', 'Thanks for a referral'],
      ['Adjusted', '+2,500', '2,500 points', '', '', 'ポイント台帳の開始残高'],
    ])
    expect(
      screen.getByRole('link', { name: 'Back to the customer' }),
    ).toBeVisible()
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })

  it('should record points in English and say so with the balance', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await customerIdOf(YUKI.email)
    await openAt(
      (salon) => `/salons/${salon}/customers/${yuki}/points/new`,
      STYLIST,
      'en',
    )
    await heading('Record points')
    expect(
      await screen.findByRole('radio', { name: 'Give points' }),
    ).toBeChecked()
    expect(text('Points')).toHaveAccessibleDescription(
      'Enter a whole number of 1 or more. To take points away, enter how many to take away. The balance is now 2,500 points.',
    )
    await user.type(text('Points'), '500')
    await user.type(text('Description'), 'Birthday points')

    // Act
    await user.click(screen.getByRole('button', { name: 'Record' }))

    // Assert
    await heading('Points')
    expect(notifications()).toContain(
      'Gave 500 points. The balance is now 3,000 points.',
    )
    expect(await storedBalanceOf(YUKI.email)).toBe(3000)
  })

  it('should say in English at the count that no more points can be used than the balance', async () => {
    // Arrange
    const user = userEvent.setup()
    const kenji = await customerIdOf(KENJI.email)
    await openAt(
      (salon) => `/salons/${salon}/customers/${kenji}/points/new?kind=used`,
      STYLIST,
      'en',
    )
    await heading('Record points')
    await screen.findByRole('radiogroup', { name: 'What to record' })
    await user.type(text('Points'), '1000')

    // Act
    await user.click(screen.getByRole('button', { name: 'Record' }))

    // Assert
    await vi.waitFor(() =>
      expect(text('Points')).toHaveAccessibleDescription(
        expect.stringContaining(
          'You cannot take away more than the balance (800 points).',
        ),
      ),
    )
    expect(text('Points')).toBeInvalid()
    expect(await storedBalanceOf(KENJI.email)).toBe(800)
  })
})
