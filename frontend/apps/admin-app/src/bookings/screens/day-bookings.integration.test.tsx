import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  giveBack,
  salonIdOf,
  signInAs,
  takeAway,
  testApi,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  goBack,
  heading,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  THERAPIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD, renderAt } from '../../__tests__/screens'
import {
  customerIdOf,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import { arrange, arrangeMany } from '../__tests__/arrangements'

const navigationItems = () =>
  within(screen.getByRole('navigation', { name: 'メインメニュー' }))
    .getAllByRole('link')
    .map((link) => [
      link.textContent,
      link.getAttribute('href'),
      link.getAttribute('aria-current'),
    ])

/** The rows of the table of a day, once the table is there. */
const rowsOfDay = async (day: string): Promise<string[][]> =>
  rowsOf(
    await screen.findByRole('table', {
      name: `${dayNameOf(day).ja}の予約`,
    }),
  )

/** Opens the bookings of a day of the Tokyo salon, signed in as `email`. */
const openDay = async (days: number, email = OWNER): Promise<string> => {
  const day = await dayFromToday(days)
  renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings?date=${day}`)
  await signInAs(email)

  return day
}

describe('the bookings of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
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
        expect(address()).toBe(`/salons/${salonId}/bookings`)
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
      await signInAs(OPERATOR)
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
      expect(address()).toBe('/?keyword=Osaka')

      // Act
      await user.click(screen.getByRole('link', { name: OSAKA }))

      // Assert
      expect(await screen.findByText(OSAKA)).toBeVisible()
      expect(await heading('予約台帳')).toHaveFocus()
      expect(address()).toBe(`/salons/${osaka}/bookings`)
      expect(navigationItems()).toEqual([
        ['サロンを選ぶ', '/', null],
        ['運用', '/operations', null],
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
      expect(address()).toBe('/')
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
      await waitFor(() => expect(address()).toBe(`/salons/${tokyo}/bookings`))
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
      expect(await rowsOfDay(today)).toEqual([
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
      const rows = await rowsOfDay(today)
      await user.click(screen.getByRole('link', { name: '削除された顧客' }))

      // Assert
      expect(rows.map((row) => row[1])).toEqual([YUKI.name, '削除された顧客'])
      expect(
        within(await screen.findByRole('region', { name: '予約' })).getByText(
          '削除された顧客',
        ),
      ).toBeVisible()
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address()).toBe(`/salons/${tokyo}/bookings/${removed}`)
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
      await rowsOfDay(today)

      // Act
      await user.selectOptions(
        screen.getByRole('combobox', { name: '状態' }),
        '確定',
      )
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      await waitFor(async () =>
        expect((await rowsOfDay(today)).map((row) => row.at(-1))).toEqual([
          'BK-TEST-0002',
          'BK-TEST-0003',
        ]),
      )
      expect(address()).toBe(
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
        expect((await rowsOfDay(today)).map((row) => row.at(-1))).toEqual([
          'BK-TEST-0003',
        ]),
      )
      expect(address()).toMatch(/&status=confirmed&staffId=[0-9a-f-]{36}$/)

      // Act
      await user.click(screen.getByRole('link', { name: '条件を外す' }))

      // Assert
      await waitFor(async () => expect(await rowsOfDay(today)).toHaveLength(3))
      expect(address()).toBe(`/salons/${tokyo}/bookings?date=${today}`)
    })

    it('should put the conditions in place of the address, so that the way back leaves the list', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      const today = await dayFromToday(0)
      renderAt(`/salons/${tokyo}/bookings`, {
        before: ['/account/security'],
      })
      await signInAs(OWNER)
      await rowsOfDay(today)
      await user.selectOptions(
        screen.getByRole('combobox', { name: '状態' }),
        '確定',
      )
      await user.click(screen.getByRole('button', { name: '表示する' }))
      await waitFor(() =>
        expect(address()).toBe(
          `/salons/${tokyo}/bookings?date=${today}&status=confirmed`,
        ),
      )

      // Act
      act(() => goBack())

      // Assert
      await waitFor(() => expect(address()).toBe('/account/security'))
    })

    it('should read the list again when the same conditions are sent again', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      const today = await dayFromToday(0)
      renderAt(`/salons/${tokyo}/bookings`)
      await signInAs(OWNER)
      await rowsOfDay(today)
      await arrange({ bookingNumber: 'BK-TEST-0002', day: 0, at: '11:00' })

      // Act
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      await waitFor(async () =>
        expect((await rowsOfDay(today)).map((row) => row.at(-1))).toEqual([
          'BK-TEST-0001',
          'BK-TEST-0002',
        ]),
      )
      expect(address()).toBe(`/salons/${tokyo}/bookings`)
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
      await rowsOfDay(today)
      const days = () =>
        within(screen.getByRole('navigation', { name: '予約の日' }))

      // Act
      await user.click(days().getByRole('link', { name: '次の日' }))

      // Assert
      expect((await rowsOfDay(tomorrow)).map((row) => row.at(-1))).toEqual([
        'BK-TEST-0002',
      ])
      expect(address()).toBe(`/salons/${tokyo}/bookings?date=${tomorrow}`)

      // Act
      await user.click(days().getByRole('link', { name: '前の日' }))
      await user.click(days().getByRole('link', { name: '前の日' }))

      // Assert: the seed data has a booking yesterday that nobody came to
      expect(await rowsOfDay(yesterday)).toEqual([
        expect.arrayContaining(['無断キャンセル']),
      ])
      expect(address()).toBe(`/salons/${tokyo}/bookings?date=${yesterday}`)

      // Act
      await user.click(days().getByRole('link', { name: '今日' }))

      // Assert
      expect((await rowsOfDay(today)).map((row) => row.at(-1))).toEqual([
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
        await screen.findByText(`${dayNameOf(later).ja}の予約はありません`),
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
          `${dayNameOf(later).ja}の予約のうち、条件に合うものはありません`,
        ),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
        'href',
        `/salons/${tokyo}/bookings?date=${later}`,
      )
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
      expect((await rowsOfDay(later)).map((row) => row.at(-1))).toEqual([
        'BK-TEST-0001',
      ])
      unmount()
      renderAt(`/salons/${tokyo}/bookings?date=2026-02-30`)
      expect((await rowsOfDay(today)).map((row) => row.at(-1))).toEqual([
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
      expect(await rowsOfDay(day)).toHaveLength(50)
      expect(screen.getByText('55 件（50 件を表示しています）')).toBeVisible()

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      await waitFor(async () => expect(await rowsOfDay(day)).toHaveLength(55))
      expect((await rowsOfDay(day)).map((row) => row.at(-1))).toEqual(
        Array.from(
          { length: 55 },
          (_, index) => `BK-MANY-${String(index + 1).padStart(4, '0')}`,
        ),
      )
      const table = screen.getByRole('table', {
        name: `${dayNameOf(day).ja}の予約`,
      })
      expect(within(table).getAllByRole('link').at(50)).toHaveFocus()
      expect(screen.getByText('55 件')).toBeVisible()
      expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
    })

    it('should say that the staff and the menu could not be read, and show the list when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      await takeAway('services')
      const day = await openDay(0)
      expect(
        await screen.findByText(
          'スタッフとメニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('services')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect((await rowsOfDay(day))[0]?.[3]).toBe('Ladies Cut')
    })

    it('should say that the bookings could not be read, and show them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      await takeAway('bookings')
      const day = await openDay(0)
      expect(
        await screen.findByText(
          '予約を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('bookings')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect((await rowsOfDay(day)).map((row) => row.at(-1))).toEqual([
        'BK-TEST-0001',
      ])
    })

    it('should say that the customers of the bookings could not be read, and show the list when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrange({ bookingNumber: 'BK-TEST-0001', day: 0, at: '10:00' })
      const restore = await unreadable(
        'customers',
        'createdAt',
        await customerIdOf(YUKI.email),
      )
      const day = await openDay(0)
      expect(
        await screen.findByText(
          '予約のお客様を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await restore()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect((await rowsOfDay(day)).map((row) => row[1])).toEqual([YUKI.name])
    })

    it('should keep the bookings whose customers it has when those of the next page do not come, and add them when asked again', async () => {
      // Arrange: the fifty of the first page are Kenji's, the one after them Yuki's
      const user = userEvent.setup()
      await arrangeMany(20, 50)
      await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 20,
        at: '18:00',
      })
      const restore = await unreadable(
        'customers',
        'createdAt',
        await customerIdOf(YUKI.email),
      )
      const day = await openDay(20)
      expect(await rowsOfDay(day)).toHaveLength(50)
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(REST_UNREAD)
      expect(await rowsOfDay(day)).toHaveLength(50)
      await restore()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await waitFor(async () => expect(await rowsOfDay(day)).toHaveLength(51))
      expect((await rowsOfDay(day)).at(-1)?.[1]).toBe(YUKI.name)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should keep the bookings it has when the next ones do not come, and add them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeMany(20, 55)
      const day = await openDay(20)
      expect(await rowsOfDay(day)).toHaveLength(50)
      await takeAway('bookings')
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(REST_UNREAD)
      expect(await rowsOfDay(day)).toHaveLength(50)
      await giveBack('bookings')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await waitFor(async () => expect(await rowsOfDay(day)).toHaveLength(55))
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should end the list where the account left its salon, and say so when the list is read again', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeMany(20, 55)
      const day = await openDay(20, STYLIST)
      expect(await rowsOfDay(day)).toHaveLength(50)
      whenAskedFor('GET /bookings', () =>
        staffRemovedMeanwhile('Hiroshi Tanaka'),
      )

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(REST_UNREAD)
      expect(await rowsOfDay(day)).toHaveLength(50)

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect(
        await screen.findByText(
          'このサロンの予約は、見られません。予約を見られるのは、そのサロンのスタッフと、管理者です。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('table')).toBeNull()
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
      await signInAs(OPERATOR)

      // Assert
      expect(await rowsOfDay(today)).toEqual([
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

describe('the bookings of a salon on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should list the bookings of a day with their states, and narrow them, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
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
    const today = await dayFromToday(0)
    const { container } = await openAs(`/salons/${tokyo}/bookings`, OWNER, 'en')
    expect(await heading('Booking ledger')).toHaveFocus()
    const table = await screen.findByRole('table', {
      name: `Bookings on ${dayNameOf(today).en}`,
    })
    expect(rowsOf(table)).toEqual([
      [
        '10:00–11:00',
        KENJI.name,
        'Hiroshi Tanaka',
        'Ladies Cut',
        'Awaiting confirmation',
        'BK-TEST-0001',
      ],
      [
        '12:30–13:15',
        SAKURA.name,
        'Yui Watanabe',
        'Mens Cut',
        'Cancelled',
        'BK-TEST-0002',
      ],
    ])
    expect(screen.getByText('2 items')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Make a booking' }),
    ).toHaveAttribute('href', `/salons/${tokyo}/bookings/new?date=${today}`)
    expect(await findAccessibilityViolations(container)).toEqual([])

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Status' }),
      'Cancelled',
    )
    await user.click(screen.getByRole('button', { name: 'Show' }))

    // Assert
    await waitFor(() =>
      expect(
        rowsOf(
          screen.getByRole('table', {
            name: `Bookings on ${dayNameOf(today).en}`,
          }),
        ),
      ).toEqual([
        [
          '12:30–13:15',
          SAKURA.name,
          'Yui Watanabe',
          'Mens Cut',
          'Cancelled',
          'BK-TEST-0002',
        ],
      ]),
    )
  })

  it('should say that a day has no bookings, and that none meets the conditions, in English', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    await arrange({ bookingNumber: 'BK-TEST-0001', day: 30, at: '10:00' })
    const later = await dayFromToday(30)
    const empty = await dayFromToday(31)

    // Act
    await openAs(
      `/salons/${tokyo}/bookings?date=${later}&status=completed`,
      OWNER,
      'en',
    )

    // Assert
    expect(
      await screen.findByText(
        `No bookings on ${dayNameOf(later).en} match the conditions`,
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      `/salons/${tokyo}/bookings?date=${later}`,
    )

    // Act: the day after, whose bookings no condition narrows
    renderAt(`/salons/${tokyo}/bookings?date=${empty}`)

    // Assert
    expect(
      await screen.findByText(`No bookings on ${dayNameOf(empty).en}`),
    ).toBeVisible()
  })
})
