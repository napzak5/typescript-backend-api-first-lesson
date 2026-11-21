import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { dayNameOf } from '../salon-time'
import {
  ADMIN,
  arrange,
  arrangeMany,
  dayFromToday,
  KENJI,
  MANAGER,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  salonIdOf,
  signInAs,
  THERAPIST,
  TOKYO,
  YUKI,
} from './__tests__/arrangements'

const TITLE = 'Beauty Salon Admin'

/** The address the application is at, as the router knows it */
let address = ''

/** Goes back in the history, as the back button of the browser does */
let goBack = (): void => {}

const Address = () => {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  address = `${pathname}${search}`
  goBack = () => {
    void navigate(-1)
  }

  return null
}

/** Renders the application at `path`, with the address of `before` behind it in the history. */
const renderAt = (path: string, before?: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={before === undefined ? [path] : [before, path]}
      >
        <App />
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

const navigationItems = () =>
  within(screen.getByRole('navigation', { name: 'メインメニュー' }))
    .getAllByRole('link')
    .map((link) => [
      link.textContent,
      link.getAttribute('href'),
      link.getAttribute('aria-current'),
    ])

/** The rows of the table of a day, as their cells read. */
const rowsOf = async (day: string): Promise<string[][]> => {
  const table = await screen.findByRole('table', {
    name: `${dayNameOf(day)}の予約`,
  })

  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).getAllByRole('rowheader'),
        ...within(row).getAllByRole('cell'),
      ].map((cell) => cell.textContent ?? ''),
    )
}

