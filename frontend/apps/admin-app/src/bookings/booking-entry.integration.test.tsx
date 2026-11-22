import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'
import * as z from 'zod'
import { App } from '../App'
import {
  arrange,
  dayFromToday,
  KENJI,
  OWNER,
  refuse,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
  YUKI,
} from './__tests__/arrangements'

const TAKEN =
  '担当の時間が、ほかの予約と重なっているため、予約を入れられませんでした。明細ごとに、担当の空きを確かめ直しました。'

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

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const field = (name: string): HTMLElement => screen.getByLabelText(name)

/** What the application says in its notifications. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((text) => text !== '')

/** The terms of the record of the booking, each with what it says. */
const recordTerms = (): [string, string][] =>
  within(screen.getByRole('region', { name: '予約' }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** The line of the form of a number, counted from 1. */
const line = (number: number): HTMLElement => {
  const item = combobox(`明細 ${number} のメニュー`).closest('li')
  if (item === null) {
    throw new Error(`The line ${number} is not there`)
  }

  return item
}

const storedSchema = z.tuple([
  z.object({
    customer: z.string(),
    staffCode: z.string(),
    status: z.string(),
    bookingDate: z.string(),
    source: z.string().nullable(),
    depositAmount: z.number().nullable(),
    customerRequest: z.string().nullable(),
    internalNotes: z.string().nullable(),
  }),
])

/** A booking as it is stored. */
const storedBooking = async (id: string) =>
  storedSchema.parse(
    await testApi().query(
      `select customers.email as customer, staff."staffCode", bookings.status::text,
              to_char(bookings."bookingDate", 'YYYY-MM-DD') as "bookingDate", bookings.source,
              bookings."depositAmount", bookings."customerRequest", bookings."internalNotes"
       from bookings
       join customers on customers.id = bookings."customerId"
       join staff on staff.id = bookings."staffId"
       where bookings.id = $1`,
      [id],
    ),
  )[0]

const linesSchema = z.array(
  z.object({
    service: z.string(),
    staffCode: z.string().nullable(),
    startTime: z.string(),
    notes: z.string().nullable(),
  }),
)

/** The lines of a booking as they are stored, in their order; the beginnings on Tokyo's clock. */
const storedLines = async (id: string) =>
  linesSchema.parse(
    await testApi().query(
      `select services.name as service, staff."staffCode",
              to_char(booking_services."startTime" at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI') as "startTime",
              booking_services.notes
       from booking_services
       join services on services.id = booking_services."serviceId"
       left join staff on staff.id = booking_services."staffId"
       where booking_services."bookingId" = $1
       order by booking_services."sortOrder"`,
      [id],
    ),
  )

const countSchema = z.tuple([z.object({ count: z.number() })])

const bookingCount = async (): Promise<number> =>
  countSchema.parse(
    await testApi().query('select count(*)::int as count from bookings'),
  )[0].count

/** The days from today the tests put their bookings on: no seeded booking is then */
const DAY = 5

/** Opens the entry from the bookings of the day, and finds the customers that have a keyword. */
const toTheCustomers = async (
  user: ReturnType<typeof userEvent.setup>,
  keyword: string,
  email = OWNER,
) => {
  const tokyo = await salonIdOf(TOKYO)
  const date = await dayFromToday(DAY)
  renderAt(`/salons/${tokyo}/bookings?date=${date}`)
  await signInAs(email)
  await user.click(await screen.findByRole('link', { name: '予約を入れる' }))
  await user.type(
    await screen.findByRole('searchbox', { name: 'キーワード' }),
    `${keyword}{Enter}`,
  )

  return { tokyo, date }
}

/** Opens the form of a booking for Yamamoto Kenji, from the bookings of the day. */
const toTheForm = async (
  user: ReturnType<typeof userEvent.setup>,
  email = OWNER,
) => {
  const opened = await toTheCustomers(user, 'yamamoto', email)
  await user.click(await screen.findByRole('link', { name: KENJI.name }))
  await screen.findByRole('combobox', { name: '担当スタッフ' })

  return opened
}

/** Fills a line in: the service, the member, the time it begins. */
const fillLine = async (
  user: ReturnType<typeof userEvent.setup>,
  number: number,
  { service, member, at }: { service: string; member: string; at: string },
) => {
  await user.selectOptions(combobox(`明細 ${number} のメニュー`), service)
  await user.selectOptions(combobox(`明細 ${number} の担当`), member)
  await user.type(field(`明細 ${number} の開始`), at)
}

/** The ID of the booking whose page the application shows. */
const shownBookingId = (): string => address.split('/').at(-1) ?? ''

describe('the bookings a salon puts in, changes and removes, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('choosing the customer', () => {
    it('should find customers by a name and by the digits of a phone number, a search at a time in the address', async () => {
      // Arrange
      const user = userEvent.setup()

      // Act
      const { tokyo, date } = await toTheCustomers(user, 'yamamoto')

      // Assert
      expect(
        await screen.findByRole('link', { name: KENJI.name }),
      ).toBeVisible()
      expect(address).toBe(
        `/salons/${tokyo}/bookings/new?date=${date}&search=yamamoto`,
      )
      const row = screen.getByRole('link', { name: KENJI.name }).closest('tr')
      expect(row).toHaveTextContent('ヤマモト ケンジ')
      expect(row).toHaveTextContent('+81-80-9876-5432')
      expect(row).toHaveTextContent(KENJI.email)

      // Act: the digits, without the way they are written
      const keyword = screen.getByRole('searchbox', { name: 'キーワード' })
      await user.clear(keyword)
      await user.type(keyword, '98765432{Enter}')

      // Assert
      await waitFor(() =>
        expect(address).toBe(
          `/salons/${tokyo}/bookings/new?date=${date}&search=98765432`,
        ),
      )
      expect(
        await screen.findByRole('link', { name: KENJI.name }),
      ).toBeVisible()
      expect(screen.getByText('1 人')).toBeVisible()
    })

    it('should say that no customer has the keyword, and lead to the registration of a customer', async () => {
      // Arrange
      const user = userEvent.setup()

      // Act
      const { tokyo } = await toTheCustomers(user, 'nobody-has-this')

      // Assert
      expect(
        await screen.findByText('キーワードに合うお客様が見つかりませんでした'),
      ).toBeVisible()
      expect(
        screen.getByText(
          'キーワードを変えて、もう一度お探しください。台帳にないお客様は、先に台帳に登録してください。登録したお客様の台帳から、予約を入れられます。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'お客様を登録する' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/customers/new`)
    })

    it('should show the customer that was chosen above the form, and lead back to the customers that were found', async () => {
      // Arrange
      const user = userEvent.setup()
      const { tokyo, date } = await toTheCustomers(user, 'yamamoto')
      const customerId = z
        .tuple([z.object({ id: z.string() })])
        .parse(
          await testApi().query(
            'select id::text from customers where email = $1',
            [KENJI.email],
          ),
        )[0].id

      // Act
      await user.click(await screen.findByRole('link', { name: KENJI.name }))

      // Assert: the link that was followed is gone with its step
      const chosen = await screen.findByRole('region', { name: 'お客様' })
      expect(await heading('予約を入れる')).toHaveFocus()
      expect(address).toBe(
        `/salons/${tokyo}/bookings/new?date=${date}&search=yamamoto&customerId=${customerId}`,
      )
      expect(
        within(chosen)
          .getAllByRole('term')
          .map((term) => [
            term.textContent,
            term.nextElementSibling?.textContent,
          ]),
      ).toEqual([
        ['お名前', KENJI.name],
        ['フリガナ', 'ヤマモト ケンジ'],
        ['電話番号', '+81-80-9876-5432'],
        ['メールアドレス', KENJI.email],
      ])

      // Act
      await user.click(
        within(chosen).getByRole('link', { name: 'お客様を選び直す' }),
      )

      // Assert
      expect(
        await screen.findByRole('link', { name: KENJI.name }),
      ).toBeVisible()
      expect(await heading('予約を入れる')).toHaveFocus()
      expect(screen.getByRole('searchbox', { name: 'キーワード' })).toHaveValue(
        'yamamoto',
      )
    })
  })

  describe('putting a booking in', () => {
    it('should put a booking of two lines in as the form has it, and show it on its page', async () => {
      // Arrange
      const user = userEvent.setup()
      const { tokyo, date } = await toTheForm(user)
      await user.selectOptions(combobox('担当スタッフ'), 'Mika Suzuki')
      await fillLine(user, 1, {
        service: 'Ladies Cut（60 分）',
        member: '予約の担当と同じ',
        at: '10:00',
      })
      await user.type(field('明細 1 のメモ'), '前髪は短めに')
      await user.click(screen.getByRole('button', { name: '明細を追加する' }))
      const added = combobox('明細 2 のメニュー')
      await fillLine(user, 2, {
        service: 'Deep Conditioning Treatment（30 分）',
        member: '決めない',
        at: '11:00',
      })
      await user.selectOptions(combobox('受付の経路'), '電話')
      await user.type(field('予約金'), '１，０００')
      await user.type(field('お客様の要望'), '肩につかない長さで')
      await user.type(field('サロン内のメモ'), '初めてのお客様')
      expect(await findAccessibilityViolations(document.body)).toEqual([])
      const before = await bookingCount()

      // Act
      await user.click(screen.getByRole('button', { name: '予約を入れる' }))

      // Assert: on the page of the booking, as the API answered it
      expect(await heading('予約の内容')).toHaveFocus()
      expect(notifications()).toContain('予約を入れました。')
      const id = shownBookingId()
      expect(address).toBe(`/salons/${tokyo}/bookings/${id}`)
      expect(recordTerms()).toEqual(
        expect.arrayContaining([
          ['お客様', KENJI.name],
          ['担当', 'Mika Suzuki'],
          ['時刻', '10:00〜11:30'],
          ['お客様の要望', '肩につかない長さで'],
          ['サロン内のメモ', '初めてのお客様'],
          ['受付の経路', '電話'],
          ['予約金', '￥1,000'],
        ]),
      )
      expect(await bookingCount()).toBe(before + 1)
      expect(await storedBooking(id)).toEqual({
        customer: KENJI.email,
        staffCode: 'STF002',
        status: 'pending',
        bookingDate: date,
        source: 'phone',
        depositAmount: 1000,
        customerRequest: '肩につかない長さで',
        internalNotes: '初めてのお客様',
      })
      expect(await storedLines(id)).toEqual([
        {
          service: 'Ladies Cut',
          staffCode: 'STF002',
          startTime: `${date} 10:00`,
          notes: '前髪は短めに',
        },
        {
          service: 'Deep Conditioning Treatment',
          staffCode: null,
          startTime: `${date} 11:00`,
          notes: null,
        },
      ])
      expect(added).not.toBeInTheDocument()
      expect(
        within(screen.getByRole('table', { name: '施術明細' }))
          .getAllByRole('row')
          .slice(1)
          .map((row) => within(row).getAllByRole('cell')[0]?.textContent),
      ).toEqual(['Mika Suzuki', '未定'])

      // Act: the bookings of the day were read before, and are read again
      await user.click(screen.getByRole('link', { name: 'この日の予約へ' }))

      // Assert: nothing of what was read before is shown
      expect(firstSight).toEqual([
        `/salons/${tokyo}/bookings`,
        expect.stringContaining('予約を読み込んでいます'),
      ])
      expect(
        await screen.findByRole('link', { name: KENJI.name }),
      ).toBeVisible()
    })

    it('should say at the controls what is missing or wrong, move the focus to the first, and send nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      await toTheForm(user)
      await user.type(field('予約金'), '1.5')
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(screen.getByRole('button', { name: '予約を入れる' }))

      // Assert
      expect(combobox('担当スタッフ')).toHaveFocus()
      expect(combobox('担当スタッフ')).toHaveAccessibleDescription(
        expect.stringContaining('担当スタッフを選んでください。'),
      )
      expect(combobox('明細 1 のメニュー')).toHaveAccessibleDescription(
        'メニューを選んでください。',
      )
      expect(field('明細 1 の開始')).toHaveAccessibleDescription(
        '開始の時刻を入力してください。',
      )
      expect(field('予約金')).toHaveAccessibleDescription(
        expect.stringContaining(
          '予約金は、0 以上の円の整数で入力してください。',
        ),
      )
      expect(
        fetched.mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toEqual([])
    })

    it('should tell a member who is taken from one who is free before the booking is sent, until a line changes', async () => {
      // Arrange: Mika Suzuki takes one booking at once, and is taken from 10:00 to 11:00
      await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '10:00',
        staffCode: 'STF002',
      })
      const user = userEvent.setup()
      await toTheForm(user)
      await user.selectOptions(combobox('担当スタッフ'), 'Mika Suzuki')
      await fillLine(user, 1, {
        service: 'Mens Cut（45 分）',
        member: '予約の担当と同じ',
        at: '10:30',
      })
      await user.click(screen.getByRole('button', { name: '明細を追加する' }))
      await fillLine(user, 2, {
        service: 'Ladies Cut（60 分）',
        member: 'Yui Watanabe',
        at: '13:00',
      })
      await user.click(screen.getByRole('button', { name: '明細を追加する' }))
      await fillLine(user, 3, {
        service: 'Kids Cut (Under 12)（30 分）',
        member: '決めない',
        at: '14:00',
      })

      // Act
      await user.click(
        screen.getByRole('button', { name: '担当の空きを確かめる' }),
      )

      // Assert
      expect(
        await screen.findByText(
          '明細 1 の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。',
        ),
      ).toHaveAttribute('role', 'status')
      expect(within(line(1)).getByText('重なる予約があります')).toBeVisible()
      expect(within(line(1)).getByRole('listitem')).toHaveTextContent(
        'BK-TEST-0001 10:00〜11:00',
      )
      expect(within(line(2)).getByText('空いています')).toBeVisible()
      expect(
        within(line(3)).getByText(
          '担当を決めない明細は、誰の時間も占有しません。',
        ),
      ).toBeVisible()

      // Act
      await user.clear(field('明細 1 の開始'))
      await user.type(field('明細 1 の開始'), '11:30')

      // Assert: what was found out was of another time
      expect(within(line(1)).queryByText('重なる予約があります')).toBeNull()
      expect(
        screen.queryByText(
          '明細 1 の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。',
        ),
      ).toBeNull()
    })

    it('should check the members again when the API refuses the booking for one who is taken, and put nothing in', async () => {
      // Arrange
      await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '10:00',
        staffCode: 'STF002',
      })
      const user = userEvent.setup()
      await toTheForm(user)
      await user.selectOptions(combobox('担当スタッフ'), 'Mika Suzuki')
      await fillLine(user, 1, {
        service: 'Mens Cut（45 分）',
        member: '予約の担当と同じ',
        at: '10:30',
      })
      const before = await bookingCount()

      // Act
      await user.click(screen.getByRole('button', { name: '予約を入れる' }))

      // Assert
      expect(await screen.findByText(TAKEN)).toBeVisible()
      expect(
        await within(line(1)).findByText('重なる予約があります'),
      ).toBeVisible()
      expect(await bookingCount()).toBe(before)
      expect(field('明細 1 の開始')).toHaveValue('10:30')
    })

    it('should keep the form as it was typed when the database refuses the booking', async () => {
      // Arrange
      const user = userEvent.setup()
      await toTheForm(user)
      await user.selectOptions(combobox('担当スタッフ'), 'Hiroshi Tanaka')
      await fillLine(user, 1, {
        service: 'Ladies Cut（60 分）',
        member: '予約の担当と同じ',
        at: '10:00',
      })
      await user.type(field('お客様の要望'), '肩につかない長さで')
      await refuse('insert', 'bookings')

      // Act
      await user.click(screen.getByRole('button', { name: '予約を入れる' }))

      // Assert
      expect(
        await screen.findByText(
          '予約を入れられませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(await heading('予約を入れる')).toBeVisible()
      expect(field('お客様の要望')).toHaveValue('肩につかない長さで')
      expect(field('明細 1 の開始')).toHaveValue('10:00')
    })
  })

  describe('changing what the salon wrote down', () => {
    const arrangeWithNotes = async (): Promise<string> => {
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '10:00',
      })
      await testApi().query(
        `update bookings set "customerRequest" = '根元を明るめに', "internalNotes" = '前回より 1 トーン上',
                             source = 'online', "depositAmount" = 3000 where id = $1`,
        [id],
      )

      return id
    }

    const toTheNotes = async (
      user: ReturnType<typeof userEvent.setup>,
      id: string,
    ) => {
      const tokyo = await salonIdOf(TOKYO)
      renderAt(`/salons/${tokyo}/bookings/${id}`)
      await signInAs(OWNER)
      await user.click(
        await screen.findByRole('link', { name: '要望とメモを変える' }),
      )
      await screen.findByRole('combobox', { name: '受付の経路' })

      return tokyo
    }

    /** What the screen asked the API to change, a request each. */
    const changesAsked = (fetched: MockInstance<typeof fetch>): unknown[] =>
      fetched.mock.calls.flatMap(([, init]) =>
        init?.method === 'PATCH' ? [JSON.parse(String(init.body))] : [],
      )

    it('should open with what the booking has, send what was changed alone, and show it on the page', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      const user = userEvent.setup()
      const tokyo = await toTheNotes(user, id)
      expect(combobox('受付の経路')).toHaveDisplayValue('オンライン')
      expect(field('予約金')).toHaveValue('3000')
      expect(field('お客様の要望')).toHaveValue('根元を明るめに')
      expect(field('サロン内のメモ')).toHaveValue('前回より 1 トーン上')
      await user.selectOptions(combobox('受付の経路'), '店頭')
      await user.clear(field('お客様の要望'))
      await user.clear(field('サロン内のメモ'))
      await user.type(field('サロン内のメモ'), '次回はカラーも')
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address).toBe(`/salons/${tokyo}/bookings/${id}`)
      expect(notifications()).toContain('予約の記録を変えました。')
      expect(changesAsked(fetched)).toEqual([
        {
          customerRequest: null,
          internalNotes: '次回はカラーも',
          source: 'walk_in',
        },
      ])
      expect(recordTerms()).toEqual(
        expect.arrayContaining([
          ['お客様の要望', '記録なし'],
          ['サロン内のメモ', '次回はカラーも'],
          ['受付の経路', '店頭'],
          ['予約金', '￥3,000'],
        ]),
      )
      expect(await storedBooking(id)).toMatchObject({
        source: 'walk_in',
        depositAmount: 3000,
        customerRequest: null,
        internalNotes: '次回はカラーも',
      })
    })

    it('should open with what the booking has now, not with what the page of the booking read', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      const user = userEvent.setup()
      const tokyo = await salonIdOf(TOKYO)
      renderAt(`/salons/${tokyo}/bookings/${id}`)
      await signInAs(OWNER)
      const notes = await screen.findByRole('link', {
        name: '要望とメモを変える',
      })
      // Somebody else wrote down another note meanwhile
      await testApi().query(
        `update bookings set "internalNotes" = 'カウンターで追記' where id = $1`,
        [id],
      )

      // Act
      await user.click(notes)

      // Assert
      expect(
        await screen.findByRole('textbox', { name: 'サロン内のメモ' }),
      ).toHaveValue('カウンターで追記')
    })

    it('should ask the API for nothing when nothing was changed, and say so', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      const user = userEvent.setup()
      await toTheNotes(user, id)
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(notifications()).toContain('変更された項目はありません。')
      expect(changesAsked(fetched)).toEqual([])
    })

    it('should keep the form as it was typed, and say so, when the database refuses the change', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      const user = userEvent.setup()
      await toTheNotes(user, id)
      await user.clear(field('サロン内のメモ'))
      await user.type(field('サロン内のメモ'), '次回はカラーも')
      await refuse('update', 'bookings')

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(
        await screen.findByText(
          '予約の記録を変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(await heading('要望とメモを変える')).toBeVisible()
      expect(field('サロン内のメモ')).toHaveValue('次回はカラーも')
      expect((await storedBooking(id)).internalNotes).toBe(
        '前回より 1 トーン上',
      )
    })

    it('should say at the deposit what it takes, and send nothing', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      const user = userEvent.setup()
      await toTheNotes(user, id)
      await user.clear(field('予約金'))
      await user.type(field('予約金'), '-500')
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(field('予約金')).toHaveFocus()
      expect(field('予約金')).toHaveAccessibleDescription(
        expect.stringContaining(
          '予約金は、0 以上の円の整数で入力してください。',
        ),
      )
      expect(changesAsked(fetched)).toEqual([])
    })
  })

  describe('removing a booking', () => {
    const toTheRemoval = async (email = OWNER) => {
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '10:00',
      })
      const tokyo = await salonIdOf(TOKYO)
      renderAt(`/salons/${tokyo}/bookings/${id}`)
      await signInAs(email)
      await screen.findByRole('region', { name: '状態' })

      return { id, tokyo }
    }

    const storedIds = async (id: string): Promise<unknown[]> =>
      testApi().query('select id from bookings where id = $1', [id])

    it('should remove a booking after asking what a removal is for, and lead to the bookings of its day', async () => {
      // Arrange: from the bookings of its day, which were read with it
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '10:00',
      })
      const tokyo = await salonIdOf(TOKYO)
      const date = await dayFromToday(DAY)
      renderAt(`/salons/${tokyo}/bookings?date=${date}`)
      await signInAs(OWNER)
      await user.click(await screen.findByRole('link', { name: YUKI.name }))
      await screen.findByRole('region', { name: '状態' })

      // Act
      await user.click(screen.getByRole('button', { name: '予約を削除する' }))

      // Assert
      const dialog = screen.getByRole('dialog', {
        name: '予約を削除しますか？',
      })
      expect(dialog).toHaveAccessibleDescription(
        expect.stringContaining(
          '誤って入れた予約や、重複した予約を取り除くためのものです。行われない予約は、削除せずにキャンセルしてください。',
        ),
      )

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert: nothing of what was read before is shown
      expect(await heading('予約台帳')).toHaveFocus()
      expect(firstSight).toEqual([
        `/salons/${tokyo}/bookings`,
        expect.stringContaining('予約を読み込んでいます'),
      ])
      expect(address).toBe(`/salons/${tokyo}/bookings?date=${date}`)
      expect(notifications()).toContain('予約を削除しました。')
      expect(await storedIds(id)).toEqual([])
      expect(await screen.findByText(/の予約はありません$/)).toBeVisible()
    })

    it('should offer a member of the staff the change of the notes, and no removal', async () => {
      // Act
      await toTheRemoval(STYLIST)

      // Assert
      expect(
        screen.getByRole('link', { name: '要望とメモを変える' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: '予約を削除する' }),
      ).toBeNull()
    })

    it('should keep a booking a review refers to, close the dialog and say why on the page', async () => {
      // Arrange
      const user = userEvent.setup()
      const { id } = await toTheRemoval()
      await testApi().query(
        `insert into reviews ("salonId", "customerId", "bookingId", "overallRating")
         select "salonId", "customerId", id, 5 from bookings where id = $1`,
        [id],
      )
      await user.click(screen.getByRole('button', { name: '予約を削除する' }))

      // Act
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: '削除する',
        }),
      )

      // Assert
      expect(
        await screen.findByText(
          'この予約は、売上、施術記録、レビューのどれかが指しているため、削除できません。行われた来店の記録として残ります。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await storedIds(id)).toHaveLength(1)
    })

    it('should say in the open dialog that the removal did not come through when the database refuses it', async () => {
      // Arrange
      const user = userEvent.setup()
      const { id } = await toTheRemoval()
      await refuse('delete', 'bookings')
      await user.click(screen.getByRole('button', { name: '予約を削除する' }))

      // Act
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: '削除する',
        }),
      )

      // Assert
      expect(
        await within(screen.getByRole('dialog')).findByText(
          '予約を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(await storedIds(id)).toHaveLength(1)
    })
  })
})
