import { applications } from '@beauty-salon-frontend/brand'
import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  giveBack,
  salonIdOf,
  takeAway,
  testApi,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  asTheApplicationKeeps,
  heading,
  optionsOf,
  statusMessages,
} from '@beauty-salon-frontend/testing/screens'
import { CUSTOMER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { renderAt } from '../../__tests__/screens'
import {
  ANOTHER_CUSTOMER,
  accessTokenOf,
  ask,
  bookingPathOf,
  bookThroughApi,
  closeDay,
  DAYS_AHEAD,
  dayAhead,
  HIROSHI,
  LADIES_CUT,
  MIKA,
  momentAt,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  NOTHING,
  openDay,
  registerNewcomer,
  serviceId,
  signedInAs,
  staffId,
} from '../__tests__/arrangements'

const TITLE = applications.portal.name

// --- The controls of the booking screen

const staffControl = () => screen.findByRole('combobox', { name: 'スタッフ' })
const dateControl = () => screen.getByLabelText('日付')
const requestControl = () => screen.getByRole('textbox', { name: 'ご要望' })
const sendButton = () =>
  screen.getByRole('button', { name: 'この内容で予約する' })

/** The times on offer, as they are labelled. */
const offeredTimes = async (): Promise<(string | null | undefined)[]> =>
  within(await screen.findByRole('radiogroup', { name: '開始時刻' }))
    .getAllByRole('radio')
    .map((time) => time.closest('label')?.textContent)

const time = (label: string) => screen.getByRole('radio', { name: label })

/** The names and the values of a record, as a description list shows them. */
/** How a page in Japanese writes a day of the calendar in full: 「2026年12月9日水曜日」. */
const fullDay = (date: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))

const detailsIn = (region: HTMLElement): Record<string, string | null> =>
  Object.fromEntries(
    within(region)
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )

