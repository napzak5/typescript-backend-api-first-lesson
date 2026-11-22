import { applications } from '@beauty-salon-frontend/brand'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import {
  address,
  asTheApplicationKeeps,
  firstSight,
  heading,
  optionsOf,
  statusMessages,
} from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  OSAKA,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { renderAt } from '../../__tests__/screens'
import {
  ANOTHER_CUSTOMER,
  bookThroughApi,
  giveBack,
  HIROSHI,
  LADIES_CUT,
  MIKA,
  momentAt,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  NOTHING,
  openDay,
  registerNewcomer,
  signedInAs,
  staffId,
  takeAway,
} from '../__tests__/arrangements'

/*
 * The seed data gives the customer of these tests five bookings. Two are
 * to come: a cut for a child in Tokyo in four days, and a cut with a head
 * spa in Osaka in seven, which has two services and is therefore the
 * salon's to move. Three were: two visits that were completed, thirty and
 * ten days ago, and one that was cancelled, two days ago. All of them are
 * two days or more from today, so the lists are the same in whatever time
 * zone the tests run.
 */

const TITLE = applications.portal.name

const STATUS_NAMES: Record<string, string> = {
  pending: '確定待ち',
  confirmed: '確定',
  completed: '完了',
  cancelled: 'キャンセル',
}

/**
 * The list kept nothing of what it had read before the write: the commit
 * that shows it again holds no list, it says that the bookings are being
 * read.
 */
const expectListReadAnew = (): void => {
  expect(firstSight()).toEqual([
    '/bookings',
    expect.stringContaining('予約を読み込んでいます'),
  ])
}

// --- What the tests ask of the database

const storedSchema = z.array(
  z.object({
    id: z.uuid(),
    bookingNumber: z.string(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    status: z.string(),
    salon: z.string(),
    service: z.string(),
  }),
)

type Stored = z.infer<typeof storedSchema>[number]

/**
 * The bookings of a customer as they are stored, the earliest visit first:
 * those to come, or those that were.
 */
const storedBookings = async (
  email: string,
  when: 'upcoming' | 'past',
): Promise<Stored[]> =>
  storedSchema.parse(
    await testApi().query(
      `select bookings.id::text, bookings."bookingNumber", bookings.status::text,
              to_char(bookings."startTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startTime",
              to_char(bookings."endTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "endTime",
              salons.name as salon,
              (select services.name
               from booking_services join services on services.id = booking_services."serviceId"
               where booking_services."bookingId" = bookings.id
               order by booking_services."sortOrder" limit 1) as service
       from bookings
       join customers on customers.id = bookings."customerId"
       join salons on salons.id = bookings."salonId"
       where customers.email = $1
         and (bookings."bookingDate" >= (now() at time zone 'Asia/Tokyo')::date) = $2
       order by bookings."startTime", bookings.id`,
      [email, when === 'upcoming'],
    ),
  )

/** One stored booking of the customer of the tests, found by what tells it from the others. */
const stored = async (
  when: 'upcoming' | 'past',
  salon: string,
  status: string,
): Promise<Stored> => {
  const [found] = (await storedBookings(CUSTOMER, when)).filter(
    (booking) => booking.salon === salon && booking.status === status,
  )
  if (found === undefined) {
    throw new Error(`The seed data has no ${status} booking at ${salon}`)
  }

  return found
}

const rowSchema = z.tuple([
  z.object({
    status: z.string(),
    startTime: z.iso.datetime(),
    staff: z.string(),
    cancellationReason: z.string().nullable(),
    cancelledBy: z.string().nullable(),
  }),
])

/** A booking as it is stored: where it stands, when and with whom it is, and how it was cancelled. */
const rowOf = async (id: string) => {
  const [row] = rowSchema.parse(
    await testApi().query(
      `select bookings.status::text, staff."displayName" as staff, bookings."cancellationReason",
              to_char(bookings."startTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "startTime",
              (select users.email from users where users.id = bookings."cancelledBy") as "cancelledBy"
       from bookings join staff on staff.id = bookings."staffId"
       where bookings.id = $1`,
      [id],
    ),
  )

  return row
}

/**
 * Visits that were, in numbers: one a day, from a hundred days ago
 * backwards, each a cut in Tokyo that was completed.
 */
const insertVisits = (email: string, count: number) =>
  testApi().query(
    `with visit as (
       select customers.id as "customerId", services.id as "serviceId", services."salonId", staff.id as "staffId",
              (now() at time zone 'Asia/Tokyo')::date - 100 - n as day, n
       from generate_series(1, $2::int) as n
       cross join (select id from customers where email = $1) customers
       cross join (select services.id, services."salonId"
                   from services join salons on salons.id = services."salonId"
                   where salons.name = $3 and services.name = $4) services
       cross join (select id from staff where "displayName" = $5) staff
     ), made as (
       insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate",
                             "startTime", "endTime", duration, status, subtotal, "totalAmount", "completedAt")
       select 'BK-TEST-' || lpad(n::text, 4, '0'), "salonId", "customerId", "staffId", day,
              (day + time '10:00') at time zone 'Asia/Tokyo', (day + time '11:00') at time zone 'Asia/Tokyo',
              60, 'completed', 5500, 5500, (day + time '11:00') at time zone 'Asia/Tokyo'
       from visit
       returning id, "staffId", "startTime", "endTime"
     )
     insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime",
                                   duration, price, "finalPrice", "taxIncluded")
     select made.id, services.id, made."staffId", made."startTime", made."endTime", 60, 5500, 5500, true
     from made
     cross join (select services.id
                 from services join salons on salons.id = services."salonId"
                 where salons.name = $3 and services.name = $4) services`,
    [email, count, TOKYO, LADIES_CUT, HIROSHI],
  )

// --- What the tests read on the screen

const day = (moment: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'full',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(moment))

const timeOfDay = (moment: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(moment))

/** When a booking is, as a list and a dialog say it. */
const whenOf = ({
  startTime,
  endTime,
}: Pick<Stored, 'startTime' | 'endTime'>) =>
  `${day(startTime)} ${timeOfDay(startTime)}〜${timeOfDay(endTime)}`

/** What a list says of a stored booking, line by line. */
const lineOf = (booking: Stored): (string | undefined)[] => [
  whenOf(booking),
  booking.salon,
  booking.service,
  STATUS_NAMES[booking.status],
]

/**
 * A list when all of what was read is in it. A booking is shown when the
 * names of its salon and of its service are read, so the bookings come in
 * steps: until the last of them is there, the button below them is busy.
 */
const listNamed = async (name: string): Promise<HTMLElement> => {
  const list = await screen.findByRole('region', { name })
  await waitFor(() =>
    expect(within(list).queryByRole('button', { busy: true })).toBeNull(),
  )

  return list
}

/** What each booking of a list says, line by line. */
const linesIn = (list: HTMLElement): (string | null)[][] =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => Array.from(item.children, (line) => line.textContent))

