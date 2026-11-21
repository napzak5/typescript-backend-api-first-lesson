import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  arrange,
  dayFromToday,
  OWNER,
  refuse,
  STYLIST,
  salonIdOf,
  signInAs,
  THERAPIST,
  TOKYO,
  YUKI,
} from '../bookings/__tests__/arrangements'
import {
  arrangeSale,
  paySale,
  storedPaymentsOf,
  storedSaleOf,
  voidSale,
} from './__tests__/arrangements'

/** The kinds of payment of the seed data that take a total between 100 and 10,000 yen at once */
const ONE_PAYMENT =
  '現金、クレジットカード、デビットカード、電子マネー、QR コード決済、ポイント'

/** The address the application is at, as the router knows it */
let address = ''

/** The address a screen was opened at, and what the page showed in the commit that opened it */
let firstSight: [string, string] = ['', '']

const Address = () => {
  const { pathname, search } = useLocation()
  address = `${pathname}${search}`
  useLayoutEffect(() => {
    firstSight = [pathname, document.querySelector('main')?.textContent ?? '']
  }, [pathname])

  return null
}

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** What the application says in its notifications. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((text) => text !== '')

/** The rows of a table, a list of the texts of their cells each. */
const rowsOf = (name: string): string[][] =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent ?? ''),
    )

/** What a part of a page describes, term by term. */
const describedIn = (part: string): Record<string, string> => {
  const section = screen.getByRole('heading', { name: part }).closest('section')

  return Object.fromEntries(
    within(section ?? document.body)
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )
}

/** The part of a page under a heading. */
const part = (name: string): HTMLElement =>
  screen.getByRole('heading', { name }).closest('section') ?? document.body

/** Waits for the page of a sale: its heading, then its parts, which are read after it. */
const theSale = async (): Promise<void> => {
  await heading('売上の内容')
  await screen.findByRole('table', { name: '明細' })
}

/** Opens a page of the salon in Tokyo at its address, signed in. */
const openAt = async (path: (tokyo: string) => string, email = OWNER) => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(path(tokyo))
  await signInAs(email)

  return tokyo
}

