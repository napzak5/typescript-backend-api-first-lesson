import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked, sent } from '@beauty-salon-frontend/testing/answers'
import {
  countOf,
  dayFromToday,
  giveBack,
  refuse,
  salonIdOf,
  signInAs,
  takeAway,
  testApi,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  firstSight,
  heading,
  notifications,
  readAgain,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { openAs, REST_UNREAD, renderAt } from '../../__tests__/screens'
import {
  arrangeCrowd,
  customerIdOf,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import { arrange, bookingRemovedMeanwhile } from '../__tests__/arrangements'

const TAKEN =
  '担当の時間が、ほかの予約と重なっているため、予約を入れられませんでした。明細ごとに、担当の空きを確かめ直しました。'

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const field = (name: string): HTMLElement => screen.getByLabelText(name)

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

const bookingCount = async (): Promise<number> =>
  countOf('select count(*)::int as count from bookings')

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

/** What an account that belongs to no salon is told of the bookings of a salon. */
const NOT_THEIRS =
  'このサロンの予約は、見られません。予約を見られるのは、そのサロンのスタッフと、管理者です。'

/** The member of the staff the stylist of the seed data is */
const STYLIST_NAME = 'Hiroshi Tanaka'

/** Opens the second step of the entry, for a customer, at its address. */
const toTheStepOf = async (customerId: string) => {
  const tokyo = await salonIdOf(TOKYO)
  const date = await dayFromToday(DAY)
  renderAt(
    `/salons/${tokyo}/bookings/new?date=${date}&customerId=${customerId}`,
  )
  await signInAs(OWNER)

  return { tokyo, date }
}

/** The ID of the booking whose page the application shows. */
const shownBookingId = (): string => address().split('/').at(-1) ?? ''

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
      expect(address()).toBe(
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
        expect(address()).toBe(
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

    it('should say that the customers could not be searched, and find them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await takeAway('customers')
      await toTheCustomers(user, 'yamamoto')
      expect(
        await screen.findByText(
          'お客様を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('customers')

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('link', { name: KENJI.name }),
      ).toBeVisible()
    })

    it('should keep the customers it found when the next ones do not come, and add them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeCrowd(21, 'crowd')
      await toTheCustomers(user, 'crowd')
      const crowd = (): HTMLElement[] =>
        screen.queryAllByRole('link', { name: /^Crowd / })
      await waitFor(() => expect(crowd()).toHaveLength(20))
      await takeAway('customers')
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(REST_UNREAD)
      expect(crowd()).toHaveLength(20)
      await giveBack('customers')

      // Act
      await readAgain(user)

      // Assert
      await waitFor(() => expect(crowd()).toHaveLength(21))
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should search the customers again when the same keyword is sent again', async () => {
      // Arrange
      const user = userEvent.setup()
      await toTheCustomers(user, 'yamamoto')
      await screen.findByRole('link', { name: KENJI.name })
      // Registered at the counter meanwhile
      await testApi().query(
        `insert into customers ("lastName", "firstName", email, "phoneNumber", tags)
         values ('Yamamoto', 'Taro', 'yamamoto-taro@example.com', '+81-90-1111-2222', '{}')`,
      )

      // Act
      await user.type(
        screen.getByRole('searchbox', { name: 'キーワード' }),
        '{Enter}',
      )

      // Assert
      expect(
        await screen.findByRole('link', { name: 'Yamamoto Taro' }),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: KENJI.name })).toBeVisible()
    })

    it('should say that the customer of an address is not found, and lead to choosing again', async () => {
      // Act
      const { tokyo, date } = await toTheStepOf(
        '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01',
      )

      // Assert
      expect(
        await screen.findByText(
          'お客様が見つかりません。台帳から削除されたか、アドレスが正しくありません。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'お客様を選び直す' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/bookings/new?date=${date}`)
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
      expect(address()).toBe(
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
      expect(address()).toBe(`/salons/${tokyo}/bookings/${id}`)
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
      expect(rowsOf('施術明細').map(([, staff]) => staff)).toEqual([
        'Mika Suzuki',
        '未定',
      ])

      // Act: the bookings of the day were read before, and are read again
      await user.click(screen.getByRole('link', { name: 'この日の予約へ' }))

      // Assert: nothing of what was read before is shown
      expect(firstSight()).toEqual([
        `/salons/${tokyo}/bookings?date=${date}`,
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
      expect(asked(fetched).filter((line) => line.startsWith('POST '))).toEqual(
        [],
      )
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

  describe('putting a booking in when something comes to nothing', () => {
    it('should say at the controls what the lines lack when they are checked, and check nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      await toTheForm(user)
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(
        screen.getByRole('button', { name: '担当の空きを確かめる' }),
      )

      // Assert
      expect(combobox('担当スタッフ')).toHaveFocus()
      expect(combobox('担当スタッフ')).toHaveAccessibleDescription(
        expect.stringContaining('担当スタッフを選んでください。'),
      )
      expect(await sent(fetched)).toEqual([])
    })

    it('should say that no booking can be put in at a salon that has no menu', async () => {
      // Arrange
      await testApi().query(
        `update services set "deletedAt" = now()
         where "salonId" = (select id from salons where name = $1)`,
        [TOKYO],
      )

      // Act
      await toTheStepOf(await customerIdOf(KENJI.email))

      // Assert
      expect(await screen.findByText('予約を入れられません')).toBeVisible()
      expect(
        screen.queryByRole('combobox', { name: '担当スタッフ' }),
      ).toBeNull()
    })

    it('should say that the customer or the menu could not be read, and open the form when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await takeAway('services')
      await toTheStepOf(await customerIdOf(KENJI.email))
      expect(
        await screen.findByText(
          'お客様とメニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('services')

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('combobox', { name: '担当スタッフ' }),
      ).toBeVisible()
    })

    it('should say that an account that left its salon meanwhile cannot put the booking in', async () => {
      // Arrange
      const user = userEvent.setup()
      await toTheForm(user, STYLIST)
      await user.selectOptions(combobox('担当スタッフ'), 'Mika Suzuki')
      await fillLine(user, 1, {
        service: 'Ladies Cut（60 分）',
        member: '予約の担当と同じ',
        at: '10:00',
      })
      const before = await bookingCount()
      whenAskedFor('POST /bookings', () => staffRemovedMeanwhile(STYLIST_NAME))

      // Act
      await user.click(screen.getByRole('button', { name: '予約を入れる' }))

      // Assert
      expect(
        await screen.findByText(
          'このアカウントでは、このサロンの予約を入れられません。',
        ),
      ).toBeVisible()
      expect(await bookingCount()).toBe(before)
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
      email = OWNER,
    ) => {
      const tokyo = await salonIdOf(TOKYO)
      renderAt(`/salons/${tokyo}/bookings/${id}`)
      await signInAs(email)
      await user.click(
        await screen.findByRole('link', { name: '要望とメモを変える' }),
      )
      await screen.findByRole('combobox', { name: '受付の経路' })

      return tokyo
    }

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
      expect(address()).toBe(`/salons/${tokyo}/bookings/${id}`)
      expect(notifications()).toContain('予約の記録を変えました。')
      expect(await sent(fetched)).toEqual([
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
      expect(await sent(fetched)).toEqual([])
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

    it('should say that the booking could not be read, and open the form when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrangeWithNotes()
      await takeAway('bookings')
      renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings/${id}/edit`)
      await signInAs(OWNER)
      expect(
        await screen.findByText(
          '予約を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('bookings')

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('combobox', { name: '受付の経路' }),
      ).toHaveDisplayValue('オンライン')
    })

    it('should say that a booking of another salon is not found at the address of this one', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '10:00',
        salon: OSAKA,
        staffCode: 'STF003',
        service: 'Signature Cut',
        minutes: 75,
      })

      // Act
      renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings/${id}/edit`)
      await signInAs(OPERATOR)

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
      expect(screen.queryByRole('combobox', { name: '受付の経路' })).toBeNull()
    })

    it('should tell an account that belongs to no salon any more that the bookings are not theirs to see', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      whenAskedFor(`GET /bookings/${id}`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings/${id}/edit`)
      await signInAs(STYLIST)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
    })

    it('should say that the booking is not found when it was removed while the change was sent', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      const user = userEvent.setup()
      await toTheNotes(user, id)
      await user.clear(field('サロン内のメモ'))
      await user.type(field('サロン内のメモ'), '次回はカラーも')
      whenAskedFor(`PATCH /bookings/${id}`, () => bookingRemovedMeanwhile(id))

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
    })

    it('should say that an account that left its salon meanwhile cannot change the booking', async () => {
      // Arrange
      const id = await arrangeWithNotes()
      const user = userEvent.setup()
      await toTheNotes(user, id, STYLIST)
      await user.clear(field('サロン内のメモ'))
      await user.type(field('サロン内のメモ'), '次回はカラーも')
      whenAskedFor(`PATCH /bookings/${id}`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(
        await screen.findByText(
          'このアカウントでは、この予約を変えられません。',
        ),
      ).toBeVisible()
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
      expect(await sent(fetched)).toEqual([])
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
      expect(firstSight()).toEqual([
        `/salons/${tokyo}/bookings?date=${date}`,
        expect.stringContaining('予約を読み込んでいます'),
      ])
      expect(address()).toBe(`/salons/${tokyo}/bookings?date=${date}`)
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

describe('the bookings a salon puts in, changes and removes, on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  /** Opens the form of a booking for Yamamoto Kenji in English, from the bookings of the day. */
  const toTheFormInEnglish = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    const tokyo = await salonIdOf(TOKYO)
    const date = await dayFromToday(DAY)
    await openAs(`/salons/${tokyo}/bookings?date=${date}`, OWNER, 'en')
    await user.click(
      await screen.findByRole('link', { name: 'Make a booking' }),
    )
    await user.type(
      await screen.findByRole('searchbox', { name: 'Keyword' }),
      'yamamoto{Enter}',
    )
    await user.click(await screen.findByRole('link', { name: KENJI.name }))
    await screen.findByRole('combobox', { name: 'Staff member' })

    return { tokyo, date }
  }

  it('should say in English that an account that left its salon meanwhile cannot put the booking in', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    const date = await dayFromToday(DAY)
    await openAs(
      `/salons/${tokyo}/bookings/new?date=${date}&customerId=${await customerIdOf(KENJI.email)}`,
      STYLIST,
      'en',
    )
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Staff member' }),
      'Mika Suzuki',
    )
    await user.selectOptions(
      combobox('Service of line 1'),
      'Ladies Cut (60 min)',
    )
    await user.selectOptions(combobox('Staff of line 1'), 'Same as the booking')
    await user.type(field('Start of line 1'), '10:00')
    whenAskedFor('POST /bookings', () => staffRemovedMeanwhile(STYLIST_NAME))

    // Act
    await user.click(screen.getByRole('button', { name: 'Make a booking' }))

    // Assert
    expect(
      await screen.findByText(
        'This account cannot make bookings for this salon.',
      ),
    ).toBeVisible()
  })

  it('should put a booking in as the form has it, and show it on its page, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const { date } = await toTheFormInEnglish(user)
    await user.selectOptions(combobox('Staff member'), 'Mika Suzuki')
    await user.selectOptions(
      combobox('Service of line 1'),
      'Ladies Cut (60 min)',
    )
    await user.selectOptions(combobox('Staff of line 1'), 'Same as the booking')
    await user.type(field('Start of line 1'), '10:00')
    await user.selectOptions(combobox('How it was booked'), 'Phone')
    await user.type(field('Deposit'), '1000')
    expect(await findAccessibilityViolations(document.body)).toEqual([])

    // Act
    await user.click(screen.getByRole('button', { name: 'Make a booking' }))

    // Assert
    expect(await heading('Booking details')).toHaveFocus()
    expect(notifications()).toContain('Made the booking.')
    expect(
      within(screen.getByRole('region', { name: 'Booking' }))
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual(
      expect.arrayContaining([
        ['Customer', KENJI.name],
        ['Staff', 'Mika Suzuki'],
        ['Time', '10:00–11:00'],
        ['How it was booked', 'Phone'],
        ['Deposit', '¥1,000'],
      ]),
    )
    expect(await storedBooking(shownBookingId())).toMatchObject({
      staffCode: 'STF002',
      bookingDate: date,
      source: 'phone',
      depositAmount: 1000,
    })
  })

  it('should say in English at the controls what is missing or wrong, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await toTheFormInEnglish(user)
    await user.type(field('Deposit'), '1.5')
    const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

    // Act
    await user.click(screen.getByRole('button', { name: 'Make a booking' }))

    // Assert
    expect(combobox('Staff member')).toHaveFocus()
    expect(combobox('Staff member')).toHaveAccessibleDescription(
      expect.stringContaining('Choose the staff member.'),
    )
    expect(combobox('Service of line 1')).toHaveAccessibleDescription(
      'Choose a service.',
    )
    expect(field('Start of line 1')).toHaveAccessibleDescription(
      'Enter the start time.',
    )
    expect(field('Deposit')).toHaveAccessibleDescription(
      expect.stringContaining(
        'Enter the deposit as a whole number of yen, 0 or more.',
      ),
    )
    expect(asked(fetched).filter((line) => line.startsWith('POST '))).toEqual(
      [],
    )
  })

  it('should change what the salon wrote down, and remove the booking after asking, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: DAY,
      at: '10:00',
    })
    const tokyo = await salonIdOf(TOKYO)
    await openAs(`/salons/${tokyo}/bookings/${id}`, OWNER, 'en')
    await user.click(
      await screen.findByRole('link', { name: 'Edit the requests and notes' }),
    )
    await screen.findByRole('combobox', { name: 'How it was booked' })
    await user.selectOptions(combobox('How it was booked'), 'Walk-in')

    // Act
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // Assert
    expect(await heading('Booking details')).toHaveFocus()
    expect(notifications()).toContain('Saved the record of the booking.')
    expect((await storedBooking(id)).source).toBe('walk_in')

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove the booking' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove the booking?' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    // Assert
    expect(await heading('Booking ledger')).toHaveFocus()
    expect(notifications()).toContain('Removed the booking.')
    expect(await screen.findByText(/^No bookings on /)).toBeVisible()
  })
})
