import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked } from '@beauty-salon-frontend/testing/answers'
import {
  dayFromToday,
  giveBack,
  idsOf,
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
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
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
import { openAs, renderAt } from '../../__tests__/screens'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { arrange, bookingRemovedMeanwhile } from '../__tests__/arrangements'

const MOVE_TAKEN =
  '担当の時間が、ほかの予約と重なっているため、日時と担当を変えられませんでした。動かしたあとの明細ごとに、重なるほかの予約を確かめました。'

const ADDITION_TAKEN =
  '担当の時間が、ほかの予約と重なっているため、施術明細を足せませんでした。足す明細に重なる、ほかの予約を確かめました。'

/** What an account that may no longer change a booking is told. */
const NOT_TO_CHANGE = 'このアカウントでは、この予約を変えられません。'

/** What an account that belongs to no salon is told of the bookings of a salon. */
const NOT_THEIRS =
  'このサロンの予約は、見られません。予約を見られるのは、そのサロンのスタッフと、管理者です。'

/** The member of the staff the stylist of the seed data is */
const STYLIST_NAME = 'Hiroshi Tanaka'

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const field = (name: string): HTMLElement => screen.getByLabelText(name)

/** The lines of the page of a booking: the service, who does it and the hours. */
const linesShown = (): string[][] =>
  rowsOf('施術明細').map((row) => row.slice(0, 3))

/** The lines of the form that moves a booking, where the move would put them. */
const movedShown = (): string[] =>
  within(screen.getByRole('region', { name: '動かしたあとの明細' }))
    .getAllByRole('listitem')
    .filter((item) => item.parentElement?.tagName === 'OL')
    .map((item) => item.textContent ?? '')

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

const bookingSchema = z.tuple([
  z.object({
    staffCode: z.string(),
    bookingDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    totalAmount: z.number(),
  }),
])

/** A booking as it is stored: its member, its day and its hours on Tokyo's clock, and its total. */
const storedBooking = async (id: string) =>
  bookingSchema.parse(
    await testApi().query(
      `select staff."staffCode", to_char(bookings."bookingDate", 'YYYY-MM-DD') as "bookingDate",
              to_char(bookings."startTime" at time zone 'Asia/Tokyo', 'HH24:MI') as "startTime",
              to_char(bookings."endTime" at time zone 'Asia/Tokyo', 'HH24:MI') as "endTime",
              bookings."totalAmount"::int as "totalAmount"
       from bookings join staff on staff.id = bookings."staffId"
       where bookings.id = $1`,
      [id],
    ),
  )[0]

/** The IDs of the lines of a booking, in their order. */
const lineIdsOf = (id: string): Promise<string[]> =>
  idsOf(
    `select id::text from booking_services where "bookingId" = $1 order by "sortOrder"`,
    [id],
  )

/**
 * Puts another line on a booking, after its lines, and sums the booking up
 * as the ledger would: it ends with its last line, and costs what its
 * lines do. A line without a member has no code.
 */
const addLine = (
  id: string,
  {
    service,
    staffCode,
    at,
    minutes,
  }: { service: string; staffCode: string | null; at: string; minutes: number },
): Promise<unknown> =>
  testApi().query(
    `with picked as (
       select bookings.id as "bookingId", services.id as "serviceId", services.price,
              (select staff.id from staff
               where staff."salonId" = bookings."salonId" and staff."staffCode" = $3) as "staffId",
              (bookings."bookingDate" + $4::time) at time zone 'Asia/Tokyo' as "lineStart"
       from bookings
       join services on services."salonId" = bookings."salonId" and services.name = $2
       where bookings.id = $1
     ), made as (
       insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime",
                                     duration, price, "finalPrice", "taxIncluded", "sortOrder")
       select "bookingId", "serviceId", "staffId", "lineStart",
              "lineStart" + make_interval(mins => $5::int), $5::int, price, price, true,
              (select count(*) from booking_services where "bookingId" = $1)::int
       from picked
       returning "bookingId", "endTime", price
     )
     update bookings
     set "endTime" = greatest(bookings."endTime", made."endTime"),
         duration = (extract(epoch from greatest(bookings."endTime", made."endTime") - bookings."startTime") / 60)::int,
         subtotal = bookings.subtotal + made.price,
         "totalAmount" = bookings."totalAmount" + made.price
     from made where bookings.id = made."bookingId"`,
    [id, service, staffCode, at, minutes],
  )

/** The days from today the tests put their bookings on: no seeded booking is then */
const DAY = 5

/**
 * Opens the page of a booking: at its address, or from the bookings of
 * its day, which are then read before the booking is changed.
 */
const toTheBooking = async (
  id: string,
  email = OWNER,
  from: 'address' | 'day' = 'address',
) => {
  const tokyo = await salonIdOf(TOKYO)
  const date = await dayFromToday(DAY)
  if (from === 'day') {
    renderAt(`/salons/${tokyo}/bookings?date=${date}`)
    await signInAs(email)
    await userEvent.click(await screen.findByRole('link', { name: YUKI.name }))
  } else {
    renderAt(`/salons/${tokyo}/bookings/${id}`)
    await signInAs(email)
  }
  await screen.findByRole('region', { name: '状態' })

  return { tokyo, date }
}

/** Goes back from the page of a booking to the bookings of its day: they are read anew, and shown when they are read. */
const backToTheDay = async (
  user: ReturnType<typeof userEvent.setup>,
  tokyo: string,
  date: string,
): Promise<HTMLElement> => {
  await user.click(screen.getByRole('link', { name: 'この日の予約へ' }))
  expect(firstSight()).toEqual([
    `/salons/${tokyo}/bookings?date=${date}`,
    expect.stringContaining('予約を読み込んでいます'),
  ])
  const row = (await screen.findByRole('link', { name: YUKI.name })).closest(
    'tr',
  )

  return row ?? document.body
}

describe('moving a booking and changing its lines, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('moving a booking', () => {
    /** A booking of Mika Suzuki at 10:00: a cut, then a cut of a child that nobody does yet. */
    const arrangeTwoLines = async (): Promise<string> => {
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
        staffCode: 'STF002',
      })
      await addLine(id, {
        service: 'Kids Cut (Under 12)',
        staffCode: null,
        at: '11:00',
        minutes: 30,
      })

      return id
    }

    const toTheMove = async (
      user: ReturnType<typeof userEvent.setup>,
      id: string,
      email = OWNER,
      from: 'address' | 'day' = 'address',
    ) => {
      const opened = await toTheBooking(id, email, from)
      await user.click(screen.getByRole('link', { name: '日時と担当を変える' }))
      await screen.findByRole('region', { name: '動かしたあとの明細' })

      return opened
    }

    it('should move every line with the booking, show where they would be as the values change, and show the booking on its page', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      const { tokyo, date } = await toTheMove(user, id, OWNER, 'day')
      expect(combobox('担当スタッフ')).toHaveDisplayValue('Mika Suzuki')
      expect(field('来店日')).toHaveValue(date)
      expect(field('開始の時刻')).toHaveValue('10:00')
      expect(movedShown()).toEqual([
        '明細 1 Ladies Cut10:00〜11:00 担当 Mika Suzuki',
        '明細 2 Kids Cut (Under 12)11:00〜11:30 担当 未定',
      ])

      // Act
      await user.selectOptions(combobox('担当スタッフ'), 'Yui Watanabe')
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '14:30')

      // Assert
      expect(movedShown()).toEqual([
        '明細 1 Ladies Cut14:30〜15:30 担当 Yui Watanabe',
        '明細 2 Kids Cut (Under 12)15:30〜16:00 担当 未定',
      ])
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address()).toBe(`/salons/${tokyo}/bookings/${id}`)
      expect(notifications()).toContain('予約の日時と担当を変えました。')
      expect(linesShown()).toEqual([
        ['Ladies Cut', 'Yui Watanabe', '14:30〜15:30'],
        ['Kids Cut (Under 12)', '未定', '15:30〜16:00'],
      ])
      expect(await storedBooking(id)).toMatchObject({
        staffCode: 'STF004',
        bookingDate: date,
        startTime: '14:30',
        endTime: '16:00',
      })
      expect(await storedLines(id)).toEqual([
        {
          service: 'Ladies Cut',
          staffCode: 'STF004',
          startTime: `${date} 14:30`,
          notes: null,
        },
        {
          service: 'Kids Cut (Under 12)',
          staffCode: null,
          startTime: `${date} 15:30`,
          notes: null,
        },
      ])

      // Act: the bookings of the day were read before the move
      const row = await backToTheDay(user, tokyo, date)

      // Assert
      expect(row).toHaveTextContent('14:30〜16:00')
      expect(row).toHaveTextContent('Yui Watanabe')
    })

    it('should move a booking to another day, as a member of the staff', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
        staffCode: 'STF002',
      })
      const user = userEvent.setup()
      await toTheMove(user, id, STYLIST)
      const nextDay = await dayFromToday(DAY + 1)

      // Act
      await user.clear(field('来店日'))
      await user.type(field('来店日'), nextDay)
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(await storedBooking(id)).toMatchObject({
        staffCode: 'STF002',
        bookingDate: nextDay,
        startTime: '10:00',
      })
    })

    it('should check every line where it would be when the API refuses the move for a member who is taken, and move nothing', async () => {
      // Arrange: Mika Suzuki takes one booking at once, and is taken from 13:00 to 14:00
      await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '13:00',
        staffCode: 'STF002',
      })
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      const { date } = await toTheMove(user, id)
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '12:30')

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(await screen.findByText(MOVE_TAKEN)).toBeVisible()
      const [first, second] = within(
        screen.getByRole('region', { name: '動かしたあとの明細' }),
      )
        .getAllByRole('listitem')
        .filter((item) => item.parentElement?.tagName === 'OL')
      expect(
        await within(first ?? document.body).findByText('重なる予約があります'),
      ).toBeVisible()
      expect(
        within(first ?? document.body).getByText('BK-TEST-0001 13:00〜14:00'),
      ).toBeVisible()
      expect(second).toHaveTextContent(
        '担当を決めない明細は、誰の時間も占有しません。',
      )
      expect(await storedLines(id)).toMatchObject([
        { staffCode: 'STF002', startTime: `${date} 10:00` },
        { staffCode: null, startTime: `${date} 11:00` },
      ])

      // Act
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '14:30')

      // Assert: what was found out was of another time
      expect(screen.queryByText('重なる予約があります')).toBeNull()
    })

    it('should ask the API for nothing when nothing was changed, and say so', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheMove(user, id)
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(notifications()).toContain('変更された項目はありません。')
      expect(
        asked(fetched).filter((line) => line.endsWith('/reschedule')),
      ).toEqual([])
    })

    it('should say at the controls what is missing, move the focus to the first, and send nothing', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheMove(user, id)
      await user.clear(field('開始の時刻'))
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(field('開始の時刻')).toHaveFocus()
      expect(field('開始の時刻')).toHaveAccessibleDescription(
        expect.stringContaining('開始の時刻を入力してください。'),
      )
      expect(
        screen.getByRole('region', { name: '動かしたあとの明細' }),
      ).toHaveTextContent(
        '担当スタッフ、来店日、開始の時刻を入れると、動かしたあとの明細を出します。',
      )
      expect(
        asked(fetched).filter((line) => line.endsWith('/reschedule')),
      ).toEqual([])
    })

    it('should offer no move for a booking whose treatment began, and say why at its address', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
        status: 'in_progress',
      })
      const { tokyo } = await toTheBooking(id)
      expect(
        screen.queryByRole('link', { name: '日時と担当を変える' }),
      ).toBeNull()

      // Act
      renderAt(`/salons/${tokyo}/bookings/${id}/reschedule`)

      // Assert
      expect(
        await screen.findByText(
          'この予約は施術中のため、日時と担当を変えられません。日時と担当を変えられるのは、下書き、確定待ち、確定の予約です。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '予約の内容へ' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/bookings/${id}`)
    })

    it('should show the booking as it is now, and say why, when its treatment began meanwhile', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      const { date } = await toTheMove(user, id)
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '14:30')
      await testApi().query(
        `update bookings set status = 'in_progress', "actualStartTime" = now() where id = $1`,
        [id],
      )

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(
        await screen.findByText(
          'この予約は施術中のため、日時と担当を変えられません。日時と担当を変えられるのは、下書き、確定待ち、確定の予約です。',
        ),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: '日時と担当を変える' }),
      ).toBeNull()
      expect(await storedBooking(id)).toMatchObject({
        bookingDate: date,
        startTime: '10:00',
      })
    })

    it('should say that the booking is not found when it was removed while it was moved', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheMove(user, id)
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '14:30')
      whenAskedFor(`POST /bookings/${id}/reschedule`, () =>
        bookingRemovedMeanwhile(id),
      )

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
    })

    it('should say that the booking is not found when it was removed after the API refused the move', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheMove(user, id)
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '14:30')
      // The treatment began meanwhile, and the booking went before it was read again
      await testApi().query(
        `update bookings set status = 'in_progress', "actualStartTime" = now() where id = $1`,
        [id],
      )
      whenAskedFor(`GET /bookings/${id}`, () => bookingRemovedMeanwhile(id))

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
    })

    it('should say that an account that left its salon meanwhile cannot move the booking, and keep the form', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheMove(user, id, STYLIST)
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '14:30')
      whenAskedFor(`POST /bookings/${id}/reschedule`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(await screen.findByText(NOT_TO_CHANGE)).toBeVisible()
      expect(field('開始の時刻')).toHaveValue('14:30')
      expect(await storedBooking(id)).toMatchObject({ startTime: '10:00' })
    })

    it('should say that the staff and the menu could not be read, and open the form when asked again', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await takeAway('services')
      renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings/${id}/reschedule`)
      await signInAs(OWNER)
      expect(
        await screen.findByText(
          'スタッフとメニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('services')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect(
        await screen.findByRole('region', { name: '動かしたあとの明細' }),
      ).toBeVisible()
    })

    it('should keep the form as it was typed, and say so, when the database refuses the move', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheMove(user, id)
      await user.clear(field('開始の時刻'))
      await user.type(field('開始の時刻'), '14:30')
      await refuse('update', 'booking_services')

      // Act
      await user.click(
        screen.getByRole('button', { name: '日時と担当を変える' }),
      )

      // Assert
      expect(
        await screen.findByText(
          '予約の日時と担当を変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(field('開始の時刻')).toHaveValue('14:30')
      expect(await storedBooking(id)).toMatchObject({ startTime: '10:00' })
    })
  })

  describe('adding a line', () => {
    const toTheAddition = async (
      user: ReturnType<typeof userEvent.setup>,
      id: string,
      email = OWNER,
      from: 'address' | 'day' = 'address',
    ) => {
      const opened = await toTheBooking(id, email, from)
      await user.click(screen.getByRole('link', { name: '施術明細を追加する' }))
      await screen.findByRole('combobox', { name: 'メニュー' })

      return opened
    }

    it('should add a line on the day of the visit, and show the booking summed up again, as a member of the staff', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
        staffCode: 'STF002',
      })
      const user = userEvent.setup()
      const { tokyo, date } = await toTheAddition(user, id, STYLIST, 'day')
      expect(combobox('担当')).toHaveDisplayValue('予約の担当と同じ')
      await user.selectOptions(combobox('メニュー'), 'Mens Cut（45 分）')
      await user.type(field('開始の時刻'), '11:00')
      await user.type(field('メモ'), '襟足を短く')
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert: the page of the booking, read anew
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address()).toBe(`/salons/${tokyo}/bookings/${id}`)
      expect(notifications()).toContain('施術明細を追加しました。')
      expect(
        await screen.findByRole('table', { name: '施術明細' }),
      ).toBeVisible()
      expect(linesShown()).toEqual([
        ['Ladies Cut', 'Mika Suzuki', '10:00〜11:00'],
        ['Mens Cut', 'Mika Suzuki', '11:00〜11:45'],
      ])
      expect(await storedLines(id)).toEqual([
        {
          service: 'Ladies Cut',
          staffCode: 'STF002',
          startTime: `${date} 10:00`,
          notes: null,
        },
        {
          service: 'Mens Cut',
          staffCode: 'STF002',
          startTime: `${date} 11:00`,
          notes: '襟足を短く',
        },
      ])
      expect(await storedBooking(id)).toMatchObject({
        endTime: '11:45',
        totalAmount: 9500,
      })

      // Act: the bookings of the day were read before the line was added
      const row = await backToTheDay(user, tokyo, date)

      // Assert
      expect(row).toHaveTextContent('10:00〜11:45')
      expect(row).toHaveTextContent('Mens Cut')
    })

    it('should check the member when the API refuses the line for one who is taken, and add nothing', async () => {
      // Arrange: Yui Watanabe takes one booking at once, and is taken from 13:00 to 14:00
      await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: DAY,
        at: '13:00',
        staffCode: 'STF004',
      })
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
        staffCode: 'STF002',
      })
      const user = userEvent.setup()
      await toTheAddition(user, id)
      await user.selectOptions(combobox('メニュー'), 'Mens Cut（45 分）')
      await user.selectOptions(combobox('担当'), 'Yui Watanabe')
      await user.type(field('開始の時刻'), '13:30')

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert
      expect(await screen.findByText(ADDITION_TAKEN)).toBeVisible()
      expect(await screen.findByText('重なる予約があります')).toBeVisible()
      expect(screen.getByText('BK-TEST-0001 13:00〜14:00')).toBeVisible()
      expect(await lineIdsOf(id)).toHaveLength(1)

      // Act
      await user.selectOptions(combobox('担当'), '予約の担当と同じ')

      // Assert: what was found out was of another member
      expect(screen.queryByText('重なる予約があります')).toBeNull()
    })

    it('should say at the controls what the line lacks, and send nothing', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const user = userEvent.setup()
      await toTheAddition(user, id)
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert
      expect(combobox('メニュー')).toHaveFocus()
      expect(combobox('メニュー')).toHaveAccessibleDescription(
        'メニューを選んでください。',
      )
      expect(field('開始の時刻')).toHaveAccessibleDescription(
        expect.stringContaining('開始の時刻を入力してください。'),
      )
      expect(
        asked(fetched).filter(
          (line) => line.startsWith('POST ') && line.endsWith('/services'),
        ),
      ).toEqual([])
    })

    it('should offer no line for a completed booking, and say why at its address', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
        status: 'completed',
      })
      const { tokyo } = await toTheBooking(id)
      expect(
        screen.queryByRole('link', { name: '施術明細を追加する' }),
      ).toBeNull()

      // Act
      renderAt(`/salons/${tokyo}/bookings/${id}/services/new`)

      // Assert
      expect(
        await screen.findByText(
          'この予約は完了のため、施術明細を足せません。施術明細を変えられるのは、下書き、確定待ち、確定、施術中の予約です。',
        ),
      ).toBeVisible()
    })

    it('should show the booking as it is now, and say why, when it was completed meanwhile', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const user = userEvent.setup()
      await toTheAddition(user, id)
      await user.selectOptions(combobox('メニュー'), 'Mens Cut（45 分）')
      await user.type(field('開始の時刻'), '11:00')
      await testApi().query(
        `update bookings set status = 'completed', "completedAt" = now() where id = $1`,
        [id],
      )

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert
      expect(
        await screen.findByText(
          'この予約は完了のため、施術明細を足せません。施術明細を変えられるのは、下書き、確定待ち、確定、施術中の予約です。',
        ),
      ).toBeVisible()
      expect(await lineIdsOf(id)).toHaveLength(1)
    })

    it('should say that the booking is not found when it was removed while the line was added', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const user = userEvent.setup()
      await toTheAddition(user, id)
      await user.selectOptions(combobox('メニュー'), 'Mens Cut（45 分）')
      await user.type(field('開始の時刻'), '11:00')
      whenAskedFor(`POST /bookings/${id}/services`, () =>
        bookingRemovedMeanwhile(id),
      )

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
    })

    it('should say that the booking is not found when it was removed after the API refused the line', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const user = userEvent.setup()
      await toTheAddition(user, id)
      await user.selectOptions(combobox('メニュー'), 'Mens Cut（45 分）')
      await user.type(field('開始の時刻'), '11:00')
      // Completed meanwhile, and gone before it was read again
      await testApi().query(
        `update bookings set status = 'completed', "completedAt" = now() where id = $1`,
        [id],
      )
      whenAskedFor(`GET /bookings/${id}`, () => bookingRemovedMeanwhile(id))

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
    })

    it('should say that an account that left its salon meanwhile cannot add the line, and keep the form', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const user = userEvent.setup()
      await toTheAddition(user, id, STYLIST)
      await user.selectOptions(combobox('メニュー'), 'Mens Cut（45 分）')
      await user.type(field('開始の時刻'), '11:00')
      whenAskedFor(`POST /bookings/${id}/services`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert
      expect(await screen.findByText(NOT_TO_CHANGE)).toBeVisible()
      expect(field('開始の時刻')).toHaveValue('11:00')
      expect(await lineIdsOf(id)).toHaveLength(1)
    })

    it('should keep the form as it was typed, and say so, when the database refuses the line', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const user = userEvent.setup()
      await toTheAddition(user, id)
      await user.selectOptions(combobox('メニュー'), 'Mens Cut（45 分）')
      await user.type(field('開始の時刻'), '11:00')
      await refuse('insert', 'booking_services')

      // Act
      await user.click(
        screen.getByRole('button', { name: '施術明細を追加する' }),
      )

      // Assert
      expect(
        await screen.findByText(
          '施術明細を足せませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(field('開始の時刻')).toHaveValue('11:00')
      expect(await lineIdsOf(id)).toHaveLength(1)
    })
  })

  describe('a line of a booking', () => {
    /** A booking of Mika Suzuki at 10:00: a cut, then a cut of a man by Yui Watanabe. */
    const arrangeTwoLines = async (): Promise<string> => {
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
        staffCode: 'STF002',
      })
      await addLine(id, {
        service: 'Mens Cut',
        staffCode: 'STF004',
        at: '11:00',
        minutes: 45,
      })

      return id
    }

    const toTheLine = async (
      user: ReturnType<typeof userEvent.setup>,
      id: string,
      service: string,
      email = OWNER,
      from: 'address' | 'day' = 'address',
    ) => {
      const opened = await toTheBooking(id, email, from)
      await user.click(
        within(screen.getByRole('table', { name: '施術明細' })).getByRole(
          'link',
          { name: service },
        ),
      )
      await screen.findByRole('region', { name: '施術明細' })

      return opened
    }

    const removeButton = (): HTMLElement =>
      within(
        screen.getByRole('dialog', { name: '施術明細を外しますか？' }),
      ).getByRole('button', { name: '外す' })

    it('should show a line from the page of its booking, take it away after asking, and show the booking summed up again, as a member of the staff', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      const { tokyo, date } = await toTheLine(
        user,
        id,
        'Mens Cut',
        STYLIST,
        'day',
      )
      const [, second] = await lineIdsOf(id)
      expect(await heading('施術明細の内容')).toBeVisible()
      expect(address()).toBe(
        `/salons/${tokyo}/bookings/${id}/services/${second}`,
      )
      expect(
        within(screen.getByRole('region', { name: '施術明細' }))
          .getAllByRole('term')
          .map((term) => [
            term.textContent ?? '',
            term.nextElementSibling?.textContent ?? '',
          ])
          .slice(0, 4),
      ).toEqual([
        ['メニュー', 'Mens Cut'],
        ['担当', 'Yui Watanabe'],
        ['時刻', expect.stringMatching(/ 11:00〜11:45$/)],
        ['所要時間', '45 分'],
      ])
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('button', { name: 'この明細を外す' }))

      // Assert
      expect(
        screen.getByRole('dialog', { name: '施術明細を外しますか？' }),
      ).toHaveAccessibleDescription(
        'Mens Cut（11:00〜11:45）を、予約から外します。予約の時刻と金額は、残る明細から算出し直します。外した明細は、元に戻せません。',
      )

      // Act
      await user.click(removeButton())

      // Assert: the page of the booking, read anew
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address()).toBe(`/salons/${tokyo}/bookings/${id}`)
      expect(notifications()).toContain('施術明細を外しました。')
      expect(
        await screen.findByRole('table', { name: '施術明細' }),
      ).toBeVisible()
      expect(linesShown()).toEqual([
        ['Ladies Cut', 'Mika Suzuki', '10:00〜11:00'],
      ])
      expect(await storedLines(id)).toEqual([
        {
          service: 'Ladies Cut',
          staffCode: 'STF002',
          startTime: `${date} 10:00`,
          notes: null,
        },
      ])
      expect(await storedBooking(id)).toMatchObject({
        endTime: '11:00',
        totalAmount: 5500,
      })

      // Act: the bookings of the day were read before the line was taken away
      const row = await backToTheDay(user, tokyo, date)

      // Assert
      expect(row).toHaveTextContent('10:00〜11:00')
      expect(row).not.toHaveTextContent('Mens Cut')
    })

    it('should say why the last line stays, and offer no removal', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const user = userEvent.setup()

      // Act
      await toTheLine(user, id, 'Ladies Cut')

      // Assert
      expect(
        screen.getByText(
          '予約に残る最後の明細は、外せません。行われない来店は、予約をキャンセルしてください。',
        ),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'この明細を外す' }),
      ).toBeNull()
    })

    it('should close the dialog and say why when the line became the last meanwhile', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheLine(user, id, 'Ladies Cut')
      const [first] = await lineIdsOf(id)
      // Somebody took the other line away meanwhile
      await testApi().query(
        `delete from booking_services where "bookingId" = $1 and "sortOrder" = 1`,
        [id],
      )
      await user.click(screen.getByRole('button', { name: 'この明細を外す' }))

      // Act
      await user.click(removeButton())

      // Assert
      expect(
        await screen.findByText(
          '予約に残る最後の明細は、外せません。行われない来店は、予約をキャンセルしてください。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await lineIdsOf(id)).toEqual([first])
    })

    it('should say in the open dialog that the removal did not come through when the database refuses it', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheLine(user, id, 'Mens Cut')
      await refuse('delete', 'booking_services')
      await user.click(screen.getByRole('button', { name: 'この明細を外す' }))

      // Act
      await user.click(removeButton())

      // Assert
      expect(
        await within(screen.getByRole('dialog')).findByText(
          '施術明細を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(await lineIdsOf(id)).toHaveLength(2)
    })

    it('should say that the line could not be read, and show it when asked again', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      const [, second] = await lineIdsOf(id)
      whenAskedFor(`GET /bookings/${id}/services/${second}`, () =>
        takeAway('booking_services'),
      )
      renderAt(
        `/salons/${await salonIdOf(TOKYO)}/bookings/${id}/services/${second}`,
      )
      await signInAs(OWNER)
      expect(
        await screen.findByText(
          '施術明細を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('booking_services')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect(
        await within(
          await screen.findByRole('region', { name: '施術明細' }),
        ).findByText('Mens Cut'),
      ).toBeVisible()
    })

    it('should tell an account that belongs to no salon any more that the line is not theirs to see', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const [, second] = await lineIdsOf(id)
      whenAskedFor(`GET /bookings/${id}/services/${second}`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      renderAt(
        `/salons/${await salonIdOf(TOKYO)}/bookings/${id}/services/${second}`,
      )
      await signInAs(STYLIST)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('region', { name: '施術明細' })).toBeNull()
    })

    it('should name a line of a service the menu no longer has as such, and ask about its removal with that name', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await testApi().query(
        `update services set "deletedAt" = now()
         where name = 'Mens Cut' and "salonId" = (select id from salons where name = $1)`,
        [TOKYO],
      )
      await toTheLine(user, id, '削除されたメニュー')

      // Act
      await user.click(screen.getByRole('button', { name: 'この明細を外す' }))

      // Assert
      expect(
        screen.getByRole('dialog', { name: '施術明細を外しますか？' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining('削除されたメニュー'),
      )
    })

    it('should close the dialog and say that the booking is not found when it was removed while the line was taken away', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheLine(user, id, 'Mens Cut')
      const [, second] = await lineIdsOf(id)
      await user.click(screen.getByRole('button', { name: 'この明細を外す' }))
      whenAskedFor(`DELETE /bookings/${id}/services/${second}`, () =>
        bookingRemovedMeanwhile(id),
      )

      // Act
      await user.click(removeButton())

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('should say that the booking is not found when it was removed after the API kept the last line', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheLine(user, id, 'Ladies Cut')
      // Somebody took the other line away, and the booking went before it was read again
      await testApi().query(
        `delete from booking_services where "bookingId" = $1 and "sortOrder" = 1`,
        [id],
      )
      await user.click(screen.getByRole('button', { name: 'この明細を外す' }))
      whenAskedFor(`GET /bookings/${id}`, () => bookingRemovedMeanwhile(id))

      // Act
      await user.click(removeButton())

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('should say in the open dialog that an account that left its salon meanwhile cannot take the line away', async () => {
      // Arrange
      const id = await arrangeTwoLines()
      const user = userEvent.setup()
      await toTheLine(user, id, 'Mens Cut', STYLIST)
      const [, second] = await lineIdsOf(id)
      await user.click(screen.getByRole('button', { name: 'この明細を外す' }))
      whenAskedFor(`DELETE /bookings/${id}/services/${second}`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await user.click(removeButton())

      // Assert
      expect(
        await within(screen.getByRole('dialog')).findByText(NOT_TO_CHANGE),
      ).toBeVisible()
      expect(await lineIdsOf(id)).toHaveLength(2)
    })

    it('should say that a line that is not on the booking is not found, and lead back to the booking', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0002',
        day: DAY,
        at: '10:00',
      })
      const tokyo = await salonIdOf(TOKYO)

      // Act
      renderAt(
        `/salons/${tokyo}/bookings/${id}/services/3f0b6c1e-8a2d-4c7e-9b5a-1d4e7f2a9c03`,
      )
      await signInAs(OWNER)

      // Assert
      expect(
        await screen.findByText(
          '施術明細が見つかりません。予約から外されたか、アドレスが正しくありません。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '予約の内容へ' }),
      ).toHaveAttribute('href', `/salons/${tokyo}/bookings/${id}`)
    })
  })
})

describe('moving a booking and changing its lines on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  /** Opens a booking of the Tokyo salon in English, signed in as the owner. */
  const toTheBookingInEnglish = async (id: string): Promise<string> => {
    const tokyo = await salonIdOf(TOKYO)
    await openAs(`/salons/${tokyo}/bookings/${id}`, OWNER, 'en')
    await screen.findByRole('region', { name: 'Status' })

    return tokyo
  }

  /** The lines of the page of a booking in English: the service, who does it and the hours. */
  const linesInEnglish = (): string[][] =>
    rowsOf('Service lines').map((row) => row.slice(0, 3))

  it('should show where the lines would be, and move the booking, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0002',
      day: DAY,
      at: '10:00',
      staffCode: 'STF002',
    })
    await addLine(id, {
      service: 'Kids Cut (Under 12)',
      staffCode: null,
      at: '11:00',
      minutes: 30,
    })
    await toTheBookingInEnglish(id)
    await user.click(
      screen.getByRole('link', { name: 'Change the date, time and staff' }),
    )
    const moved = await screen.findByRole('region', {
      name: 'The lines after the move',
    })
    await user.selectOptions(combobox('Staff member'), 'Yui Watanabe')
    await user.clear(field('Start time'))
    await user.type(field('Start time'), '14:30')
    expect(
      within(moved)
        .getAllByRole('listitem')
        .filter((item) => item.parentElement?.tagName === 'OL')
        .map((item) => item.textContent),
    ).toEqual([
      'Line 1: Ladies Cut14:30–15:30, staff: Yui Watanabe',
      'Line 2: Kids Cut (Under 12)15:30–16:00, staff: Unassigned',
    ])

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Change the date, time and staff' }),
    )

    // Assert
    expect(await heading('Booking details')).toHaveFocus()
    expect(notifications()).toContain(
      'Changed the date, time and staff of the booking.',
    )
    expect(linesInEnglish()).toEqual([
      ['Ladies Cut', 'Yui Watanabe', '14:30–15:30'],
      ['Kids Cut (Under 12)', 'Unassigned', '15:30–16:00'],
    ])
  })

  it('should say in English that an account that left its salon meanwhile cannot move the booking', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0002',
      day: DAY,
      at: '10:00',
    })
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/bookings/${id}/reschedule`,
      STYLIST,
      'en',
    )
    await screen.findByRole('region', { name: 'The lines after the move' })
    await user.clear(field('Start time'))
    await user.type(field('Start time'), '14:30')
    whenAskedFor(`POST /bookings/${id}/reschedule`, () =>
      staffRemovedMeanwhile(STYLIST_NAME),
    )

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Change the date, time and staff' }),
    )

    // Assert
    expect(
      await screen.findByText('This account cannot change this booking.'),
    ).toBeVisible()
  })

  it('should say in English why a booking whose treatment began is not moved', async () => {
    // Arrange
    const id = await arrange({
      bookingNumber: 'BK-TEST-0002',
      day: DAY,
      at: '10:00',
      status: 'in_progress',
    })
    const tokyo = await salonIdOf(TOKYO)

    // Act
    await openAs(`/salons/${tokyo}/bookings/${id}/reschedule`, OWNER, 'en')

    // Assert
    expect(
      await screen.findByText(
        'This booking is in the status “In progress”, so its date, time and staff cannot be changed. They can be changed for bookings in these statuses: Draft, Awaiting confirmation, Confirmed.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Back to the booking' }),
    ).toHaveAttribute('href', `/salons/${tokyo}/bookings/${id}`)
  })

  it('should add a line, show it on its page and take it off after asking, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0002',
      day: DAY,
      at: '10:00',
      staffCode: 'STF002',
    })
    await toTheBookingInEnglish(id)
    await user.click(screen.getByRole('link', { name: 'Add a line' }))
    await screen.findByRole('combobox', { name: 'Service' })
    expect(combobox('Staff')).toHaveDisplayValue('Same as the booking')
    await user.selectOptions(combobox('Service'), 'Mens Cut (45 min)')
    await user.type(field('Start time'), '11:00')

    // Act
    await user.click(screen.getByRole('button', { name: 'Add a line' }))

    // Assert
    expect(await heading('Booking details')).toHaveFocus()
    expect(notifications()).toContain('Added the line.')
    expect(
      await screen.findByRole('table', { name: 'Service lines' }),
    ).toBeVisible()
    expect(linesInEnglish()).toEqual([
      ['Ladies Cut', 'Mika Suzuki', '10:00–11:00'],
      ['Mens Cut', 'Mika Suzuki', '11:00–11:45'],
    ])

    // Act
    await user.click(
      within(screen.getByRole('table', { name: 'Service lines' })).getByRole(
        'link',
        { name: 'Mens Cut' },
      ),
    )

    // Assert
    expect(await heading('Line details')).toBeVisible()
    expect(
      within(await screen.findByRole('region', { name: 'Service line' }))
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual([
      'Service',
      'Staff',
      'Time',
      'Duration',
      'Price',
      'Discount',
      'Amount to pay',
      'Done',
      'Notes',
    ])

    // Act
    await user.click(screen.getByRole('button', { name: 'Take this line off' }))
    const dialog = screen.getByRole('dialog', { name: 'Take the line off?' })
    expect(dialog).toHaveAccessibleDescription(
      expect.stringMatching(/^Mens Cut \(11:00–11:45\) will be taken off/),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Take off' }))

    // Assert
    expect(await heading('Booking details')).toHaveFocus()
    expect(notifications()).toContain('Took the line off.')
    expect(
      await screen.findByRole('table', { name: 'Service lines' }),
    ).toBeVisible()
    expect(linesInEnglish()).toEqual([
      ['Ladies Cut', 'Mika Suzuki', '10:00–11:00'],
    ])
  })
})