describe('the screens of a booking, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('the way from the page of a salon', () => {
    it('should lead from a service of the menu to the screen where it is booked', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt(`/salons/${await salonIdOf(TOKYO)}`)
      const menu = await screen.findByRole('region', { name: 'メニュー' })

      // Act
      await userEvent.click(
        await within(menu).findByRole('link', {
          name: `${LADIES_CUT}を予約する`,
        }),
      )

      // Assert
      expect(await heading('予約する')).toHaveFocus()
      expect(address()).toBe(await bookingPathOf())
    })

    it('should offer no booking of a service that cannot be booked online, and none at a salon that takes no bookings', async () => {
      // Arrange
      const path = `/salons/${await salonIdOf(TOKYO)}`
      const first = renderAt(path)
      const menu = await screen.findByRole('region', { name: 'メニュー' })
      await within(menu).findByRole('link', {
        name: `${LADIES_CUT}を予約する`,
      })

      // Assert
      expect(
        within(menu).queryByRole('link', { name: 'Balayageを予約する' }),
      ).toBeNull()

      // Act
      first.unmount()
      await testApi().query(
        'update salons set "isActive" = false where name = $1',
        [TOKYO],
      )
      renderAt(path)

      // Assert
      await within(
        await screen.findByRole('region', { name: 'メニュー' }),
      ).findByRole('list', { name: 'Hair Cut' })
      expect(screen.queryByRole('link', { name: /を予約する$/ })).toBeNull()
    })
  })

  describe('the booking screen', () => {
    it('should ask somebody who is not signed in to sign in, at the address of what they chose, and go on with it', async () => {
      // Arrange
      const date = await openDay({ [HIROSHI]: '10:00' })
      const path = `${await bookingPathOf()}?date=${date}`
      renderAt(path)

      // Assert
      expect(
        await screen.findByText('予約するには、サインインしてください。'),
      ).toBeVisible()
      expect(address()).toBe(path)

      // Act
      const user = userEvent.setup()
      await user.type(
        screen.getByRole('textbox', { name: 'メールアドレス' }),
        CUSTOMER,
      )
      await user.type(
        screen.getByLabelText('パスワード'),
        testApi().seedPassword,
      )
      await user.click(screen.getByRole('button', { name: 'サインイン' }))

      // Assert
      expect(await heading('予約する')).toBeVisible()
      expect(document.title).toBe(`予約する | ${TITLE}`)
      expect(address()).toBe(path)
      expect(await offeredTimes()).toEqual([
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '12:00',
      ])
    })

    it('should tell an account of the staff of a salon that the screen is not for it', async () => {
      // Arrange
      await signedInAs(STYLIST)

      // Act
      renderAt(await bookingPathOf())

      // Assert
      expect(
        await screen.findByText(
          'stylist1@beautysalon.jp のアカウントでは利用できません。利用できるアカウントでサインインし直してください。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('combobox', { name: 'スタッフ' })).toBeNull()
    })

    it('should say what is booked: the salon, the service, how long it takes and what it costs', async () => {
      // Arrange
      await signedInAs(CUSTOMER)

      // Act
      renderAt(await bookingPathOf())

      // Assert
      expect(
        detailsIn(await screen.findByRole('region', { name: 'ご予約の内容' })),
      ).toEqual({
        サロン: TOKYO,
        メニュー: LADIES_CUT,
        所要時間: '1 時間',
        料金: '￥5,500（税込）',
      })
      expect(
        screen.getByRole('link', { name: 'サロンのページへ戻る' }),
      ).toHaveAttribute('href', `/salons/${await salonIdOf(TOKYO)}`)
      // The screen was opened by its address, by a customer who has a
      // profile: the focus is where the browser put it
      await staffControl()
      expect(document.body).toHaveFocus()
    })

    it('should offer the members of the staff who take bookings and have the level of the service, after nobody in particular', async () => {
      // Arrange
      await signedInAs(CUSTOMER)

      // Act: the cut asks for a stylist
      const first = renderAt(await bookingPathOf())
      const namesOf = async (): Promise<(string | null)[]> =>
        optionsOf(await staffControl())

      // Assert: a junior does not cut, and the directors take no bookings;
      // the names are in their order
      expect(await namesOf()).toEqual(['指名しない', HIROSHI, MIKA])
      expect(await staffControl()).toHaveValue('')

      // Act
      first.unmount()
      renderAt(await bookingPathOf('Kids Cut (Under 12)'))

      // Assert: a cut for children asks for no level
      expect(await namesOf()).toEqual([
        '指名しない',
        HIROSHI,
        MIKA,
        'Yui Watanabe',
      ])
    })

    it('should start from today at the salon, and keep the day and the member of the staff in the address when they are chosen', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const path = await bookingPathOf()
      const today = await dayAhead(0)
      const tomorrow = await dayAhead(1)
      renderAt(path)
      const user = userEvent.setup()
      await staffControl()

      // Assert
      expect(dateControl()).toHaveValue(today)
      expect(dateControl()).toHaveAttribute('min', today)
      expect(screen.getByRole('button', { name: '前の日' })).toBeDisabled()
      expect(address()).toBe(path)

      // Act
      await user.click(screen.getByRole('button', { name: '次の日' }))

      // Assert
      expect(dateControl()).toHaveValue(tomorrow)
      expect(address()).toBe(`${path}?date=${tomorrow}`)
      expect(screen.getByRole('button', { name: '次の日' })).toHaveFocus()

      // Act
      await user.selectOptions(await staffControl(), MIKA)

      // Assert
      expect(address()).toBe(
        `${path}?staffId=${await staffId(MIKA)}&date=${tomorrow}`,
      )
      expect(await staffControl()).toHaveFocus()

      // Act
      await user.click(screen.getByRole('button', { name: '前の日' }))

      // Assert
      expect(dateControl()).toHaveValue(today)
      expect(await staffControl()).toHaveValue(await staffId(MIKA))
    })

    it('should show the day of a date that is typed, and leave the day as it is for a date that has passed', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const path = await bookingPathOf()
      const date = await openDay({ [HIROSHI]: '11:00' })
      renderAt(path)
      await staffControl()

      // Act
      fireEvent.change(dateControl(), { target: { value: date } })

      // Assert
      expect(address()).toBe(`${path}?date=${date}`)
      expect(await offeredTimes()).toEqual(['11:00', '11:30', '12:00'])

      // Act
      fireEvent.change(dateControl(), {
        target: { value: await dayAhead(-1) },
      })

      // Assert
      expect(address()).toBe(`${path}?date=${date}`)
      expect(dateControl()).toHaveValue(date)
    })

    it('should take today for a date of the address that has passed or is none, and nobody in particular for a member of the staff who cannot be asked for', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const today = await dayAhead(0)

      // Act
      const first = renderAt(
        `${await bookingPathOf()}?staffId=${await staffId('Yui Watanabe')}&date=${await dayAhead(-3)}`,
      )

      // Assert
      expect(await staffControl()).toHaveValue('')
      expect(dateControl()).toHaveValue(today)

      // Act
      first.unmount()
      renderAt(`${await bookingPathOf()}?staffId=nobody&date=tomorrow`)

      // Assert
      expect(await staffControl()).toHaveValue('')
      expect(dateControl()).toHaveValue(today)
    })

    it('should list a time once when several are free then, and the times of one member of the staff when they are asked for', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00', [MIKA]: '11:30' })
      renderAt(`${await bookingPathOf()}?date=${date}`)

      // Assert
      expect(await offeredTimes()).toEqual([
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '12:00',
      ])
      expect(
        screen.getByRole('radiogroup', { name: '開始時刻' }),
      ).toHaveAccessibleDescription(
        `${new Intl.DateTimeFormat('ja-JP', {
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${date}T00:00:00Z`))}（${new Intl.DateTimeFormat(
          'ja-JP',
          {
            weekday: 'short',
            timeZone: 'UTC',
          },
        ).format(
          new Date(`${date}T00:00:00Z`),
        )}）の、空いている時刻です。時刻は、サロンのある地域の時刻です。`,
      )

      // Act
      await userEvent.selectOptions(await staffControl(), MIKA)

      // Assert
      await screen.findByText('空いている時刻を読み込んでいます')
      expect(await offeredTimes()).toEqual(['11:30', '12:00'])
    })

    it('should say that the day has no time, offer no button, and keep what was written for the salon', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const date = await closeDay()
      renderAt(
        `${await bookingPathOf()}?date=${await dayAhead(DAYS_AHEAD - 1)}`,
      )
      const user = userEvent.setup()
      await staffControl()
      await user.type(requestControl(), '静かな席を希望します')

      // Act
      fireEvent.change(dateControl(), { target: { value: date } })

      // Assert
      expect(
        await screen.findByText('この日は、予約できる時刻がありません'),
      ).toBeVisible()
      expect(
        screen.getByText('日付かスタッフを変えて、お探しください。'),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'この内容で予約する' }),
      ).toBeNull()
      expect(screen.queryByRole('radiogroup')).toBeNull()
      expect(requestControl()).toHaveValue('静かな席を希望します')
    })

    it('should ask for a time when the form is sent without one, at the times, and book nothing', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00' })
      renderAt(`${await bookingPathOf()}?date=${date}`)
      await offeredTimes()

      // Act
      await userEvent.click(sendButton())

      // Assert
      const times = screen.getByRole('radiogroup', { name: '開始時刻' })
      expect(times).toHaveAttribute('aria-invalid', 'true')
      expect(times).toHaveAccessibleDescription(
        expect.stringContaining('開始時刻を選択してください。'),
      )
      expect(time('10:00')).toHaveFocus()
      expect(
        await testApi().query(
          `select id from bookings where "bookingDate" = $1::date`,
          [date],
        ),
      ).toEqual([])
    })

    it('should book the time for the customer with whoever is free, show the booking and say that it was taken', async () => {
      // Arrange: at 10:00 one member of the staff works
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00', [MIKA]: '11:00' })
      renderAt(`${await bookingPathOf()}?date=${date}`)
      const user = userEvent.setup()
      await offeredTimes()

      // Act
      await user.click(time('10:00'))
      await user.type(requestControl(), '  前髪は短めにお願いします  ')
      await user.click(sendButton())

      // Assert: the page of the booking shows what the API answered the
      // booking with, in the commit that shows the page
      expect(await heading('予約の内容')).toHaveFocus()
      expect(
        screen.getByRole('region', { name: /^予約番号 BK-/ }),
      ).toBeVisible()
      expect(statusMessages()).toContain('予約を受け付けました。')
      const [booked] = z
        .tuple([
          z.object({
            id: z.uuid(),
            bookingNumber: z.string(),
            status: z.string(),
            source: z.string(),
            staff: z.string(),
            customer: z.string(),
            startTime: z.string(),
            customerRequest: z.string(),
          }),
        ])
        .parse(
          await testApi().query(
            `select bookings.id::text, bookings."bookingNumber", bookings.status::text, bookings.source::text,
                    staff."displayName" as staff, customers.email as customer,
                    to_char(bookings."startTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "startTime",
                    bookings."customerRequest"
             from bookings
             join staff on staff.id = bookings."staffId"
             join customers on customers.id = bookings."customerId"
             where bookings."bookingDate" = $1::date`,
            [date],
          ),
        )
      expect(booked).toMatchObject({
        status: 'pending',
        source: 'online',
        staff: HIROSHI,
        customer: CUSTOMER,
        startTime: momentAt(date, '10:00'),
        customerRequest: '前髪は短めにお願いします',
      })
      expect(address()).toBe(`/bookings/${booked.id}`)
      expect(
        detailsIn(
          await screen.findByRole('region', {
            name: `予約番号 ${booked.bookingNumber}`,
          }),
        ),
      ).toEqual({
        状態: '確定待ちサロンが内容を確認すると、予約が確定します。',
        サロン: TOKYO,
        メニュー: LADIES_CUT,
        担当: HIROSHI,
        日時: `${new Intl.DateTimeFormat('ja-JP', {
          dateStyle: 'full',
          timeZone: 'Asia/Tokyo',
        }).format(new Date(momentAt(date, '10:00')))} 10:00〜11:00（1 時間）`,
        料金: '￥5,500',
        ご要望: '前髪は短めにお願いします',
      })
    })

    it('should book with the member of the staff who was asked for, and without a request when none is written', async () => {
      // Arrange: at 11:00 two members of the staff are free
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00', [MIKA]: '10:00' })
      renderAt(
        `${await bookingPathOf()}?staffId=${await staffId(MIKA)}&date=${date}`,
      )
      const user = userEvent.setup()
      await offeredTimes()

      // Act
      await user.click(time('11:00'))
      await user.click(sendButton())

      // Assert
      await heading('予約の内容')
      expect(
        await testApi().query(
          `select staff."displayName" as staff, bookings."customerRequest"
           from bookings join staff on staff.id = bookings."staffId"
           where bookings."bookingDate" = $1::date`,
          [date],
        ),
      ).toEqual([{ staff: MIKA, customerRequest: null }])
      expect(
        detailsIn(await screen.findByRole('region', { name: /^予約番号 / })),
      ).toMatchObject({ 担当: MIKA, ご要望: '記録なし' })
    })

    it('should say that the time could not be booked when somebody took it first, read the times again and keep the rest', async () => {
      // Arrange: one member of the staff, who serves one customer at a time
      await signedInAs(CUSTOMER)
      const date = await openDay({ [MIKA]: '10:00' })
      renderAt(`${await bookingPathOf()}?date=${date}`)
      const user = userEvent.setup()
      expect(await offeredTimes()).toContain('10:00')
      await user.type(requestControl(), '相談したいことがあります')
      await user.click(time('10:00'))
      await bookThroughApi(ANOTHER_CUSTOMER, {
        staff: MIKA,
        startTime: momentAt(date, '10:00'),
        customerRequest: null,
      })

      // Act
      await user.click(sendButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'この日時では、予約できませんでした。空いている時刻を読み込み直しましたので、選び直してください。予約できない状態が続くときは、サロンにお問い合わせください。',
      )
      await waitFor(async () =>
        expect(await offeredTimes()).not.toContain('10:00'),
      )
      expect(requestControl()).toHaveValue('相談したいことがあります')
      expect(dateControl()).toHaveValue(date)
      expect(
        await testApi().query(
          `select customers.email from bookings join customers on customers.id = bookings."customerId"
           where bookings."bookingDate" = $1::date`,
          [date],
        ),
      ).toEqual([{ email: ANOTHER_CUSTOMER }])
    })

    it('should read the times of a day again when the day is shown again, and not show them from memory', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const date = await openDay({ [MIKA]: '10:00' })
      renderAt(`${await bookingPathOf()}?date=${date}`)
      const user = userEvent.setup()
      expect(await offeredTimes()).toContain('10:00')
      await bookThroughApi(ANOTHER_CUSTOMER, {
        staff: MIKA,
        startTime: momentAt(date, '10:00'),
        customerRequest: null,
      })

      // Act
      await user.click(screen.getByRole('button', { name: '次の日' }))
      await user.click(screen.getByRole('button', { name: '前の日' }))

      // Assert: nothing of the day is on the screen until it was read
      expect(screen.queryByRole('radio', { name: '10:00' })).toBeNull()
      expect(await offeredTimes()).not.toContain('10:00')
    })

    it('should drop what was said about a time when another day is chosen', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00' })
      renderAt(`${await bookingPathOf()}?date=${date}`)
      const user = userEvent.setup()
      await offeredTimes()
      await user.click(sendButton())
      expect(
        screen.getByRole('radiogroup', { name: '開始時刻' }),
      ).toHaveAttribute('aria-invalid', 'true')

      // Act
      await user.click(screen.getByRole('button', { name: '前の日' }))
      await user.click(screen.getByRole('button', { name: '次の日' }))

      // Assert
      await offeredTimes()
      expect(
        screen.getByRole('radiogroup', { name: '開始時刻' }),
      ).not.toHaveAttribute('aria-invalid')
    })

    it('should ask an account without a profile who the customer is, say what is missing, and go on to the times with the profile', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      const date = await openDay({ [HIROSHI]: '10:00' })
      renderAt(`${await bookingPathOf()}?date=${date}`)
      const user = userEvent.setup()
      const profile = await screen.findByRole('region', {
        name: 'お客様の情報',
      })
      expect(screen.queryByRole('combobox', { name: 'スタッフ' })).toBeNull()

      // Act: nothing is filled in
      await user.click(
        within(profile).getByRole('button', {
          name: '登録して、日時の選択へ進む',
        }),
      )

      // Assert
      const lastName = within(profile).getByRole('textbox', { name: '姓' })
      expect(lastName).toHaveFocus()
      expect(lastName).toHaveAccessibleDescription('姓を入力してください。')
      expect(
        within(profile).getByRole('textbox', { name: '名' }),
      ).toHaveAccessibleDescription('名を入力してください。')
      expect(
        within(profile).getByRole('textbox', { name: '電話番号' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining('電話番号を入力してください。'),
      )
      expect(
        await testApi().query('select id from customers where email = $1', [
          NEWCOMER,
        ]),
      ).toEqual([])

      // Act: sent with the Enter key in the telephone number
      await user.type(lastName, '山田')
      await user.type(
        within(profile).getByRole('textbox', { name: '名' }),
        '花子',
      )
      await user.click(
        within(profile).getByRole('checkbox', {
          name: 'メールでの連絡を受け取る',
        }),
      )
      await user.type(
        within(profile).getByRole('textbox', { name: '電話番号' }),
        '090-5550-0199{Enter}',
      )

      // Assert
      expect(await offeredTimes()).toContain('10:00')
      expect(screen.queryByRole('region', { name: 'お客様の情報' })).toBeNull()
      // The form went with the button that sent it: the heading of the
      // screen has the focus
      expect(await heading('予約する')).toHaveFocus()
      expect(
        await testApi().query(
          `select customers."lastName", customers."firstName", customers."phoneNumber",
                  customers."allowEmail", customers."allowSms", customers."allowMarketing",
                  users.email as account
           from customers join users on users."customerId" = customers.id
           where customers.email = $1`,
          [NEWCOMER],
        ),
      ).toEqual([
        {
          lastName: '山田',
          firstName: '花子',
          phoneNumber: '090-5550-0199',
          allowEmail: true,
          allowSms: false,
          allowMarketing: false,
          account: NEWCOMER,
        },
      ])
    })

    it('should say at the control that a phone number is none, and create no profile', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      renderAt(await bookingPathOf())
      const user = userEvent.setup()
      const profile = await screen.findByRole('region', {
        name: 'お客様の情報',
      })

      // Act
      await user.type(
        within(profile).getByRole('textbox', { name: '姓' }),
        '山田',
      )
      await user.type(
        within(profile).getByRole('textbox', { name: '名' }),
        '花子',
      )
      await user.type(
        within(profile).getByRole('textbox', { name: '電話番号' }),
        '12345',
      )
      await user.click(
        within(profile).getByRole('button', {
          name: '登録して、日時の選択へ進む',
        }),
      )

      // Assert
      const phoneNumber = within(profile).getByRole('textbox', {
        name: '電話番号',
      })
      expect(phoneNumber).toHaveFocus()
      expect(phoneNumber).toHaveAccessibleDescription(
        expect.stringContaining(
          '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
        ),
      )
      expect(
        await testApi().query('select id from customers where email = $1', [
          NEWCOMER,
        ]),
      ).toEqual([])
    })

    it('should say that the profile could not be created when the account got one in the meantime', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      renderAt(await bookingPathOf())
      const user = userEvent.setup()
      const profile = await screen.findByRole('region', {
        name: 'お客様の情報',
      })
      const created = await ask(
        '/customers/me',
        {
          lastName: '山田',
          firstName: '花子',
          phoneNumber: '090-5550-0199',
          lastNameKana: null,
          firstNameKana: null,
          alternativePhone: null,
          postalCode: null,
          prefecture: null,
          city: null,
          address: null,
          building: null,
          birthDate: null,
          gender: null,
          occupation: null,
          preferences: null,
          allowEmail: false,
          allowSms: false,
          allowMarketing: false,
        },
        await accessTokenOf(NEWCOMER, NEWCOMER_PASSWORD),
      )
      expect(created.status).toBe(201)

      // Act
      await user.type(
        within(profile).getByRole('textbox', { name: '姓' }),
        '山田',
      )
      await user.type(
        within(profile).getByRole('textbox', { name: '名' }),
        '花子',
      )
      await user.type(
        within(profile).getByRole('textbox', { name: '電話番号' }),
        '090-5550-0199',
      )
      await user.click(
        within(profile).getByRole('button', {
          name: '登録して、日時の選択へ進む',
        }),
      )

      // Assert
      expect(await within(profile).findByRole('alert')).toHaveTextContent(
        'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
      )
    })

    it('should say of a service that cannot be booked online, and of a salon that takes no bookings, that the salon is to be asked', async () => {
      // Arrange
      await signedInAs(CUSTOMER)

      // Act
      const first = renderAt(await bookingPathOf('Balayage'))

      // Assert
      expect(
        await screen.findByText(/この画面からは予約できません/),
      ).toHaveTextContent(
        '「Balayage」は、この画面からは予約できません。ご予約は、サロンへお問い合わせください。',
      )
      expect(screen.queryByRole('region', { name: 'ご予約の内容' })).toBeNull()

      // Act
      first.unmount()
      await testApi().query(
        'update salons set "isActive" = false where name = $1',
        [TOKYO],
      )
      renderAt(await bookingPathOf())

      // Assert
      expect(
        await screen.findByText(/この画面からは予約できません/),
      ).toHaveTextContent(
        `「${LADIES_CUT}」は、この画面からは予約できません。ご予約は、サロンへお問い合わせください。`,
      )
      expect(screen.queryByRole('combobox', { name: 'スタッフ' })).toBeNull()
    })

    it.each([
      {
        of: 'a service the salon does not have',
        path: async () =>
          `/salons/${await salonIdOf(TOKYO)}/services/${NOTHING}/booking`,
      },
      {
        of: 'a salon that does not exist',
        path: async () =>
          `/salons/${NOTHING}/services/${await serviceId(LADIES_CUT)}/booking`,
      },
      {
        of: 'an address that names no ID',
        path: async () => '/salons/tokyo/services/cut/booking',
      },
    ])('should say of $of that there is nothing to book', async ({ path }) => {
      // Arrange
      await signedInAs(CUSTOMER)

      // Act
      renderAt(await path())

      // Assert
      expect(await heading('予約できるメニューが見つかりません')).toBeVisible()
      expect(
        within(screen.getByRole('main')).getByRole('link', {
          name: 'サロンを探す',
        }),
      ).toHaveAttribute('href', '/')
    })

    it('should say that the service could not be read, and read it when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const path = await bookingPathOf()
      await takeAway('services')
      renderAt(path)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'メニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await heading('予約する')).toBeVisible()

      // Act
      await giveBack('services')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        await screen.findByRole('region', { name: 'ご予約の内容' }),
      ).toBeVisible()
    })

    it('should say that the times could not be read, and read them when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00' })
      const path = `${await bookingPathOf()}?date=${date}`
      await takeAway('staff_schedules')
      renderAt(path)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '空いている時刻を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(
        screen.queryByRole('button', { name: 'この内容で予約する' }),
      ).toBeNull()

      // Act
      await giveBack('staff_schedules')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(await offeredTimes()).toContain('10:00')
      expect(sendButton()).toBeVisible()
    })

    it.each([
      {
        what: 'the staff',
        // The profiles of the staff alone read it: the sign-in reads other columns of the table
        table: 'staff',
        column: 'bio',
        said: 'スタッフを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
      {
        what: 'the profile of the customer',
        table: 'customers',
        column: undefined,
        said: 'お客様の情報を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ])(
      'should say that $what could not be read below what is booked, and go on to the times when asked again',
      async ({ table, column, said }) => {
        // Arrange
        await signedInAs(CUSTOMER)
        const path = await bookingPathOf()
        await takeAway(table, column)
        renderAt(path)

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(said)
        expect(
          screen.getByRole('region', { name: 'ご予約の内容' }),
        ).toBeVisible()
        expect(screen.queryByRole('combobox', { name: 'スタッフ' })).toBeNull()
        expect(await findAccessibilityViolations()).toEqual([])

        // Act
        await giveBack(table, column)
        await userEvent.click(
          screen.getByRole('button', { name: 'もう一度読み込む' }),
        )

        // Assert
        expect(await staffControl()).toBeVisible()
        expect(screen.queryByRole('alert')).toBeNull()
      },
    )

    it('should say that the salon could not be read, and read it when asked again', async () => {
      // Arrange: the salon is read with its opening hours, the service without them
      await signedInAs(CUSTOMER)
      const path = await bookingPathOf()
      await takeAway('opening_hours')
      renderAt(path)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'サロンを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await heading('予約する')).toBeVisible()

      // Act
      await giveBack('opening_hours')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        await screen.findByRole('region', { name: 'ご予約の内容' }),
      ).toBeVisible()
    })

    it('should ask who the customer is when their profile went while the time was chosen, and book nothing', async () => {
      // Arrange: the salon removes the record of the customer behind the
      // screen, as the ledger does: the account names it no more
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00' })
      renderAt(`${await bookingPathOf()}?date=${date}`)
      await offeredTimes()
      await userEvent.click(time('10:00'))
      await testApi().query(
        'update customers set "deletedAt" = now() where email = $1',
        [CUSTOMER],
      )
      await testApi().query(
        'update users set "customerId" = null where email = $1',
        [CUSTOMER],
      )

      // Act
      await userEvent.click(sendButton())

      // Assert
      expect(
        await screen.findByRole('region', { name: 'お客様の情報' }),
      ).toBeVisible()
      expect(screen.queryByRole('combobox', { name: 'スタッフ' })).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
      expect(
        await testApi().query(
          `select bookings.id from bookings join customers on customers.id = bookings."customerId"
           where customers.email = $1 and bookings."bookingDate" = $2::date`,
          [CUSTOMER, date],
        ),
      ).toEqual([])
    })

    it('should have no accessibility violations, with times, without, and while it asks who the customer is', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const date = await openDay({ [HIROSHI]: '10:00' })
      const path = await bookingPathOf()
      const first = renderAt(`${path}?date=${date}`)
      await offeredTimes()

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(sendButton())

      // Assert: with an error
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      first.unmount()
      const closed = await closeDay()
      renderAt(`${path}?date=${closed}`)
      await screen.findByText('この日は、予約できる時刻がありません')

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should have no accessibility violations while it asks who the customer is', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      renderAt(await bookingPathOf())
      await screen.findByRole('region', { name: 'お客様の情報' })

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])
    })
  })

  describe('the page of a booking', () => {
    /** A booking of the customer of the tests, and the day it is on. */
    const book = async (
      customerRequest: string | null = null,
    ): Promise<{ id: string; bookingNumber: string; date: string }> => {
      const date = await openDay({ [MIKA]: '10:00' })
      const booked = await bookThroughApi(CUSTOMER, {
        staff: MIKA,
        startTime: momentAt(date, '11:30'),
        customerRequest,
      })

      return { ...booked, date }
    }

    it('should ask somebody who is not signed in to sign in, and show the booking then', async () => {
      // Arrange
      const { id, bookingNumber } = await book()
      renderAt(`/bookings/${id}`)

      // Assert
      expect(
        await screen.findByText('予約を確認するには、サインインしてください。'),
      ).toBeVisible()

      // Act
      const user = userEvent.setup()
      await user.type(
        screen.getByRole('textbox', { name: 'メールアドレス' }),
        CUSTOMER,
      )
      await user.type(
        screen.getByLabelText('パスワード'),
        testApi().seedPassword,
      )
      await user.click(screen.getByRole('button', { name: 'サインイン' }))

      // Assert
      expect(await heading('予約の内容')).toBeVisible()
      expect(
        await screen.findByRole('region', {
          name: `予約番号 ${bookingNumber}`,
        }),
      ).toBeVisible()
      expect(address()).toBe(`/bookings/${id}`)
    })

    it('should show a booking of the customer: where it stands, where and what it is, with whom, when, and what it comes to', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber, date } = await book('くせ毛です')

      // Act
      renderAt(`/bookings/${id}`)

      // Assert
      const details = await screen.findByRole('region', {
        name: `予約番号 ${bookingNumber}`,
      })
      expect(document.title).toBe(`予約の内容 | ${TITLE}`)
      expect(detailsIn(details)).toEqual({
        状態: '確定待ちサロンが内容を確認すると、予約が確定します。',
        サロン: TOKYO,
        メニュー: LADIES_CUT,
        担当: MIKA,
        日時: `${new Intl.DateTimeFormat('ja-JP', {
          dateStyle: 'full',
          timeZone: 'Asia/Tokyo',
        }).format(new Date(momentAt(date, '11:30')))} 11:30〜12:30（1 時間）`,
        料金: '￥5,500',
        ご要望: 'くせ毛です',
      })
      expect(
        within(details).getByRole('link', { name: TOKYO }),
      ).toHaveAttribute('href', `/salons/${await salonIdOf(TOKYO)}`)
    })

    it('should show a booking the salon confirmed as confirmed, and one that was cancelled as cancelled, without a word on what comes next', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book()
      await testApi().query(
        `update bookings set status = 'confirmed' where id = $1::uuid`,
        [id],
      )

      // Act
      const first = renderAt(`/bookings/${id}`)

      // Assert
      expect(
        detailsIn(await screen.findByRole('region', { name: /^予約番号 / })),
      ).toMatchObject({ 状態: '確定' })

      // Act
      first.unmount()
      await testApi().query(
        `update bookings set status = 'cancelled', "cancelledAt" = now() where id = $1::uuid`,
        [id],
      )
      renderAt(`/bookings/${id}`)

      // Assert
      expect(
        detailsIn(await screen.findByRole('region', { name: /^予約番号 / })),
      ).toMatchObject({ 状態: 'キャンセル' })
    })

    it('should read a booking again when its page is opened again, and show it as the salon confirmed it since', async () => {
      // Arrange: the application does not read again for five minutes what
      // it has read (`startApplication`), and the salon confirmed the
      // booking after
      // its page was shown
      await signedInAs(CUSTOMER)
      const { id } = await book()
      const client = asTheApplicationKeeps()
      const first = renderAt(`/bookings/${id}`, { client })
      expect(
        detailsIn(await screen.findByRole('region', { name: /^予約番号 / })),
      ).toMatchObject({ 状態: expect.stringContaining('確定待ち') })
      first.unmount()
      await testApi().query(
        `update bookings set status = 'confirmed' where id = $1::uuid`,
        [id],
      )

      // Act
      renderAt(`/bookings/${id}`, { client })

      // Assert
      expect(await screen.findByText('確定')).toBeVisible()
      expect(screen.queryByText('確定待ち')).toBeNull()
    })

    it('should add the tax to the amount of a service whose price is without it, and say how much of it is tax', async () => {
      // Arrange: the price of the service is 5,500 without tax, at 10 %
      await signedInAs(CUSTOMER)
      await testApi().query(
        `update services set "taxIncluded" = false where name = $1`,
        [LADIES_CUT],
      )
      const { id } = await book()

      // Act
      renderAt(`/bookings/${id}`)

      // Assert
      expect(
        detailsIn(await screen.findByRole('region', { name: /^予約番号 / })),
      ).toMatchObject({ 料金: '￥6,050（うち消費税 ￥550）' })
    })

    it('should say that the salon no longer shows the service and the member of the staff of a visit that is over, and show the rest', async () => {
      // Arrange: a visit of the customer that was completed, whose service and member of the staff the salon removed since
      await signedInAs(CUSTOMER)
      const [visit] = z
        .tuple([z.object({ id: z.uuid(), bookingNumber: z.string() })])
        .parse(
          await testApi().query(
            `select bookings.id::text, bookings."bookingNumber"
             from bookings join customers on customers.id = bookings."customerId"
             where customers.email = $1 and bookings.status = 'completed'
             order by bookings."startTime" limit 1`,
            [CUSTOMER],
          ),
        )
      await testApi().query(
        `update services set "deletedAt" = now()
         where id in (select "serviceId" from booking_services where "bookingId" = $1::uuid)`,
        [visit.id],
      )
      await testApi().query(
        `update staff set "deletedAt" = now()
         where id = (select "staffId" from bookings where id = $1::uuid)`,
        [visit.id],
      )

      // Act
      renderAt(`/bookings/${visit.id}`)

      // Assert
      expect(
        detailsIn(
          await screen.findByRole('region', {
            name: `予約番号 ${visit.bookingNumber}`,
          }),
        ),
      ).toMatchObject({
        状態: '完了',
        メニュー: '（掲載を終えています）',
        担当: '（掲載を終えています）',
      })
    })

    it.each([
      {
        of: 'the booking of another customer',
        id: async () =>
          (
            await bookThroughApi(ANOTHER_CUSTOMER, {
              staff: MIKA,
              startTime: momentAt(await openDay({ [MIKA]: '10:00' }), '10:00'),
              customerRequest: null,
            })
          ).id,
      },
      { of: 'an ID that no booking has', id: async () => NOTHING },
      { of: 'an address that names no ID', id: async () => 'my-booking' },
    ])('should say of $of that there is no such booking', async ({ id }) => {
      // Arrange
      await signedInAs(CUSTOMER)

      // Act
      renderAt(`/bookings/${await id()}`)

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
      expect(
        screen.getByText(
          'アドレスが正しいか、お確かめください。ほかのアカウントで入れた予約は、表示できません。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('region', { name: /^予約番号 / })).toBeNull()
    })

    it('should say that the booking could not be read, and read it when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber } = await book()
      await takeAway('booking_services')
      renderAt(`/bookings/${id}`)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '予約を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )

      // Act
      await giveBack('booking_services')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        await screen.findByRole('region', {
          name: `予約番号 ${bookingNumber}`,
        }),
      ).toBeVisible()
    })

    it('should say that what the booking names could not be read, and read it when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id, bookingNumber } = await book()
      await takeAway('services')
      renderAt(`/bookings/${id}`)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '予約の内容を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )

      // Act
      await giveBack('services')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        await screen.findByRole('region', {
          name: `予約番号 ${bookingNumber}`,
        }),
      ).toBeVisible()
    })

    it('should name the day alone of a booking at a salon that is no longer there when it asks before the cancellation', async () => {
      // Arrange: the time of a booking is told on the clock of its salon
      await signedInAs(CUSTOMER)
      const { id, date } = await book()
      await testApi().query(
        'update salons set "deletedAt" = now() where name = $1',
        [TOKYO],
      )
      renderAt(`/bookings/${id}`)

      // Act
      await userEvent.click(
        await screen.findByRole('button', { name: '予約をキャンセルする' }),
      )

      // Assert
      expect(
        screen.getByRole('dialog', { name: '予約をキャンセルしますか？' }),
      ).toHaveAccessibleDescription(
        `${fullDay(date)}の予約をキャンセルします。キャンセルした予約は、元に戻せません。`,
      )
      expect(screen.queryByRole('link', { name: '日時を変更する' })).toBeNull()
    })

    it('should have no accessibility violations', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const { id } = await book('くせ毛です')
      const first = renderAt(`/bookings/${id}`)
      await screen.findByRole('region', { name: /^予約番号 / })

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      first.unmount()
      renderAt(`/bookings/${NOTHING}`)
      await heading('予約が見つかりません')

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])
    })
  })
})

describe('the screens of a booking on a page in English, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should book a time in English, and show the booking as English writes it', async () => {
    // Arrange
    await signedInAs(CUSTOMER)
    const date = await openDay({ [HIROSHI]: '10:00', [MIKA]: '11:00' })
    renderAt(`${await bookingPathOf()}?date=${date}`)
    const user = userEvent.setup()
    expect(await heading('Book')).toBeVisible()
    expect(
      detailsIn(await screen.findByRole('region', { name: 'Your booking' })),
    ).toEqual({
      Salon: TOKYO,
      Service: LADIES_CUT,
      Duration: '1 hr',
      Price: '¥5,500 (tax included)',
    })
    expect(
      (await screen.findByRole('combobox', { name: 'Staff' })).firstChild
        ?.textContent,
    ).toBe('No preference')

    // Act
    await user.click(await screen.findByRole('radio', { name: '10:00' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Requests' }),
      'A little shorter, please',
    )
    await user.click(
      screen.getByRole('button', { name: 'Book with these details' }),
    )

    // Assert
    expect(await heading('Booking details')).toHaveFocus()
    expect(statusMessages()).toContain('Your booking was received.')
    expect(
      detailsIn(screen.getByRole('region', { name: /^Booking number BK-/ })),
    ).toEqual({
      Status:
        'Awaiting confirmationThe booking is confirmed once the salon has checked it.',
      Salon: TOKYO,
      Service: LADIES_CUT,
      Staff: HIROSHI,
      'Date and time': `${new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full',
        timeZone: 'Asia/Tokyo',
      }).format(new Date(momentAt(date, '10:00')))} 10:00–11:00 (1 hr)`,
      Price: '¥5,500',
      Requests: 'A little shorter, please',
    })
  })

  it('should say in English that a time has to be chosen, and book nothing', async () => {
    // Arrange
    await signedInAs(CUSTOMER)
    const date = await openDay({ [HIROSHI]: '10:00' })
    renderAt(`${await bookingPathOf()}?date=${date}`)
    await screen.findByRole('radiogroup', { name: 'Start time' })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'Book with these details' }),
    )

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'Start time' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Choose a start time.'),
    )
    expect(screen.getByRole('radio', { name: '10:00' })).toHaveFocus()
  })
})