/** The names and the values of a record, as a description list shows them. */
const detailsIn = (region: HTMLElement): Record<string, string | null> =>
  Object.fromEntries(
    within(region)
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )

const QUESTION = '予約をキャンセルしますか？'

const cancelButton = () =>
  screen.findByRole('button', { name: '予約をキャンセルする' })
const dialog = () => screen.getByRole('dialog', { name: QUESTION })
const confirmButton = () =>
  within(dialog()).getByRole('button', { name: 'キャンセルを確定する' })

const staffControl = () => screen.findByRole('combobox', { name: 'スタッフ' })

/** The times on offer, as they are labelled. */
const offeredTimes = async (): Promise<(string | null | undefined)[]> =>
  within(await screen.findByRole('radiogroup', { name: '開始時刻' }))
    .getAllByRole('radio')
    .map((time) => time.closest('label')?.textContent)

const time = (label: string) => screen.getByRole('radio', { name: label })
const moveButton = () =>
  screen.getByRole('button', { name: 'この日時に変更する' })

/**
 * A booking that the customer of the tests made, on a day the tests know:
 * a cut with Mika from 11:30 to 12:30, at a salon that is open from 10:00
 * to 13:00 and where Hiroshi works as well.
 */
const book = async (): Promise<{
  id: string
  bookingNumber: string
  date: string
}> => {
  const date = await openDay({ [MIKA]: '10:00', [HIROSHI]: '10:00' })
  const booked = await bookThroughApi(CUSTOMER, {
    staff: MIKA,
    startTime: momentAt(date, '11:30'),
    customerRequest: null,
  })

  return { ...booked, date }
}