describe('the sales of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('entering the sale of a booking', () => {
    it('should enter the sale of a visit from the page of its booking, with a service added, and show it', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 0,
        at: '10:00',
        status: 'completed',
      })
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/bookings/${id}`)
      expect(
        await within(
          await screen.findByRole('region', { name: '会計' }),
        ).findByText('まだ会計を入れていません。'),
      ).toBeVisible()
      await user.click(screen.getByRole('link', { name: '会計を入れる' }))
      await heading('会計を入れる')
      await screen.findByRole('table', { name: '予約の施術' })
      expect(rowsOf('予約の施術')).toEqual([
        ['Ladies Cut', 'Hiroshi Tanaka', '￥5,500', '￥0'],
      ])
      await within(part('金額')).findByText(ONE_PAYMENT)
      expect(describedIn('金額')).toEqual({
        小計: '￥5,500',
        割引: '￥0',
        消費税: '￥0',
        合計: '￥5,500',
        '1 回で受け取れる支払い方法': ONE_PAYMENT,
      })

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '足す施術' }),
        'Mens Cut（￥4,000）',
      )
      await user.click(screen.getByRole('button', { name: '施術を足す' }))

      // Assert
      expect(screen.getByText('Mens Cutを足しました。')).toBeVisible()
      expect(rowsOf('足した施術')).toEqual([
        ['Mens Cut', 'Hiroshi Tanaka', '￥4,000', '￥0', '外す'],
      ])
      await waitFor(() =>
        expect(describedIn('金額')).toEqual({
          小計: '￥9,500',
          割引: '￥0',
          消費税: '￥0',
          合計: '￥9,500',
          '1 回で受け取れる支払い方法': ONE_PAYMENT,
        }),
      )
      expect(
        screen.getByRole('combobox', { name: '会計の担当' }),
      ).toHaveDisplayValue('Hiroshi Tanaka')
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '会計の担当' }),
        'Mika Suzuki',
      )
      await user.type(screen.getByLabelText('メモ'), 'カードで後払い')
      await user.click(screen.getByRole('button', { name: '会計を入れる' }))

      // Assert
      await theSale()
      const stored = await storedSaleOf(id)
      expect(stored).toEqual({
        saleNumber: expect.stringMatching(/^SL-/),
        staffCode: 'STF002',
        customerEmail: YUKI.email,
        bookingId: id,
        saleDate: await dayFromToday(0),
        subtotal: 9500,
        taxAmount: 0,
        totalAmount: 9500,
        paymentStatus: 'pending',
        notes: 'カードで後払い',
        details: [
          {
            itemName: 'Ladies Cut',
            staffCode: 'STF001',
            unitPrice: 5500,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount: 5500,
          },
          {
            itemName: 'Mens Cut',
            staffCode: 'STF001',
            unitPrice: 4000,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount: 4000,
          },
        ],
      })
      // The sale the API answered with is shown at once
      expect(firstSight).toEqual([
        expect.stringMatching(new RegExp(`^/salons/${tokyo}/sales/`)),
        expect.stringContaining(stored.saleNumber),
      ])
      expect(notifications()).toContain('会計を入れました。')
      expect(rowsOf('明細').map((row) => row[0])).toEqual([
        'Ladies Cut',
        'Mens Cut',
      ])
      expect(screen.getByText('まだ支払いはありません')).toBeVisible()

      // Act
      await user.click(screen.getByRole('link', { name: '予約の内容' }))

      // Assert: the part that was read before the sale is read anew
      expect(firstSight[1]).not.toContain('まだ会計を入れていません。')
      const billed = await within(
        await screen.findByRole('region', { name: '会計' }),
      ).findByRole('link', { name: stored.saleNumber })
      expect(billed).toBeVisible()
    })

    it('should share the tax among the lines whose prices leave it out, the yen that is left over to the first', async () => {
      // Arrange: the cut of the booking and the service added, their prices without the tax
      const id = await arrange({
        bookingNumber: 'BK-TEST-0006',
        day: 0,
        at: '13:00',
        status: 'completed',
      })
      await testApi().query(
        `update booking_services set "taxIncluded" = false where "bookingId" = $1`,
        [id],
      )
      await testApi().query(
        `update services set price = 4005, "taxIncluded" = false
         where name = 'Mens Cut' and "salonId" = (select id from salons where name = $1)`,
        [TOKYO],
      )
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/bookings/${id}/checkout`)
      await screen.findByRole('table', { name: '予約の施術' })
      await user.selectOptions(
        screen.getByRole('combobox', { name: '足す施術' }),
        'Mens Cut（￥4,005）',
      )
      await user.click(screen.getByRole('button', { name: '施術を足す' }))
      await waitFor(() =>
        expect(describedIn('金額')).toMatchObject({
          小計: '￥9,505',
          消費税: '￥950',
          合計: '￥10,455',
        }),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '会計を入れる' }))

      // Assert: 10 % of 9,505 yen without what is less than a yen, shared by the prices
      await theSale()
      expect(await storedSaleOf(id)).toMatchObject({
        subtotal: 9505,
        taxAmount: 950,
        totalAmount: 10455,
        details: [
          {
            itemName: 'Ladies Cut',
            unitPrice: 5500,
            taxAmount: 550,
            totalAmount: 6050,
          },
          {
            itemName: 'Mens Cut',
            unitPrice: 4005,
            taxAmount: 400,
            totalAmount: 4405,
          },
        ],
      })
      expect(rowsOf('明細').map((row) => row.slice(5))).toEqual([
        ['￥550', '￥6,050'],
        ['￥400', '￥4,405'],
      ])
    })

    it('should lead from the address of the checkout of a booking that was billed to its sale, and offer a checkout again once the sale was voided', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0007',
        day: 0,
        at: '14:00',
        status: 'completed',
      })
      const saleId = await arrangeSale({
        saleNumber: 'SL-TEST-0007',
        bookingId: id,
        at: '15:00',
      })
      const user = userEvent.setup()

      // Act
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/bookings/${id}/checkout`,
      )

      // Assert
      expect(
        await screen.findByText(
          'この予約には、会計が入っています。1 件の予約に入れる会計は、1 件です。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '売上の内容へ' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/sales/${saleId}`)
      expect(screen.queryByRole('button', { name: '会計を入れる' })).toBeNull()

      // Act
      await voidSale(saleId)
      await user.click(screen.getByRole('link', { name: '予約' }))
      await heading('予約台帳')
      await user.click(await screen.findByRole('link', { name: YUKI.name }))

      // Assert
      const billing = await screen.findByRole('region', { name: '会計' })
      expect(
        await within(billing).findByText('まだ会計を入れていません。'),
      ).toBeVisible()
      expect(
        within(billing).getByRole('link', { name: '会計を入れる' }),
      ).toBeVisible()
    })

    it('should say that the sale was not entered when the database refuses it, and keep the bill', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0008',
        day: 0,
        at: '17:00',
        status: 'completed',
      })
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/bookings/${id}/checkout`)
      await within(
        await screen.findByRole('region', { name: '金額' }),
      ).findByText(ONE_PAYMENT)
      await refuse('insert', 'sales')

      // Act
      await user.click(screen.getByRole('button', { name: '会計を入れる' }))

      // Assert
      expect(
        await screen.findByText(
          '会計を入れられませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('heading', { level: 1, name: '会計を入れる' }),
      ).toBeVisible()
      expect(rowsOf('予約の施術')).toEqual([
        ['Ladies Cut', 'Hiroshi Tanaka', '￥5,500', '￥0'],
      ])
      expect(
        await testApi().query('select count(*)::int as count from sales'),
      ).toEqual([{ count: 0 }])
    })

    it('should say that a price changed after the checkout opened, and count the price of now once it is calculated again', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0009',
        day: 0,
        at: '18:00',
        status: 'completed',
      })
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/bookings/${id}/checkout`)
      await within(
        await screen.findByRole('region', { name: '金額' }),
      ).findByText(ONE_PAYMENT)
      await testApi().query(
        `update services set price = 4500
         where name = 'Mens Cut' and "salonId" = (select id from salons where name = $1)`,
        [TOKYO],
      )

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '足す施術' }),
        'Mens Cut（￥4,000）',
      )
      await user.click(screen.getByRole('button', { name: '施術を足す' }))

      // Assert: the screen had the old price, the API counted the new one
      expect(
        await screen.findByText(
          'メニューの料金が、この画面を開いたあとで変わりました。計算し直すと、いまの料金で数えます。',
        ),
      ).toBeVisible()
      expect(within(part('金額')).queryAllByRole('term')).toEqual([])

      // Act
      await user.click(screen.getByRole('button', { name: '計算し直す' }))

      // Assert
      await waitFor(() => expect(describedIn('金額')['合計']).toBe('￥10,000'))
      expect(rowsOf('足した施術')).toEqual([
        ['Mens Cut', 'Hiroshi Tanaka', '￥4,500', '￥0', '外す'],
      ])
    })

    it('should take a service off the bill again, and say one that was removed from the menu meanwhile', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: 0,
        at: '11:00',
        status: 'in_progress',
      })
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/bookings/${id}/checkout`)
      await screen.findByRole('table', { name: '予約の施術' })
      await testApi().query(
        `update services set "deletedAt" = now()
         where name = 'Mens Cut' and "salonId" = (select id from salons where name = $1)`,
        [TOKYO],
      )

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '足す施術' }),
        'Mens Cut（￥4,000）',
      )
      await user.click(screen.getByRole('button', { name: '施術を足す' }))

      // Assert
      expect(
        await screen.findByText(
          'Mens Cutは、メニューから削除されていました。外してください。',
        ),
      ).toBeVisible()

      // Act
      await user.click(
        screen.getByRole('button', { name: 'Mens Cut（1 件目）を外す' }),
      )

      // Assert
      expect(screen.getByText('Mens Cutを外しました。')).toBeVisible()
      expect(screen.getByRole('combobox', { name: '足す施術' })).toHaveFocus()
      await waitFor(() => expect(describedIn('金額')['合計']).toBe('￥5,500'))
      expect(rowsOf('足した施術')).toEqual([
        ['予約にない施術をしたときは、メニューから足してください'],
      ])
    })

    it('should show the sale a booking was billed by meanwhile, in place of entering another', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0003',
        day: 0,
        at: '12:00',
        status: 'completed',
      })
      const user = userEvent.setup()
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/bookings/${id}/checkout`,
      )
      await within(
        await screen.findByRole('region', { name: '金額' }),
      ).findByText(ONE_PAYMENT)
      const saleId = await arrangeSale({
        saleNumber: 'SL-TEST-0003',
        bookingId: id,
        at: '13:00',
      })

      // Act
      await user.click(screen.getByRole('button', { name: '会計を入れる' }))

      // Assert
      await theSale()
      expect(address).toBe(`/salons/${tokyo}/sales/${saleId}`)
      expect(notifications()).toContain(
        'この予約には、その間に会計が入っていました。その売上を表示します。',
      )
      expect(describedIn('売上')['売上番号']).toBe('SL-TEST-0003')
    })

    it('should say why a booking whose visit is still to come takes no checkout, and offer it once the treatment began', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0004',
        day: 0,
        at: '15:00',
        status: 'confirmed',
      })
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/bookings/${id}`)

      // Assert
      expect(
        await within(
          await screen.findByRole('region', { name: '会計' }),
        ).findByText('会計は、施術を始めると入れられます。'),
      ).toBeVisible()
      expect(screen.queryByRole('link', { name: '会計を入れる' })).toBeNull()

      // Act
      await user.click(screen.getByRole('button', { name: '施術を始める' }))

      // Assert
      expect(
        await within(screen.getByRole('region', { name: '会計' })).findByRole(
          'link',
          { name: '会計を入れる' },
        ),
      ).toBeVisible()
    })

    it('should say at the address of its checkout why a booking that was cancelled takes none, and lead back to it', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0005',
        day: 0,
        at: '16:00',
        status: 'cancelled',
      })

      // Act
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/bookings/${id}/checkout`,
      )

      // Assert
      expect(
        await screen.findByText('キャンセルした予約には、会計を入れません。'),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '予約の内容へ' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/bookings/${id}`)
      expect(screen.queryByRole('button', { name: '会計を入れる' })).toBeNull()
    })
  })

  describe('recording the payments of a sale', () => {
    const arrangeUnpaid = async (number: string): Promise<string> => {
      const id = await arrange({
        bookingNumber: `BK-TEST-${number}`,
        day: 0,
        at: '10:00',
        status: 'completed',
      })

      return arrangeSale({
        saleNumber: `SL-TEST-${number}`,
        bookingId: id,
        at: '11:00',
      })
    }

    it('should let a member of the staff take a payment in part and the rest by card, then hand over the receipt', async () => {
      // Arrange
      const saleId = await arrangeUnpaid('0101')
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/sales`, STYLIST)
      await user.click(
        await screen.findByRole('link', { name: 'SL-TEST-0101' }),
      )
      await theSale()
      expect(
        await within(part('レシート')).findByText(
          'レシートは、合計を受け取ってから出せます。',
        ),
      ).toBeVisible()
      expect(
        within(part('レシート')).queryByRole('link', {
          name: 'レシートを出す',
        }),
      ).toBeNull()
      await user.click(screen.getByRole('link', { name: '支払いを記録する' }))
      await heading('支払いを記録する')
      expect(await screen.findByRole('textbox', { name: '金額' })).toHaveValue(
        '5500',
      )
      const methods = screen.getByRole('radiogroup', { name: '支払い方法' })
      expect(within(methods).getAllByRole('radio')).toEqual(
        [
          'Cash',
          'Credit Card（￥1,000から）',
          'Debit Card（￥1,000から）',
          'E-Money (IC Card)（￥20,000まで）',
          'QR Code Payment',
          'Bank Transfer（￥10,000から）',
          'Point Payment（￥100から）',
        ].map((name) => within(methods).getByRole('radio', { name })),
      )
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('radio', { name: 'Cash' }))
      await user.clear(screen.getByRole('textbox', { name: '金額' }))
      await user.type(screen.getByRole('textbox', { name: '金額' }), '3,000')
      await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

      // Assert
      await theSale()
      expect(notifications()).toContain('支払いを記録しました。')
      await within(part('支払い')).findByRole('table', { name: '支払い' })
      expect(describedIn('金額')['未払い残額']).toBe('￥2,500')
      expect(describedIn('売上')['支払い']).toBe('一部受け取り')

      // Act
      await user.click(screen.getByRole('link', { name: '支払いを記録する' }))
      await heading('支払いを記録する')
      await user.click(
        await screen.findByRole('radio', {
          name: 'Credit Card（￥1,000から）',
        }),
      )
      await user.type(
        screen.getByRole('textbox', { name: 'カードの下 4 桁' }),
        '4242',
      )
      await user.type(
        screen.getByRole('textbox', { name: 'カードのブランド' }),
        'VISA',
      )
      await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

      // Assert
      await theSale()
      expect(notifications()).toContain(
        '支払いを記録しました。合計を受け取ったので、レシートを出せます。',
      )
      expect(
        (await storedPaymentsOf(saleId)).map(
          ({ method, amount, cardLastFour, cardBrand }) => [
            method,
            amount,
            cardLastFour,
            cardBrand,
          ],
        ),
      ).toEqual([
        ['cash', 3000, null, null],
        ['credit_card', 2500, '4242', 'VISA'],
      ])
      expect(await within(part('売上')).findByText('支払い済み')).toBeVisible()
      expect(rowsOf('支払い').map((row) => row.slice(2, 5))).toEqual([
        ['Cash', '￥3,000', 'なし'],
        ['Credit Card', '￥2,500', 'VISA 下 4 桁 4242'],
      ])
      expect(
        screen.getByText('この売上は、合計を受け取りました。'),
      ).toBeVisible()
      expect(
        screen.queryByRole('link', { name: '支払いを記録する' }),
      ).toBeNull()

      // Act
      const print = vi.spyOn(window, 'print').mockImplementation(() => {})
      await user.click(screen.getByRole('link', { name: 'レシートを出す' }))
      await heading('レシート')
      const receipt = await screen.findByRole('article', {
        name: TOKYO,
      })
      // The heading that took the focus while the receipt was read keeps it
      expect(await heading('レシート')).toHaveFocus()
      await user.click(screen.getByRole('button', { name: '印刷する' }))

      // Assert
      expect(address).toBe(`/salons/${tokyo}/sales/${saleId}/receipt`)
      expect(print).toHaveBeenCalledOnce()
      expect(within(receipt).getByText('SL-TEST-0101')).toBeVisible()
      expect(
        within(receipt)
          .getAllByRole('term')
          .map((term) => term.textContent)
          .slice(-2),
      ).toEqual([
        'お支払い（Cash）',
        'お支払い（Credit Card VISA 下 4 桁 4242）',
      ])
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('link', { name: '売上の内容へ' }))
      await theSale()
      await user.click(screen.getByRole('link', { name: 'この日の売上へ' }))

      // Assert: the ledger that was read before the payments is read anew
      await heading('売上台帳')
      expect(firstSight[1]).not.toContain('SL-TEST-0101')
      const paid = await screen.findByRole('link', { name: 'SL-TEST-0101' })
      expect(paid.closest('tr')).toHaveTextContent('支払い済み')
    })

    it('should read the sale anew when the payment form opens, and say that it was paid meanwhile', async () => {
      // Arrange: the sale is read, then paid at another register
      const saleId = await arrangeUnpaid('0106')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}`)
      await theSale()
      await paySale(saleId)

      // Act
      await user.click(screen.getByRole('link', { name: '支払いを記録する' }))

      // Assert: the sale that was read before is not shown
      expect(firstSight[1]).not.toContain('未払い残額')
      expect(
        await screen.findByText('この売上は、合計を受け取りました。'),
      ).toBeVisible()
      expect(
        screen.queryByRole('radiogroup', { name: '支払い方法' }),
      ).toBeNull()
      expect(screen.getByRole('link', { name: '売上の内容へ' })).toBeVisible()
    })

    it('should say what a method does not take before sending, and what is more than is left to pay', async () => {
      // Arrange
      const saleId = await arrangeUnpaid('0102')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/payments/new`)
      await heading('支払いを記録する')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(
        await screen.findByRole('radio', {
          name: 'Credit Card（￥1,000から）',
        }),
      )
      await user.clear(screen.getByRole('textbox', { name: '金額' }))
      await user.type(screen.getByRole('textbox', { name: '金額' }), '999')
      await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

      // Assert
      expect(
        screen.getByRole('textbox', { name: '金額' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining(
          'Credit Cardは、1 回 ￥1,000から受け付けます。',
        ),
      )
      expect(screen.getByRole('textbox', { name: '金額' })).toHaveFocus()

      // Act
      await user.clear(screen.getByRole('textbox', { name: '金額' }))
      await user.type(screen.getByRole('textbox', { name: '金額' }), '5501')
      await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

      // Assert
      expect(
        screen.getByRole('textbox', { name: '金額' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining(
          '金額は、未払い残額（￥5,500）以下にしてください。',
        ),
      )
      expect(
        fetched.mock.calls.filter(([input]) =>
          String(input).endsWith('/process'),
        ),
      ).toEqual([])
      expect(await storedPaymentsOf(saleId)).toEqual([])
    })

    it('should say why a sale that was voided meanwhile takes no payment', async () => {
      // Arrange
      const saleId = await arrangeUnpaid('0103')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/payments/new`)
      await user.click(await screen.findByRole('radio', { name: 'Cash' }))
      await voidSale(saleId)

      // Act
      await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

      // Assert
      expect(
        await screen.findByText(
          'この売上は取り消されているため、支払いを記録できません。',
        ),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: '売上の内容へ' })).toBeVisible()
      expect(
        screen.queryByRole('button', { name: '支払いを記録する' }),
      ).toBeNull()
      expect(await storedPaymentsOf(saleId)).toEqual([])
    })

    it('should say that the payment was not recorded when the database refuses it, and keep what was entered', async () => {
      // Arrange
      const saleId = await arrangeUnpaid('0105')
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/payments/new`)
      await user.click(await screen.findByRole('radio', { name: 'Cash' }))
      await user.clear(screen.getByRole('textbox', { name: '金額' }))
      await user.type(screen.getByRole('textbox', { name: '金額' }), '2000')
      await refuse('insert', 'payment_transactions')

      // Act
      await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

      // Assert
      expect(
        await screen.findByText(
          '支払いを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked()
      expect(screen.getByRole('textbox', { name: '金額' })).toHaveValue('2000')
      expect(await storedPaymentsOf(saleId)).toEqual([])
    })

    it('should say that a sale has no receipt before its total is received', async () => {
      // Arrange
      const saleId = await arrangeUnpaid('0104')

      // Act
      await openAt((salon) => `/salons/${salon}/sales/${saleId}/receipt`)

      // Assert
      expect(
        await screen.findByText('レシートは、合計を受け取ってから出せます。'),
      ).toBeVisible()
      expect(screen.queryByRole('button', { name: '印刷する' })).toBeNull()
      expect(screen.getByRole('link', { name: '売上の内容へ' })).toBeVisible()
    })
  })

  describe('the ledger of the sales', () => {
    it('should list the sales of today, narrow them by their payment, say a range that is none, and lead to each', async () => {
      // Arrange
      const first = await arrange({
        bookingNumber: 'BK-TEST-0201',
        day: 0,
        at: '09:00',
        status: 'completed',
      })
      const second = await arrange({
        bookingNumber: 'BK-TEST-0202',
        day: 0,
        at: '10:00',
        status: 'completed',
        service: 'Mens Cut',
      })
      const unpaid = await arrangeSale({
        saleNumber: 'SL-TEST-0201',
        bookingId: first,
        at: '10:05',
      })
      const paid = await arrangeSale({
        saleNumber: 'SL-TEST-0202',
        bookingId: second,
        at: '11:05',
      })
      await paySale(paid)
      const today = await dayFromToday(0)
      const caption = `${dayNameOf(today)}の売上`
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/bookings`)
      await heading('予約台帳')

      // Act
      await user.click(screen.getByRole('link', { name: '売上' }))

      // Assert
      await heading('売上台帳')
      await screen.findByRole('table', { name: caption })
      expect(rowsOf(caption)).toEqual([
        ['SL-TEST-0202', `${dayNameOf(today)} 11:05`, '￥4,000', '支払い済み'],
        ['SL-TEST-0201', `${dayNameOf(today)} 10:05`, '￥5,500', '未払い'],
      ])
      expect(screen.getByRole('link', { name: '売上' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '支払い' }),
        '未払い',
      )
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      await waitFor(() =>
        expect(rowsOf(caption)).toEqual([
          ['SL-TEST-0201', `${dayNameOf(today)} 10:05`, '￥5,500', '未払い'],
        ]),
      )
      const narrowed = `/salons/${tokyo}/sales?from=${today}&to=${today}&paymentStatus=pending`
      expect(address).toBe(narrowed)

      // Act
      await user.clear(screen.getByLabelText('会計日（まで）'))
      await user.type(screen.getByLabelText('会計日（まで）'), '2000-01-01')
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      expect(
        screen.getByLabelText('会計日（まで）'),
      ).toHaveAccessibleDescription(
        expect.stringContaining(
          '終わりの日は、始まりの日と同じか、その後にしてください。',
        ),
      )
      expect(screen.getByLabelText('会計日（まで）')).toHaveFocus()
      expect(address).toBe(narrowed)

      // Act
      await user.click(screen.getByRole('link', { name: 'SL-TEST-0201' }))

      // Assert
      await theSale()
      expect(address).toBe(`/salons/${tokyo}/sales/${unpaid}`)

      // Act
      await user.click(screen.getByRole('link', { name: 'この日の売上へ' }))

      // Assert
      await heading('売上台帳')
      expect(address).toBe(`/salons/${tokyo}/sales?from=${today}&to=${today}`)
      expect(
        (await screen.findAllByRole('link', { name: /^SL-TEST-/ })).map(
          (link) => link.textContent,
        ),
      ).toEqual(['SL-TEST-0202', 'SL-TEST-0201'])
    })

    it('should tell a member of another salon that its sales are not theirs to see', async () => {
      // Act
      await openAt((salon) => `/salons/${salon}/sales`, THERAPIST)

      // Assert
      expect(
        await screen.findByText(
          'このサロンの売上は、見られません。売上を見られるのは、そのサロンのスタッフと、管理者です。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '自分のサロンの予約へ' }),
      ).toBeVisible()
    })
  })
})