describe('the bookings of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('the start', () => {
    it.each<[string, string, string, boolean]>([
      ['the owner', OWNER, TOKYO, true],
      ['a manager', MANAGER, TOKYO, false],
      ['a stylist', STYLIST, TOKYO, false],
      ['a therapist of the other salon', THERAPIST, OSAKA, false],
    ])(
      'should lead %s on to the bookings of their salon',
      async (_case, email, salon, keepsStaffLedger) => {
        // Arrange
        const salonId = await salonIdOf(salon)
        renderAt('/')

        // Act
        await signInAs(email)

        // Assert: on the heading of the screen that shows the salon
        expect(await screen.findByText(salon)).toBeVisible()
        expect(await heading('予約台帳')).toHaveFocus()
        expect(address).toBe(`/salons/${salonId}/bookings`)
        expect(navigationItems()).toEqual([
          ['予約', `/salons/${salonId}/bookings`, 'page'],
          ['売上', `/salons/${salonId}/sales`, null],
          ['顧客', `/salons/${salonId}/customers`, null],
          ['レビュー', `/salons/${salonId}/reviews`, null],
          ['ファイル', `/salons/${salonId}/files`, null],
          ['施術記録', `/salons/${salonId}/treatments`, null],
          ['シフト', `/salons/${salonId}/shifts`, null],
          ['メニュー', `/salons/${salonId}/menu`, null],
          ['商品', `/salons/${salonId}/products`, null],
          ['在庫', `/salons/${salonId}/inventory`, null],
          ['発注', `/salons/${salonId}/purchase-orders`, null],
          // The staff ledger is kept by the owner of the salon alone
          ...(keepsStaffLedger
            ? [['スタッフ', `/salons/${salonId}/staff`, null]]
            : []),
          ['設定', `/salons/${salonId}/settings`, null],
          ['プロフィール', '/account/profile', null],
        ])
      },
    )

    it('should let an administrator choose a salon, by a keyword', async () => {
      // Arrange
      const user = userEvent.setup()
      const osaka = await salonIdOf(OSAKA)
      const { container } = renderAt('/')
      await signInAs(ADMIN)
      expect(await heading('サロンを選ぶ')).toHaveFocus()
      const all = await screen.findByRole('table', { name: 'サロン' })
      expect(
        within(all)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(expect.arrayContaining([TOKYO, OSAKA]))
      expect(await findAccessibilityViolations(container)).toEqual([])

      // Act
      await user.type(
        screen.getByRole('searchbox', { name: 'キーワード' }),
        'Osaka{Enter}',
      )

      // Assert
      await waitFor(() =>
        expect(
          within(screen.getByRole('table', { name: 'サロン' }))
            .getAllByRole('link')
            .map((link) => link.textContent),
        ).toEqual([OSAKA]),
      )
      expect(address).toBe('/?keyword=Osaka')

      // Act
      await user.click(screen.getByRole('link', { name: OSAKA }))

      // Assert
      expect(await screen.findByText(OSAKA)).toBeVisible()
      expect(await heading('予約台帳')).toHaveFocus()
      expect(address).toBe(`/salons/${osaka}/bookings`)
      expect(navigationItems()).toEqual([
        ['サロンを選ぶ', '/', null],
        ['予約', `/salons/${osaka}/bookings`, 'page'],
        ['売上', `/salons/${osaka}/sales`, null],
        ['顧客', `/salons/${osaka}/customers`, null],
        ['レビュー', `/salons/${osaka}/reviews`, null],
        ['ファイル', `/salons/${osaka}/files`, null],
        ['施術記録', `/salons/${osaka}/treatments`, null],
        ['シフト', `/salons/${osaka}/shifts`, null],
        ['メニュー', `/salons/${osaka}/menu`, null],
        ['商品', `/salons/${osaka}/products`, null],
        ['在庫', `/salons/${osaka}/inventory`, null],
        ['発注', `/salons/${osaka}/purchase-orders`, null],
        ['スタッフ', `/salons/${osaka}/staff`, null],
        ['設定', `/salons/${osaka}/settings`, null],
      ])
    })

    it('should tell an account of a salon role that no salon reaches', async () => {
      // Arrange: the link to the member of the staff was undone
      await testApi().query(
        `update users set "staffId" = null where email = $1`,
        [STYLIST],
      )
      renderAt('/')

      // Act
      await signInAs(STYLIST)

      // Assert
      expect(await heading('どのサロンにも属していません')).toHaveFocus()
      expect(address).toBe('/')
    })

    it('should tell a member of the staff of another salon that its bookings are not theirs to see', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      const osaka = await salonIdOf(OSAKA)
      renderAt(`/salons/${osaka}/bookings`)
      await signInAs(STYLIST)

      // Act
      const notice = await screen.findByText(
        'このサロンの予約は、見られません。予約を見られるのは、そのサロンのスタッフと、管理者です。',
      )
      await user.click(
        screen.getByRole('link', { name: '自分のサロンの予約へ' }),
      )

      // Assert
      expect(notice).not.toBeInTheDocument()
      await waitFor(() => expect(address).toBe(`/salons/${tokyo}/bookings`))
    })

    it('should say that a salon of an address is not there', async () => {
      // Arrange
      renderAt('/salons/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01/bookings')

      // Act
      await signInAs(OWNER)

      // Assert
      expect(await heading('サロンが見つかりません')).toHaveFocus()
    })
  })

  describe('the list of a day', () => {
    it('should show the bookings of today at the salon, in the order they begin, with their names', async () => {
      // Arrange
      const tokyo = await salonIdOf(TOKYO)
      await arrange({
        bookingNumber: 'BK-TEST-0003',
        day: 0,
        at: '15:00',
        minutes: 120,
        status: 'confirmed',
        customer: YUKI.email,
        staffCode: 'STF002',
        service: 'Full Color',
      })
      await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 0,
        at: '10:00',
        customer: KENJI.email,
      })
      await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: 0,
        at: '12:30',
        minutes: 45,
        status: 'cancelled',
        customer: SAKURA.email,
        staffCode: 'STF004',
        service: 'Mens Cut',
      })
      // A booking of the other salon, and one of the day after, are not of the list
      await arrange({
        bookingNumber: 'BK-TEST-0009',
        day: 0,
        at: '11:00',
        salon: OSAKA,
        staffCode: 'STF003',
        service: 'Signature Cut',
      })
      await arrange({ bookingNumber: 'BK-TEST-0010', day: 1, at: '11:00' })
      const today = await dayFromToday(0)
      const { container } = renderAt(`/salons/${tokyo}/bookings`)

      // Act
      await signInAs(OWNER)

      // Assert
      expect(await rowsOf(today)).toEqual([
        [
          '10:00〜11:00',
          KENJI.name,
          'Hiroshi Tanaka',
          'Ladies Cut',
          '確定待ち',
          'BK-TEST-0001',
        ],
        [
          '12:30〜13:15',
          SAKURA.name,
          'Yui Watanabe',
          'Mens Cut',
          'キャンセル',
          'BK-TEST-0002',
        ],
        [
          '15:00〜17:00',
          YUKI.name,
          'Mika Suzuki',
          'Full Color',
          '確定',
          'BK-TEST-0003',
        ],
      ])
      expect(screen.getByText('3 件')).toBeVisible()
      expect(screen.getByLabelText('日付')).toHaveValue(today)
      expect(await findAccessibilityViolations(container)).toEqual([])
    })

    it('should name a customer who was removed as such, and lead to the booking all the same', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      const removed = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: 0,
        at: '11:00',
        customer: KENJI.email,
        staffCode: 'STF002',
      })
      await testApi().query(
        `update customers set "deletedAt" = now() where email = $1`,
        [KENJI.email],
      )
      const today = await dayFromToday(0)
      renderAt(`/salons/${tokyo}/bookings`)
      await signInAs(MANAGER)

      // Act
      const rows = await rowsOf(today)
      await user.click(screen.getByRole('link', { name: '削除された顧客' }))

      // Assert
      expect(rows.map((row) => row[1])).toEqual([YUKI.name, '削除された顧客'])
      expect(
        within(await screen.findByRole('region', { name: '予約' })).getByText(
          '削除された顧客',
        ),
      ).toBeVisible()
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address).toBe(`/salons/${tokyo}/bookings/${removed}`)
    })

    it('should narrow the list by the state and by the member of the staff, in the address', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: 0,
        at: '11:00',
        status: 'confirmed',
        staffCode: 'STF002',
        customer: KENJI.email,
      })
      await arrange({
        bookingNumber: 'BK-TEST-0003',
        day: 0,
        at: '13:00',
        status: 'confirmed',
        customer: SAKURA.email,
      })
      const today = await dayFromToday(0)
      renderAt(`/salons/${tokyo}/bookings`)
      await signInAs(STYLIST)
      await rowsOf(today)

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '状態' }),
        '確定',
      )
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      await waitFor(async () =>
        expect((await rowsOf(today)).map((row) => row.at(-1))).toEqual([
          'BK-TEST-0002',
          'BK-TEST-0003',
        ]),
      )
      expect(address).toBe(
        `/salons/${tokyo}/bookings?date=${today}&status=confirmed`,
      )

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '担当' }),
        'Hiroshi Tanaka',
      )
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      await waitFor(async () =>
        expect((await rowsOf(today)).map((row) => row.at(-1))).toEqual([
          'BK-TEST-0003',
        ]),
      )
      expect(address).toMatch(/&status=confirmed&staffId=[0-9a-f-]{36}$/)

      // Act
      await user.click(screen.getByRole('link', { name: '条件をなくす' }))

      // Assert
      await waitFor(async () => expect(await rowsOf(today)).toHaveLength(3))
      expect(address).toBe(`/salons/${tokyo}/bookings?date=${today}`)
    })

    it('should put the conditions in place of the address, so that the way back leaves the list', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      const today = await dayFromToday(0)
      renderAt(`/salons/${tokyo}/bookings`, '/account/security')
      await signInAs(OWNER)
      await rowsOf(today)
      await user.selectOptions(
        screen.getByRole('combobox', { name: '状態' }),
        '確定',
      )
      await user.click(screen.getByRole('button', { name: '表示する' }))
      await waitFor(() =>
        expect(address).toBe(
          `/salons/${tokyo}/bookings?date=${today}&status=confirmed`,
        ),
      )

      // Act
      act(() => goBack())

      // Assert
      await waitFor(() => expect(address).toBe('/account/security'))
    })

    it('should read the list again when the same conditions are sent again', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      const today = await dayFromToday(0)
      renderAt(`/salons/${tokyo}/bookings`)
      await signInAs(OWNER)
      await rowsOf(today)
      await arrange({ bookingNumber: 'BK-TEST-0002', day: 0, at: '11:00' })

      // Act
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      await waitFor(async () =>
        expect((await rowsOf(today)).map((row) => row.at(-1))).toEqual([
          'BK-TEST-0001',
          'BK-TEST-0002',
        ]),
      )
      expect(address).toBe(`/salons/${tokyo}/bookings`)
    })

    it('should go from day to day, and back to today', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      await arrange({ bookingNumber: 'BK-TEST-0002', day: 1, at: '14:00' })
      const [today, tomorrow, yesterday] = await Promise.all([
        dayFromToday(0),
        dayFromToday(1),
        dayFromToday(-1),
      ])
      renderAt(`/salons/${tokyo}/bookings`)
      await signInAs(OWNER)
      await rowsOf(today)
      const days = () =>
        within(screen.getByRole('navigation', { name: '予約の日' }))

      // Act
      await user.click(days().getByRole('link', { name: '次の日' }))

      // Assert
      expect((await rowsOf(tomorrow)).map((row) => row.at(-1))).toEqual([
        'BK-TEST-0002',
      ])
      expect(address).toBe(`/salons/${tokyo}/bookings?date=${tomorrow}`)

      // Act
      await user.click(days().getByRole('link', { name: '前の日' }))
      await user.click(days().getByRole('link', { name: '前の日' }))

      // Assert: the seed data has a booking yesterday that nobody came to
      expect(await rowsOf(yesterday)).toEqual([
        expect.arrayContaining(['無断キャンセル']),
      ])
      expect(address).toBe(`/salons/${tokyo}/bookings?date=${yesterday}`)

      // Act
      await user.click(days().getByRole('link', { name: '今日' }))

      // Assert
      expect((await rowsOf(today)).map((row) => row.at(-1))).toEqual([
        'BK-TEST-0001',
      ])
    })

    it('should say that a day has no bookings', async () => {
      // Arrange
      const tokyo = await salonIdOf(TOKYO)
      const later = await dayFromToday(30)
      renderAt(`/salons/${tokyo}/bookings?date=${later}`)

      // Act
      await signInAs(OWNER)

      // Assert
      expect(
        await screen.findByText(`${dayNameOf(later)}の予約はありません`),
      ).toBeVisible()
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('should say that no booking of a day meets the conditions', async () => {
      // Arrange
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 30, at: '10:00' })
      const later = await dayFromToday(30)
      renderAt(`/salons/${tokyo}/bookings?date=${later}&status=completed`)

      // Act
      await signInAs(OWNER)

      // Assert
      expect(
        await screen.findByText(
          `${dayNameOf(later)}の予約のうち、条件に合うものはありません`,
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '条件をなくす' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/bookings?date=${later}`)
    })

    it('should show a day that was chosen in the address, and today for one that is no day', async () => {
      // Arrange
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 9, at: '10:00' })
      await arrange({ bookingNumber: 'BK-TEST-0002', day: 0, at: '10:00' })
      const [today, later] = await Promise.all([
        dayFromToday(0),
        dayFromToday(9),
      ])
      const { unmount } = renderAt(`/salons/${tokyo}/bookings?date=${later}`)
      await signInAs(OWNER)

      // Act, Assert
      expect((await rowsOf(later)).map((row) => row.at(-1))).toEqual([
        'BK-TEST-0001',
      ])
      unmount()
      renderAt(`/salons/${tokyo}/bookings?date=2026-02-30`)
      expect((await rowsOf(today)).map((row) => row.at(-1))).toEqual([
        'BK-TEST-0002',
      ])
    })

    it('should show fifty bookings at a time, and the next ones with the focus on the first of them', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrangeMany(20, 55)
      const day = await dayFromToday(20)
      renderAt(`/salons/${tokyo}/bookings?date=${day}`)
      await signInAs(OWNER)
      expect(await rowsOf(day)).toHaveLength(50)
      expect(screen.getByText('55 件（50 件を表示しています）')).toBeVisible()

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      await waitFor(async () => expect(await rowsOf(day)).toHaveLength(55))
      expect((await rowsOf(day)).map((row) => row.at(-1))).toEqual(
        Array.from(
          { length: 55 },
          (_, index) => `BK-MANY-${String(index + 1).padStart(4, '0')}`,
        ),
      )
      const table = screen.getByRole('table', {
        name: `${dayNameOf(day)}の予約`,
      })
      expect(within(table).getAllByRole('link').at(50)).toHaveFocus()
      expect(screen.getByText('55 件')).toBeVisible()
      expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
    })

    it('should show an administrator the bookings of any salon', async () => {
      // Arrange
      const osaka = await salonIdOf(OSAKA)
      await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 0,
        at: '11:00',
        salon: OSAKA,
        staffCode: 'STF003',
        service: 'Signature Cut',
        minutes: 75,
      })
      const today = await dayFromToday(0)
      renderAt(`/salons/${osaka}/bookings`)

      // Act
      await signInAs(ADMIN)

      // Assert
      expect(await rowsOf(today)).toEqual([
        [
          '11:00〜12:15',
          YUKI.name,
          'Takeshi Ito',
          'Signature Cut',
          '確定待ち',
          'BK-TEST-0001',
        ],
      ])
    })
  })
})