describe('the bookings of a customer, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('the navigation of the header', () => {
    it('should lead a customer who is signed in to the search, to their bookings and to their own page, and mark the one they are at', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt('/')
      const navigation = await screen.findByRole('navigation', {
        name: 'メインメニュー',
      })

      // Assert
      expect(
        within(navigation)
          .getAllByRole('link')
          .map((link) => [
            link.textContent,
            link.getAttribute('href'),
            link.getAttribute('aria-current'),
          ]),
      ).toEqual([
        ['サロンを探す', '/', 'page'],
        ['予約の一覧', '/bookings', null],
        ['マイページ', '/mypage', null],
      ])

      // Act
      await userEvent.click(
        within(navigation).getByRole('link', { name: '予約の一覧' }),
      )

      // Assert
      expect(await heading('予約の一覧')).toHaveFocus()
      expect(address()).toBe('/bookings')
      expect(
        within(
          screen.getByRole('navigation', { name: 'メインメニュー' }),
        ).getByRole('link', { name: '予約の一覧' }),
      ).toHaveAttribute('aria-current', 'page')
    })

    it('should have no navigation for a visitor', async () => {
      // Act
      renderAt('/')

      // Assert
      expect(
        await screen.findByRole('link', { name: 'サインイン' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('navigation', { name: 'メインメニュー' }),
      ).toBeNull()
    })

    it('should have no navigation for an account of the staff of a salon', async () => {
      // Arrange
      await signedInAs(STYLIST)

      // Act
      renderAt('/')

      // Assert
      expect(
        await screen.findByRole('button', { name: 'サインアウト' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('navigation', { name: 'メインメニュー' }),
      ).toBeNull()
    })
  })

  describe('the list', () => {
    it('should ask somebody who is not signed in to sign in', async () => {
      // Act
      renderAt('/bookings')

      // Assert
      expect(
        await screen.findByText('予約を確認するには、サインインしてください。'),
      ).toBeVisible()
      expect(screen.queryByRole('region')).toBeNull()
    })

    it('should tell an account of the staff of a salon that the screen is not for it', async () => {
      // Arrange
      await signedInAs(STYLIST)

      // Act
      renderAt('/bookings')

      // Assert
      expect(
        await screen.findByText(
          'stylist1@beautysalon.jp のアカウントでは利用できません。利用できるアカウントでサインインし直してください。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('region')).toBeNull()
    })

    it('should list the visits to come, the earliest first: when each is at its salon, where, what, and where it stands', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const upcoming = await storedBookings(CUSTOMER, 'upcoming')

      // Act
      renderAt('/bookings')

      // Assert
      const list = await listNamed('これからの予約')
      expect(linesIn(list)).toEqual(upcoming.map(lineOf))
      expect(upcoming.map(({ salon, service }) => [salon, service])).toEqual([
        [TOKYO, 'Kids Cut (Under 12)'],
        [OSAKA, 'Signature Cut'],
      ])
      expect(within(list).getByText('2 件の予約があります')).toHaveRole(
        'status',
      )
      expect(document.title).toBe(`予約の一覧 | ${TITLE}`)
      expect(
        within(screen.getByRole('navigation', { name: '予約の時期' }))
          .getAllByRole('link')
          .map((link) => [
            link.textContent,
            link.getAttribute('href'),
            link.getAttribute('aria-current'),
          ]),
      ).toEqual([
        ['これからの予約', '/bookings', 'page'],
        ['これまでの予約', '/bookings?when=past', null],
      ])
    })

    it('should list the visits that were behind their link, the earliest first, and keep the focus on the link', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const past = await storedBookings(CUSTOMER, 'past')
      renderAt('/bookings')
      await listNamed('これからの予約')
      const link = screen.getByRole('link', { name: 'これまでの予約' })

      // Act
      await userEvent.click(link)

      // Assert
      const list = await listNamed('これまでの予約')
      expect(linesIn(list)).toEqual(past.map(lineOf))
      expect(past.map(({ status }) => status)).toEqual([
        'completed',
        'completed',
        'cancelled',
      ])
      expect(address()).toBe('/bookings?when=past')
      expect(link).toHaveFocus()
      expect(link).toHaveAttribute('aria-current', 'page')
      expect(
        screen.queryByRole('region', { name: 'これからの予約' }),
      ).toBeNull()
    })

    it.each([
      ['the visits that were', '/bookings?when=past', 'これまでの予約'],
      ['the visits to come', '/bookings?when=tomorrow', 'これからの予約'],
    ])(
      'should show the list its address names: %s at %s',
      async (_case, path, name) => {
        // Arrange
        await signedInAs(CUSTOMER)

        // Act
        renderAt(path)

        // Assert
        expect(await listNamed(name)).toBeVisible()
        expect(
          screen.getByRole('link', { name, current: 'page' }),
        ).toBeVisible()
      },
    )

    it('should lead from a booking of the list to its page, and back to the list', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const [first] = await storedBookings(CUSTOMER, 'upcoming')
      renderAt('/bookings')
      const list = await listNamed('これからの予約')

      // Act
      await userEvent.click(
        within(list).getAllByRole('link').at(0) ?? document.body,
      )

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address()).toBe(`/bookings/${first?.id}`)
      expect(
        await screen.findByRole('region', {
          name: `予約番号 ${first?.bookingNumber}`,
        }),
      ).toBeVisible()

      // Act
      await userEvent.click(screen.getByRole('link', { name: '予約の一覧へ' }))

      // Assert
      expect(await heading('予約の一覧')).toHaveFocus()
      expect(await listNamed('これからの予約')).toBeVisible()
    })

    it('should list a booking that was just made the moment the list is shown again, and never the list as it was read before', async () => {
      // Arrange: the list is read, and then a cut is booked from the search
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00' })
      renderAt('/bookings')
      const user = userEvent.setup()
      expect(linesIn(await listNamed('これからの予約'))).toHaveLength(2)
      await user.click(
        within(
          screen.getByRole('navigation', { name: 'メインメニュー' }),
        ).getByRole('link', { name: 'サロンを探す' }),
      )
      await user.click(await screen.findByRole('link', { name: TOKYO }))
      await user.click(
        await screen.findByRole('link', { name: `${LADIES_CUT}を予約する` }),
      )
      fireEvent.change(await screen.findByLabelText('日付'), {
        target: { value: date },
      })
      await user.click(await screen.findByRole('radio', { name: '10:00' }))
      await user.click(
        screen.getByRole('button', { name: 'この内容で予約する' }),
      )

      // Act: the page of the booking, which booking leads to, has the link
      await user.click(
        await screen.findByRole('link', { name: '予約の一覧へ' }),
      )

      // Assert: the list as it was read before is not shown, not even in
      // the commit that shows the screen
      const list = await listNamed('これからの予約')
      expectListReadAnew()
      expect(linesIn(list)).toEqual(
        (await storedBookings(CUSTOMER, 'upcoming')).map(lineOf),
      )
      expect(linesIn(list)).toHaveLength(3)
    })

    it('should say that there are no bookings to an account that has made none, lead to the search, and say the same of the visits that were', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)

      // Act
      renderAt('/bookings')

      // Assert
      expect(
        await screen.findByText('これからの予約はありません'),
      ).toBeVisible()
      expect(
        within(screen.getByRole('main')).getByRole('link', {
          name: 'サロンを探す',
        }),
      ).toHaveAttribute('href', '/')
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(
        screen.getByRole('link', { name: 'これまでの予約' }),
      )

      // Assert
      expect(
        await screen.findByText('これまでの予約はありません'),
      ).toBeVisible()
      expect(screen.queryByText('これからの予約はありません')).toBeNull()
    })

    it('should show twenty bookings, say how many there are, and add the rest below with the focus on the first of them', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      await insertVisits(CUSTOMER, 25)
      const past = await storedBookings(CUSTOMER, 'past')
      renderAt('/bookings?when=past')
      const list = await listNamed('これまでの予約')
      const shownAtFirst = linesIn(list)
      const countAtFirst = within(list).getByRole('status').textContent

      // Act
      await userEvent.click(
        within(list).getByRole('button', { name: 'さらに表示' }),
      )

      // Assert
      expect(await within(list).findByText('28 件の予約があります')).toHaveRole(
        'status',
      )
      expect(shownAtFirst).toEqual(past.slice(0, 20).map(lineOf))
      expect(countAtFirst).toBe(
        '28 件の予約があります（20 件を表示しています）',
      )
      expect(linesIn(list)).toEqual(past.map(lineOf))
      expect(within(list).getAllByRole('link').at(20)).toHaveFocus()
      expect(within(list).queryByRole('button')).toBeNull()
    })

    it('should say that the next bookings did not come, keep those it has, and add them when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      await insertVisits(CUSTOMER, 25)
      renderAt('/bookings?when=past')
      const list = await listNamed('これまでの予約')
      await takeAway('bookings')

      // Act
      await userEvent.click(
        within(list).getByRole('button', { name: 'さらに表示' }),
      )

      // Assert
      expect(await within(list).findByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(within(list).getAllByRole('listitem')).toHaveLength(20)

      // Act
      await giveBack('bookings')
      await userEvent.click(
        within(list).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        await within(list).findByText('28 件の予約があります'),
      ).toBeVisible()
      expect(within(list).getAllByRole('listitem')).toHaveLength(28)
      expect(within(list).queryByRole('alert')).toBeNull()
    })

    it('should say that the bookings could not be read, and read them when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      await takeAway('bookings')
      renderAt('/bookings')

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '予約を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await heading('予約の一覧')).toBeVisible()

      // Act
      await giveBack('bookings')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        within(await listNamed('これからの予約')).getAllByRole('listitem'),
      ).toHaveLength(2)
    })

    it('should read the list again whenever it is shown, with what the application keeps: a booking the salon confirmed meanwhile is shown as confirmed', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt('/bookings', { client: asTheApplicationKeeps() })
      const user = userEvent.setup()
      const before = linesIn(await listNamed('これからの予約')).map((lines) =>
        lines.at(-1),
      )
      await user.click(screen.getByRole('link', { name: 'これまでの予約' }))
      await listNamed('これまでの予約')
      await testApi().query(
        `update bookings set status = 'confirmed' where id = $1::uuid`,
        [(await stored('upcoming', TOKYO, 'pending')).id],
      )

      // Act
      await user.click(screen.getByRole('link', { name: 'これからの予約' }))

      // Assert
      expect(
        await within(await listNamed('これからの予約')).findByText('確定'),
      ).toBeVisible()
      expect(before).toEqual(['確定待ち', '確定待ち'])
    })

    it('should show the bookings whose names it has when the salon of a later one could not be read, say so below them, and show the rest when asked again', async () => {
      // Arrange: what is stored as the hours of the second salon is no
      // hours, so the API answers 500 for that salon alone
      await signedInAs(CUSTOMER)
      await testApi().query(
        `update salons set "businessHours" = '{"monday": "ten to seven"}' where name = $1`,
        [OSAKA],
      )
      renderAt('/bookings')

      // Assert
      const list = await screen.findByRole('region', {
        name: 'これからの予約',
      })
      expect(await within(list).findByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(linesIn(list)).toEqual([
        lineOf(await stored('upcoming', TOKYO, 'pending')),
      ])
      expect(
        within(list).getByText('2 件の予約があります（1 件を表示しています）'),
      ).toBeVisible()

      // Act
      await testApi().query(
        `update salons set "businessHours" = null where name = $1`,
        [OSAKA],
      )
      await userEvent.click(
        within(list).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(await within(list).findByText(OSAKA)).toBeVisible()
      expect(linesIn(list)).toEqual(
        (await storedBookings(CUSTOMER, 'upcoming')).map(lineOf),
      )
      expect(within(list).queryByRole('alert')).toBeNull()
    })

    it('should say that the bookings could not be read when the salons they name could not, and show them when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      await takeAway('opening_hours')
      renderAt('/bookings')

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '予約を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(
        screen.queryByRole('region', { name: 'これからの予約' }),
      ).toBeNull()

      // Act
      await giveBack('opening_hours')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        linesIn(await listNamed('これからの予約')).map(([, salon]) => salon),
      ).toEqual([TOKYO, OSAKA])
    })

    it('should tell the day alone of a visit to a salon that is no longer there, and show its page without a time and an amount', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const visit = await stored('past', OSAKA, 'completed')
      await testApi().query(
        'update salons set "deletedAt" = now() where name = $1',
        [OSAKA],
      )
      renderAt('/bookings?when=past')
      const list = await listNamed('これまでの予約')

      // Assert
      expect(linesIn(list).at(1)).toEqual([
        day(visit.startTime),
        'サロン（掲載を終えています）',
        'メニュー（掲載を終えています）',
        '完了',
      ])

      // Act
      await userEvent.click(
        within(list).getByRole('link', { name: day(visit.startTime) }),
      )

      // Assert
      const details = detailsIn(
        await screen.findByRole('region', {
          name: `予約番号 ${visit.bookingNumber}`,
        }),
      )
      expect(details).toMatchObject({
        状態: '完了',
        サロン: '（掲載を終えています）',
        メニュー: '（掲載を終えています）',
        日時: `${day(visit.startTime)} （1 時間）`,
      })
      expect(details).not.toHaveProperty('料金')
    })

    it('should have no accessibility violations, with bookings to come and with those that were', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt('/bookings')
      await listNamed('これからの予約')

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(
        screen.getByRole('link', { name: 'これまでの予約' }),
      )
      await listNamed('これまでの予約')

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])
    })
  })

  describe('cancelling a booking', () => {
    it('should offer to move and to cancel a booking that has not begun', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, date } = await book()

      // Act
      renderAt(`/bookings/${id}`)

      // Assert
      expect(await cancelButton()).toBeEnabled()
      expect(
        screen.getByRole('link', { name: '日時を変更する' }),
      ).toHaveAttribute(
        'href',
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it.each([
      ['was completed', 'completed'],
      ['was cancelled', 'cancelled'],
    ])('should offer neither for a booking that %s', async (_case, status) => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber } = await stored('past', TOKYO, status)

      // Act
      renderAt(`/bookings/${id}`)

      // Assert
      expect(
        await screen.findByRole('region', {
          name: `予約番号 ${bookingNumber}`,
        }),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: '予約をキャンセルする' }),
      ).toBeNull()
      expect(screen.queryByRole('link', { name: '日時を変更する' })).toBeNull()
      // The page was opened by its address and nobody did anything here:
      // the focus is where the browser put it
      expect(document.body).toHaveFocus()
    })

    it('should say whom to ask, and offer the cancellation alone, for a booking the salon has to move: it has two services', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await stored('upcoming', OSAKA, 'pending')

      // Act
      renderAt(`/bookings/${id}`)

      // Assert
      expect(await cancelButton()).toBeEnabled()
      expect(
        screen.getByText(
          'この予約の日時の変更は、サロンにお問い合わせください。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('link', { name: '日時を変更する' })).toBeNull()
    })

    it('should ask before it cancels, name the booking by its time, and cancel nothing when the dialog is left', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, date } = await book()
      renderAt(`/bookings/${id}`)

      // Act
      await userEvent.click(await cancelButton())

      // Assert
      expect(dialog()).toHaveAttribute('open')
      expect(dialog()).toHaveAccessibleDescription(
        `${whenOf({
          startTime: momentAt(date, '11:30'),
          endTime: momentAt(date, '12:30'),
        })}の予約をキャンセルします。キャンセルした予約は、元に戻せません。`,
      )
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await rowOf(id)).toMatchObject({ status: 'pending' })
      expect(await cancelButton()).toBeEnabled()
    })

    it('should cancel the booking with the reason, say so, show it as cancelled without its buttons, and move the focus to the heading', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber } = await book()
      renderAt(`/bookings/${id}`)
      const user = userEvent.setup()
      await user.click(await cancelButton())

      // Act
      await user.type(
        within(dialog()).getByRole('textbox', { name: 'キャンセルの理由' }),
        '  都合が悪くなりました  ',
      )
      await user.click(confirmButton())

      // Assert
      expect(
        await screen.findByText('予約をキャンセルしました。'),
      ).toBeVisible()
      expect(await heading('予約の内容')).toHaveFocus()
      expect(statusMessages()).toContain('予約をキャンセルしました。')
      expect(
        detailsIn(
          screen.getByRole('region', { name: `予約番号 ${bookingNumber}` }),
        ),
      ).toMatchObject({ 状態: 'キャンセル' })
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(
        screen.queryByRole('button', { name: '予約をキャンセルする' }),
      ).toBeNull()
      expect(screen.queryByRole('link', { name: '日時を変更する' })).toBeNull()
      expect(await rowOf(id)).toMatchObject({
        status: 'cancelled',
        cancellationReason: '都合が悪くなりました',
        cancelledBy: CUSTOMER,
      })
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should cancel without a reason when none is written', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book()
      renderAt(`/bookings/${id}`)
      await userEvent.click(await cancelButton())

      // Act
      await userEvent.click(confirmButton())

      // Assert
      expect(
        await screen.findByText('予約をキャンセルしました。'),
      ).toBeVisible()
      expect(await rowOf(id)).toMatchObject({
        status: 'cancelled',
        cancellationReason: null,
      })
    })

    it('should show the booking as cancelled the moment the list is shown again, and never as it was read before', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book()
      renderAt('/bookings')
      // The list is read before the booking is cancelled
      const before = linesIn(await listNamed('これからの予約')).map((lines) =>
        lines.at(-1),
      )
      await userEvent.click(
        within(await listNamed('これからの予約'))
          .getAllByRole('link')
          .at(-1) ?? document.body,
      )
      await userEvent.click(await cancelButton())

      // Act
      await userEvent.click(confirmButton())
      await screen.findByText('予約をキャンセルしました。')
      await userEvent.click(screen.getByRole('link', { name: '予約の一覧へ' }))

      // Assert: the list as it was read before is not shown, not even in
      // the commit that shows the screen
      const list = await listNamed('これからの予約')
      expectListReadAnew()
      expect(linesIn(list).map((lines) => lines.at(-1))).toEqual([
        '確定待ち',
        '確定待ち',
        'キャンセル',
      ])
      expect(before).toEqual(['確定待ち', '確定待ち', '確定待ち'])
      expect(address()).toBe('/bookings')
      expect(await rowOf(id)).toMatchObject({ status: 'cancelled' })
    })

    it('should say on the page that the booking could not be cancelled when the salon began it in the meantime, close the dialog and show the booking as it is', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber } = await book()
      renderAt(`/bookings/${id}`)
      await userEvent.click(await cancelButton())
      await testApi().query(
        `update bookings set status = 'in_progress', "actualStartTime" = now() where id = $1`,
        [id],
      )

      // Act
      await userEvent.click(confirmButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'この予約は、キャンセルできませんでした。サロンが予約の状態を変えたか、開始時刻を過ぎています。予約の内容を読み込み直しましたので、お確かめください。',
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      const details = screen.getByRole('region', {
        name: `予約番号 ${bookingNumber}`,
      })
      expect(await within(details).findByText('施術中')).toBeVisible()
      expect(await heading('予約の内容')).toHaveFocus()
      expect(
        screen.queryByRole('button', { name: '予約をキャンセルする' }),
      ).toBeNull()
      expect(statusMessages()).not.toContain('予約をキャンセルしました。')
      expect(await rowOf(id)).toMatchObject({ status: 'in_progress' })
    })

    it('should say in the dialog that the cancellation was not sent, keep the dialog and the reason, and cancel when it is sent again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book()
      renderAt(`/bookings/${id}`)
      const user = userEvent.setup()
      await user.click(await cancelButton())
      await user.type(
        within(dialog()).getByRole('textbox', { name: 'キャンセルの理由' }),
        '体調がすぐれません',
      )
      await takeAway('booking_status_histories')

      // Act
      await user.click(confirmButton())

      // Assert
      expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(dialog()).toHaveAttribute('open')
      expect(await rowOf(id)).toMatchObject({ status: 'pending' })

      // Act
      await giveBack('booking_status_histories')
      await user.click(confirmButton())

      // Assert
      expect(
        await screen.findByText('予約をキャンセルしました。'),
      ).toBeVisible()
      expect(await rowOf(id)).toMatchObject({
        status: 'cancelled',
        cancellationReason: '体調がすぐれません',
      })
    })

    it('should say nothing of an attempt before when the dialog is opened again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book()
      renderAt(`/bookings/${id}`)
      await userEvent.click(await cancelButton())
      await takeAway('booking_status_histories')
      await userEvent.click(confirmButton())
      await within(dialog()).findByRole('alert')
      await giveBack('booking_status_histories')
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )

      // Act
      await userEvent.click(await cancelButton())

      // Assert
      expect(dialog()).toHaveAttribute('open')
      expect(within(dialog()).queryByRole('alert')).toBeNull()
    })

    it('should say that the booking is not found when it went while the dialog asked', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book()
      renderAt(`/bookings/${id}`)
      await userEvent.click(await cancelButton())
      await testApi().query(
        `update bookings set "customerId" = (select id from customers where email = $2) where id = $1`,
        [id, ANOTHER_CUSTOMER],
      )

      // Act
      await userEvent.click(confirmButton())

      // Assert
      expect(await heading('予約が見つかりません')).toHaveFocus()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await rowOf(id)).toMatchObject({ status: 'pending' })
    })
  })

  describe('moving a booking', () => {
    it('should ask somebody who is not signed in to sign in', async () => {
      // Arrange
      const { id } = await book()

      // Act
      renderAt(`/bookings/${id}/reschedule`)

      // Assert
      expect(
        await screen.findByText(
          '予約の日時を変更するには、サインインしてください。',
        ),
      ).toBeVisible()
    })

    it('should lead from the page of a booking to the screen that moves it, which opens with its member of the staff and its day', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber, date } = await book()
      renderAt(`/bookings/${id}`)

      // Act
      await userEvent.click(
        await screen.findByRole('link', { name: '日時を変更する' }),
      )

      // Assert
      expect(await heading('日時の変更')).toHaveFocus()
      expect(document.title).toBe(`日時の変更 | ${TITLE}`)
      expect(address()).toBe(
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )
      expect(await staffControl()).toHaveValue(await staffId(MIKA))
      expect(screen.getByLabelText('日付')).toHaveValue(date)
      expect(
        detailsIn(
          screen.getByRole('region', { name: `予約番号 ${bookingNumber}` }),
        ),
      ).toMatchObject({ サロン: TOKYO, メニュー: LADIES_CUT, 担当: MIKA })
      expect(
        screen.getByRole('link', { name: '予約の内容へ戻る' }),
      ).toHaveAttribute('href', `/bookings/${id}`)
    })

    it('should offer the times that are free for a visit as long as the booking, without those its own time takes, and say so', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, date } = await book()

      // Act
      renderAt(
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )

      // Assert: this booking takes Mika from 11:30 to 12:30, and she keeps
      // a quarter of an hour free before and after a visit: 10:30 would end
      // when that quarter begins
      expect(await offeredTimes()).toEqual(['10:00'])
      expect(
        screen.getByText(
          'いまの予約の時間と重なる時刻は、空いている時刻に表示されないことがあります。',
        ),
      ).toBeVisible()
      // The booking waits for the salon: nothing is said about a confirmation
      expect(screen.queryByText(/確定しています/)).toBeNull()
      expect(screen.queryByRole('textbox', { name: 'ご要望' })).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should move the booking to the time that was chosen, say so, and show it on its page', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber, date } = await book()
      renderAt(
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )
      await offeredTimes()

      // Act
      await userEvent.click(time('10:00'))
      await userEvent.click(moveButton())

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(address()).toBe(`/bookings/${id}`)
      expect(statusMessages()).toContain('予約の日時を変更しました。')
      expect(
        detailsIn(
          screen.getByRole('region', { name: `予約番号 ${bookingNumber}` }),
        ),
      ).toMatchObject({
        担当: MIKA,
        日時: `${day(momentAt(date, '10:00'))} 10:00〜11:00（1 時間）`,
      })
      expect(await rowOf(id)).toMatchObject({
        status: 'pending',
        startTime: momentAt(date, '10:00'),
        staff: MIKA,
      })
    })

    it('should show the booking at its new time the moment the list is shown again, and never as it was read before', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, date } = await book()
      renderAt('/bookings')
      // The list is read before the booking is moved
      await userEvent.click(
        within(await listNamed('これからの予約'))
          .getAllByRole('link')
          .at(-1) ?? document.body,
      )
      await userEvent.click(
        await screen.findByRole('link', { name: '日時を変更する' }),
      )
      await offeredTimes()

      // Act
      await userEvent.click(time('10:00'))
      await userEvent.click(moveButton())
      // The page of the booking, which the move leads to, has the link
      await userEvent.click(
        await screen.findByRole('link', { name: '予約の一覧へ' }),
      )

      // Assert: the list as it was read before is not shown, not even in
      // the commit that shows the screen
      const list = await listNamed('これからの予約')
      expectListReadAnew()
      expect(linesIn(list).at(-1)?.at(0)).toBe(
        whenOf({
          startTime: momentAt(date, '10:00'),
          endTime: momentAt(date, '11:00'),
        }),
      )
      expect(await rowOf(id)).toMatchObject({
        startTime: momentAt(date, '10:00'),
      })
    })

    it('should move the booking to another member of the staff, and to whoever is free when nobody is asked for', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber, date } = await book()
      renderAt(
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )
      const user = userEvent.setup()

      // Act
      await user.selectOptions(await staffControl(), HIROSHI)

      // Assert: Hiroshi is free all morning
      expect(await screen.findByRole('radio', { name: '12:00' })).toBeVisible()
      expect(await offeredTimes()).toEqual([
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '12:00',
      ])
      expect(address()).toBe(
        `/bookings/${id}/reschedule?staffId=${await staffId(HIROSHI)}&date=${date}`,
      )

      // Act
      await user.click(time('12:00'))
      await user.click(moveButton())

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(
        detailsIn(
          screen.getByRole('region', { name: `予約番号 ${bookingNumber}` }),
        ),
      ).toMatchObject({
        担当: HIROSHI,
        日時: `${day(momentAt(date, '12:00'))} 12:00〜13:00（1 時間）`,
      })
      expect(await rowOf(id)).toMatchObject({
        startTime: momentAt(date, '12:00'),
        staff: HIROSHI,
      })
    })

    it('should say before the move that a confirmed booking will wait for the salon again, and show it as waiting afterwards', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber, date } = await book()
      await testApi().query(
        `update bookings set status = 'confirmed' where id = $1`,
        [id],
      )
      renderAt(
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )
      await offeredTimes()

      // Assert
      expect(statusMessages()).toContain(
        'この予約は確定しています。日時を変更すると「確定待ち」に戻り、サロンが内容を確認すると、あらためて確定します。',
      )
      expect(
        detailsIn(
          screen.getByRole('region', { name: `予約番号 ${bookingNumber}` }),
        ),
      ).toMatchObject({ 状態: '確定' })

      // Act
      await userEvent.click(time('10:00'))
      await userEvent.click(moveButton())

      // Assert
      expect(await heading('予約の内容')).toHaveFocus()
      expect(
        detailsIn(
          screen.getByRole('region', { name: `予約番号 ${bookingNumber}` }),
        ),
      ).toMatchObject({
        状態: '確定待ちサロンが内容を確認すると、予約が確定します。',
        日時: `${day(momentAt(date, '10:00'))} 10:00〜11:00（1 時間）`,
      })
      expect(await rowOf(id)).toMatchObject({ status: 'pending' })
    })

    it('should ask for a time when the form is sent without one, at the times, and move nothing', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, date } = await book()
      renderAt(
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )
      await offeredTimes()

      // Act
      await userEvent.click(moveButton())

      // Assert
      expect(
        screen.getByRole('radiogroup', { name: '開始時刻' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining('開始時刻を選択してください。'),
      )
      expect(time('10:00')).toHaveFocus()
      expect(await rowOf(id)).toMatchObject({
        startTime: momentAt(date, '11:30'),
      })
    })

    it('should say that the booking could not be moved when somebody took the time first, read the times again and keep the choice', async () => {
      // Arrange: Mika serves one customer at a time, and 10:00 is the one
      // time she has left
      await signedInAs(CUSTOMER)
      const { id, date } = await book()
      const path = `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`
      renderAt(path)
      const offeredAtFirst = await offeredTimes()
      await userEvent.click(time('10:00'))
      await bookThroughApi(ANOTHER_CUSTOMER, {
        staff: MIKA,
        startTime: momentAt(date, '10:00'),
        customerRequest: null,
      })

      // Act
      await userEvent.click(moveButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'この日時には、変更できませんでした。空いている時刻を読み込み直しましたので、選び直してください。変更できない状態が続くときは、サロンにお問い合わせください。',
      )
      expect(offeredAtFirst).toEqual(['10:00'])
      expect(
        await screen.findByText('この日は、予約できる時刻がありません'),
      ).toBeVisible()
      expect(screen.queryByRole('radiogroup', { name: '開始時刻' })).toBeNull()
      expect(await staffControl()).toHaveValue(await staffId(MIKA))
      expect(address()).toBe(path)
      expect(await rowOf(id)).toMatchObject({
        startTime: momentAt(date, '11:30'),
        staff: MIKA,
      })
    })

    it('should say that a booking with two services is the salon to move, and show no form', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber } = await stored('upcoming', OSAKA, 'pending')

      // Act
      renderAt(`/bookings/${id}/reschedule`)

      // Assert
      expect(
        await screen.findByText(
          'この予約は、この画面から日時を変更できません。日時の変更は、サロンにお問い合わせください。',
        ),
      ).toBeVisible()
      expect(statusMessages()).toContain(
        'この予約は、この画面から日時を変更できません。日時の変更は、サロンにお問い合わせください。',
      )
      expect(
        screen.getByRole('region', { name: `予約番号 ${bookingNumber}` }),
      ).toBeVisible()
      expect(screen.queryByRole('combobox', { name: 'スタッフ' })).toBeNull()
    })

    it('should say that a booking that was cancelled cannot be moved, and show no form', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await stored('past', TOKYO, 'cancelled')

      // Act
      renderAt(`/bookings/${id}/reschedule`)

      // Assert
      expect(
        await screen.findByText(
          'この予約は、日時を変更できません。キャンセルした予約と、開始時刻を過ぎた予約は、変更できません。',
        ),
      ).toBeVisible()
      expect(statusMessages()).toContain(
        'この予約は、日時を変更できません。キャンセルした予約と、開始時刻を過ぎた予約は、変更できません。',
      )
      expect(screen.queryByRole('combobox', { name: 'スタッフ' })).toBeNull()
      expect(
        screen.getByRole('link', { name: '予約の内容へ戻る' }),
      ).toHaveAttribute('href', `/bookings/${id}`)
    })

    it.each([
      ['an ID that names nothing', async () => NOTHING],
      [
        'a booking of another customer',
        async () =>
          (
            await bookThroughApi(ANOTHER_CUSTOMER, {
              staff: MIKA,
              startTime: momentAt(await openDay({ [MIKA]: '10:00' }), '10:00'),
              customerRequest: null,
            })
          ).id,
      ],
      ['what is no ID', async () => 'my-booking'],
    ])(
      'should say that there is no such booking for %s',
      async (_case, idOf) => {
        // Arrange
        await signedInAs(CUSTOMER)

        // Act
        renderAt(`/bookings/${await idOf()}/reschedule`)

        // Assert
        expect(await heading('予約が見つかりません')).toBeVisible()
        expect(
          screen.getByRole('link', { name: '予約の一覧へ' }),
        ).toHaveAttribute('href', '/bookings')
      },
    )

    it('should say that what the booking names could not be read, and show the form when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, date } = await book()
      await takeAway('opening_hours')
      renderAt(
        `/bookings/${id}/reschedule?staffId=${await staffId(MIKA)}&date=${date}`,
      )

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '予約の内容を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )

      // Act
      await giveBack('opening_hours')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(await offeredTimes()).toEqual(['10:00'])
    })

    it('should offer every time at which somebody is free when the address names nobody', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, date } = await book()

      // Act
      renderAt(`/bookings/${id}/reschedule?date=${date}`)

      // Assert: with nobody asked for, every time at which somebody is free
      expect(await offeredTimes()).toEqual([
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '12:00',
      ])
      expect(await staffControl()).toHaveValue('')
      // Whom the form offers: those who take bookings and have the level
      // of the service, as on the screen that books
      expect(optionsOf(await staffControl())).toEqual([
        '指名しない',
        HIROSHI,
        MIKA,
      ])
    })

    it('should read the booking again when the screen that moves it opens, with what the application keeps: a booking the salon confirmed meanwhile is said to be confirmed', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book()
      renderAt(`/bookings/${id}`, { client: asTheApplicationKeeps() })
      const move = await screen.findByRole('link', { name: '日時を変更する' })
      await testApi().query(
        `update bookings set status = 'confirmed' where id = $1::uuid`,
        [id],
      )

      // Act
      await userEvent.click(move)

      // Assert
      expect(
        await screen.findByText(/^この予約は確定しています。/),
      ).toBeVisible()
    })
  })
})
