import type { ModelsCustomerPreferencesUpdateRequest } from '@beauty-salon-frontend/api-client'
import { applications } from '@beauty-salon-frontend/brand'
import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked } from '@beauty-salon-frontend/testing/answers'
import {
  giveBack,
  idOf,
  takeAway,
  testApi,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  asTheApplicationKeeps,
  firstSight,
  heading,
  optionsOf,
  queryClientOfATest,
  statusMessages,
} from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  OPERATOR,
  OSAKA,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { NotificationProvider } from '@beauty-salon-frontend/ui'
import {
  focusManager,
  onlineManager,
  QueryClientProvider,
} from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { renderAt } from '../../__tests__/screens'
import {
  accessTokenOf,
  ask,
  HIROSHI,
  MIKA,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  registerNewcomer,
  signedInAs,
  staffId,
} from '../../bookings/__tests__/arrangements'
import { OwnPreferences } from './own-preferences'

/*
 * The customer of these tests is the first of the seed data: Yuki Tanaka,
 * who has bookings at both salons and has said nothing of what she wishes
 * for. The staff she is offered are the five of Beauty Studio Tokyo and
 * the one of Hair & Spa Osaka.
 *
 * What a test starts from is written as a customer or a salon writes it:
 * through the API. What the API refuses of a value the form checks itself
 * is not met here: the form sends nothing of the kind. It is in
 * `preferences-flow.test.ts` and `preferences-api.test.ts`.
 */

const TITLE = applications.portal.name

const YUI = 'Yui Watanabe'
const AKIKO = 'Akiko Mori'
const TAKESHI = 'Takeshi Ito'

/** How a screen names a member of the staff: with their salon. */
const named = (displayName: string, salon = TOKYO): string =>
  `${displayName}（${salon}）`

// --- What the tests ask of the API, as a client that is no screen does

const change = async (
  path: string,
  changes: unknown,
  accessToken: string,
): Promise<Response> =>
  fetch(`${testApi().origin}/api/v1${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(changes),
  })

/** What a customer said they wish for somewhere else: in another tab, or a while ago. */
const prefers = async (
  changes: ModelsCustomerPreferencesUpdateRequest,
  email = CUSTOMER,
  password = testApi().seedPassword,
): Promise<void> => {
  const answer = await change(
    '/customers/me/preferences',
    changes,
    await accessTokenOf(email, password),
  )
  expect(answer.status).toBe(200)
}

/** What a salon writes into its ledger of the customer of the tests, while she looks at a screen. */
const salonWrites = async (
  changes: ModelsCustomerPreferencesUpdateRequest,
): Promise<void> => {
  const id = await idOf(
    'select id::text from customers where email = $1 and "deletedAt" is null',
    [CUSTOMER],
  )
  const answer = await change(
    `/customers/${id}/preferences`,
    changes,
    await accessTokenOf(OPERATOR),
  )
  expect(answer.status).toBe(200)
}

const staffRowSchema = z.tuple([z.object({ id: z.uuid(), salonId: z.uuid() })])

/** A salon says that a member of its staff does not work there at the moment: it no longer shows them. */
const leaves = async (displayName: string): Promise<void> => {
  const [{ id, salonId }] = staffRowSchema.parse(
    await testApi().query(
      'select id::text, "salonId"::text from staff where "displayName" = $1',
      [displayName],
    ),
  )
  const answer = await change(
    `/salons/${salonId}/staff/${id}`,
    { isActive: false },
    await accessTokenOf(OPERATOR),
  )
  expect(answer.status).toBe(200)
}

/**
 * A salon removes a member of its staff: what the removal does to its
 * ledger. (The API refuses it while the member has a booking to come, so
 * the test writes it.)
 */
const isRemoved = async (displayName: string): Promise<void> => {
  await testApi().query(
    `update staff set "deletedAt" = now() where "displayName" = $1`,
    [displayName],
  )
}

/** An account with a profile and without a booking: somebody who has just said who they are. */
const registerNewcomerWithProfile = async (): Promise<void> => {
  await registerNewcomer()
  const answer = await ask(
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
      allowEmail: true,
      allowSms: false,
      allowMarketing: false,
    },
    await accessTokenOf(NEWCOMER, NEWCOMER_PASSWORD),
  )
  expect(answer.status).toBe(201)
}

// --- What the tests ask of the database

const storedSchema = z
  .array(
    z.object({
      preferredStaffId: z.string().nullable(),
      avoidStaffIds: z.array(z.string()),
      preferredTimeSlots: z.unknown(),
      stylePreferences: z.unknown(),
      communicationStyle: z.string().nullable(),
      specialRequests: z.string().nullable(),
      updatedAt: z.string(),
    }),
  )
  .max(1)

/** The preferences of the customer of an address as they are stored; `null` when nothing was ever written. */
const storedPreferences = async (email = CUSTOMER) => {
  const [row] = storedSchema.parse(
    await testApi().query(
      `select stored."preferredStaffId"::text, stored."avoidStaffIds"::text[], stored."preferredTimeSlots",
              stored."stylePreferences", stored."communicationStyle", stored."specialRequests",
              stored."updatedAt"::text
       from customer_preferences stored join customers on customers.id = stored."customerId"
       where customers.email = $1 and customers."deletedAt" is null`,
      [email],
    ),
  )

  return row ?? null
}

const namesSchema = z.array(z.object({ label: z.string() }))

/**
 * The staff the salons show, as the form offers them: the salons by name,
 * and the staff of a salon in the order of its list.
 */
const staffOffered = async (): Promise<string[]> =>
  namesSchema
    .parse(
      await testApi().query(
        `select staff."displayName" || '（' || salons.name || '）' as label
         from staff join salons on salons.id = staff."salonId"
         where staff."isActive" and staff."deletedAt" is null and salons."deletedAt" is null
         order by salons.name, staff."createdAt", staff.id`,
      ),
    )
    .map(({ label }) => label)

// --- What the tests read on the screen

const region = (name: string) => screen.findByRole('region', { name })

/** The names and the values of a record, as a description list shows them. */
const detailsIn = (within_: HTMLElement): Record<string, string | null> =>
  Object.fromEntries(
    within(within_)
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )

/** What the page says of somebody who has said nothing of what they wish for. */
const NOTHING_SAID = {
  指名したいスタッフ: '指定なし',
  避けたいスタッフ: '指定なし',
  希望する時間帯: '指定なし',
  希望の長さ: '指定なし',
  好きな色: '指定なし',
  避けたいスタイル: '指定なし',
  参考の画像: '指定なし',
  接客の好み: '指定なし',
  特別な要望: '指定なし',
}

/**
 * A line of what was asked that is about the preferences, or about what
 * the form offers: the screen asks for more than them.
 */
const ofThePreferences = (line: string): boolean =>
  ['/customers/me', '/staff-profiles', '/salons'].some((path) =>
    line.includes(` ${path}`),
  )

const text = (name: string) => screen.getByRole('textbox', { name })
const box = (name: string) => screen.getByRole('checkbox', { name })
const time = (name: string) => screen.getByLabelText(name)
const wished = () =>
  screen.getByRole('combobox', { name: '指名したいスタッフ' })
const button = (name: string) => screen.getByRole('button', { name })
const saveButton = () => button('変更を保存する')

/** The times of the rows of the form, in the order of the page. */
const times = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    (control) => control.value,
  )

const avoided = (): (string | null)[] =>
  screen
    .queryAllByRole('checkbox', { checked: true })
    .map((checked) => checked.closest('label')?.textContent ?? null)

/** Opens the form of an account, and waits for it. */
const openForm = async (
  email = CUSTOMER,
  password = testApi().seedPassword,
  client = queryClientOfATest(),
): Promise<void> => {
  await signedInAs(email, password)
  renderAt('/mypage/preferences', { client })
  await screen.findByRole('button', { name: '変更を保存する' })
}

const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'

/** Everything a customer can wish for, as the API takes it. */
const everything =
  async (): Promise<ModelsCustomerPreferencesUpdateRequest> => ({
    preferredStaffId: await staffId(HIROSHI),
    avoidStaffIds: [await staffId(MIKA), await staffId(TAKESHI)],
    preferredTimeSlots: [
      { startTime: '10:00', endTime: '12:00' },
      { startTime: '18:00', endTime: '20:30' },
    ],
    stylePreferences: {
      preferredLength: 'Shoulder length',
      preferredColors: ['Ash brown', 'Beige'],
      avoidStyles: ['Short fringe'],
      inspirationImages: ['https://images.example.com/styles/bob.jpg'],
    },
    communicationStyle: 'Quiet',
    specialRequests: 'A towel under the neck, please.',
  })

/** What the page says of somebody who wishes for `everything`. */
const EVERYTHING_SAID = {
  指名したいスタッフ: named(HIROSHI),
  避けたいスタッフ: `${named(MIKA)}、${named(TAKESHI, OSAKA)}`,
  希望する時間帯: '10:00〜12:00、18:00〜20:30',
  希望の長さ: 'Shoulder length',
  好きな色: 'Ash brown、Beige',
  避けたいスタイル: 'Short fringe',
  参考の画像: 'https://images.example.com/styles/bob.jpg',
  接客の好み: 'Quiet',
  特別な要望: 'A towel under the neck, please.',
}

describe('the preferences of a customer, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  describe('the screen at /mypage/preferences', () => {
    it('should ask somebody who is not signed in to sign in', async () => {
      // Act
      renderAt('/mypage/preferences')

      // Assert
      expect(
        await screen.findByText(
          '好みの設定を変更するには、サインインしてください。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('group')).toBeNull()
    })

    it('should tell an account of the staff of a salon that the screen is not for it', async () => {
      // Arrange
      await signedInAs(STYLIST)

      // Act
      renderAt('/mypage/preferences')

      // Assert
      expect(
        await screen.findByText(
          `${STYLIST} のアカウントでは利用できません。利用できるアカウントでサインインし直してください。`,
        ),
      ).toBeVisible()
      expect(screen.queryByRole('group')).toBeNull()
    })

    it('should mark the page of the customer in the header, and name the screen in the title of the document', async () => {
      // Act
      await openForm()

      // Assert
      expect(
        within(screen.getByRole('navigation', { name: 'メインメニュー' }))
          .getAllByRole('link')
          .map((link) => [
            link.textContent,
            link.getAttribute('href'),
            link.getAttribute('aria-current'),
          ]),
      ).toEqual([
        ['サロンを探す', '/', null],
        ['予約の一覧', '/bookings', null],
        ['マイページ', '/mypage', 'page'],
      ])
      expect(document.title).toBe(`好みの設定 | ${TITLE}`)
    })

    it.each([
      ['the preferences', 'customer_preferences'],
      ['the bookings, which say whose staff to offer', 'bookings'],
    ])(
      'should say that the preferences could not be read when the API fails at %s, and read them when asked again',
      async (_case, table) => {
        // Arrange
        await signedInAs(CUSTOMER)
        await takeAway(table)
        renderAt('/mypage/preferences')

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
          '好みの設定を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        )
        expect(screen.queryByRole('textbox')).toBeNull()

        // Act
        await giveBack(table)
        await userEvent.click(button('もう一度読み込む'))

        // Assert
        expect(
          await screen.findByRole('button', { name: '変更を保存する' }),
        ).toBeEnabled()
        expect(screen.queryByRole('alert')).toBeNull()
      },
    )

    it('should say to an account that has no profile that preferences need one, and lead to the form that makes it', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)

      // Act
      renderAt('/mypage/preferences')

      // Assert
      expect(
        await screen.findByText(
          '好みの設定は、お客様の情報を登録すると使えます',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('group')).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(
        within(screen.getByRole('main')).getByRole('link', {
          name: 'お客様の情報を登録する',
        }),
      )

      // Assert
      expect(await heading('お客様の情報')).toHaveFocus()
      expect(address()).toBe('/mypage/profile')
    })
  })

  describe('the part of the page', () => {
    it('should say of every preference that there is none, for somebody who has said nothing, and lead to the form', async () => {
      // Arrange
      await signedInAs(CUSTOMER)

      // Act
      renderAt('/mypage')

      // Assert
      const part = await region('好みの設定')
      expect(
        await within(part).findByRole('link', { name: '好みの設定を変更する' }),
      ).toHaveAttribute('href', '/mypage/preferences')
      expect(detailsIn(part)).toEqual(NOTHING_SAID)
      expect(await storedPreferences()).toBeNull()
    })

    it('should say what the customer wishes for, the staff by their names and salons, and have nothing that keeps somebody from using it', async () => {
      // Arrange
      await prefers(await everything())
      await signedInAs(CUSTOMER)

      // Act
      renderAt('/mypage')

      // Assert
      const part = await region('好みの設定')
      await within(part).findByText(named(HIROSHI))
      expect(detailsIn(part)).toEqual(EVERYTHING_SAID)
      expect(
        within(part).getByRole('link', {
          name: 'https://images.example.com/styles/bob.jpg',
        }),
      ).toHaveAttribute('href', 'https://images.example.com/styles/bob.jpg')
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should leave out a member of the staff who does not work at their salon at the moment, and one the salon removed, and name the others', async () => {
      // Arrange
      await prefers(await everything())
      await leaves(HIROSHI)
      await isRemoved(TAKESHI)
      await signedInAs(CUSTOMER)

      // Act
      renderAt('/mypage')

      // Assert
      const part = await region('好みの設定')
      await within(part).findByText(named(MIKA))
      expect(detailsIn(part)).toEqual({
        ...EVERYTHING_SAID,
        指名したいスタッフ: '指定なし',
        避けたいスタッフ: named(MIKA),
      })
      expect(await storedPreferences()).toMatchObject({
        preferredStaffId: await staffId(HIROSHI),
        avoidStaffIds: [await staffId(MIKA), await staffId(TAKESHI)],
      })
    })

    it('should say in its place that the preferences could not be read, beside the rest of the page, and read them when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      await takeAway('customer_preferences')

      // Act
      renderAt('/mypage')

      // Assert
      const part = await region('好みの設定')
      expect(await within(part).findByRole('alert')).toHaveTextContent(
        '好みの設定を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(
        within(await region('お客様の情報')).getByText('Designer'),
      ).toBeVisible()

      // Act
      await giveBack('customer_preferences')
      await userEvent.click(
        within(part).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      await within(part).findByRole('link', { name: '好みの設定を変更する' })
      expect(detailsIn(part)).toEqual(NOTHING_SAID)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should not be there for an account that has no profile, and ask the API for no preferences', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      renderAt('/mypage')

      // Assert
      expect(
        await screen.findByText('お客様の情報は、まだ登録されていません'),
      ).toBeVisible()
      expect(screen.queryByRole('region', { name: '好みの設定' })).toBeNull()
      expect(asked(fetched).filter(ofThePreferences)).toEqual([
        'GET /customers/me',
      ])
    })

    it('should say that preferences need a profile when the account has none: the API finds no preferences for it', async () => {
      // Arrange: the part alone. The page shows it once it has read a
      // profile, and an account can lose its profile after that
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)

      // Act
      render(
        <QueryClientProvider client={queryClientOfATest()}>
          <NotificationProvider>
            <OwnPreferences />
          </NotificationProvider>
        </QueryClientProvider>,
      )

      // Assert
      expect(
        await screen.findByText(
          '好みの設定は、お客様の情報を登録すると使えます。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.queryByRole('term')).toBeNull()
    })

    it('should read the preferences again whenever it is shown, with what the application keeps: what a salon wrote meanwhile is there', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const client = asTheApplicationKeeps()
      const first = renderAt('/mypage', { client })
      await within(await region('好みの設定')).findByRole('link')
      first.unmount()
      await salonWrites({ communicationStyle: 'Likes to talk' })

      // Act
      renderAt('/mypage', { client })

      // Assert
      expect(
        await within(await region('好みの設定')).findByText('Likes to talk'),
      ).toBeVisible()
    })
  })

  describe('the form', () => {
    it('should open with the preferences as they are stored, and offer the staff of every salon the customer has a booking at', async () => {
      // Arrange
      await prefers(await everything())
      const offered = await staffOffered()

      // Act
      await openForm()

      // Assert
      expect(await heading('好みの設定')).toBeVisible()
      expect(optionsOf(wished())).toEqual(['指名しない', ...offered])
      expect(offered).toHaveLength(6)
      expect(offered.at(-1)).toBe(named(TAKESHI, OSAKA))
      expect(wished()).toHaveValue(await staffId(HIROSHI))
      expect(
        screen
          .getAllByRole('checkbox')
          .map((each) => each.closest('label')?.textContent),
      ).toEqual(offered)
      expect(avoided()).toEqual([named(MIKA), named(TAKESHI, OSAKA)])
      expect(times()).toEqual(['10:00', '12:00', '18:00', '20:30'])
      expect(text('希望の長さ')).toHaveValue('Shoulder length')
      expect(text('好きな色')).toHaveValue('Ash brown\nBeige')
      expect(text('避けたいスタイル')).toHaveValue('Short fringe')
      expect(text('参考の画像の URL')).toHaveValue(
        'https://images.example.com/styles/bob.jpg',
      )
      expect(text('接客の好み')).toHaveValue('Quiet')
      expect(text('特別な要望')).toHaveValue('A towel under the neck, please.')
    })

    it('should have nothing that keeps somebody from using it, also when it says what is wrong', async () => {
      // Arrange
      await prefers(await everything())
      await openForm()

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      const user = userEvent.setup()
      await user.click(box(named(HIROSHI)))
      await user.type(text('参考の画像の URL'), '{Enter}no address')
      await user.click(saveButton())

      // Assert
      expect(box(named(HIROSHI))).toHaveAttribute('aria-invalid', 'true')
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should write what the customer said they wish for, say so, and show it on the page at once', async () => {
      // Arrange: from the page, as a customer comes to the form
      await signedInAs(CUSTOMER)
      renderAt('/mypage')
      const user = userEvent.setup()
      await user.click(
        await within(await region('好みの設定')).findByRole('link', {
          name: '好みの設定を変更する',
        }),
      )
      await screen.findByRole('button', { name: '変更を保存する' })
      await user.selectOptions(wished(), named(HIROSHI))
      await user.click(box(named(MIKA)))
      await user.click(box(named(TAKESHI, OSAKA)))
      await user.click(button('時間帯を追加する'))
      await user.type(time('時間帯 1 の開始'), '10:00')
      await user.type(time('時間帯 1 の終了'), '12:00')
      await user.click(button('時間帯を追加する'))
      await user.type(time('時間帯 2 の開始'), '18:00')
      await user.type(time('時間帯 2 の終了'), '20:30')
      await user.type(text('希望の長さ'), ' Shoulder length ')
      await user.type(
        text('好きな色'),
        'Ash brown{Enter}{Enter}Beige{Enter}Ash brown',
      )
      await user.type(text('避けたいスタイル'), 'Short fringe')
      await user.type(
        text('参考の画像の URL'),
        'https://images.example.com/styles/bob.jpg',
      )
      await user.type(text('接客の好み'), 'Quiet')
      await user.type(text('特別な要望'), 'A towel under the neck, please.')

      // Act
      await user.click(saveButton())

      // Assert: the page shows what was written in the commit that shows
      // the page. A page that showed what it had read before would say
      // first that nothing is wished for
      expect(await heading('マイページ')).toHaveFocus()
      expect(firstSight()).toEqual([
        '/mypage',
        expect.stringContaining(
          `指名したいスタッフ${named(HIROSHI)}避けたいスタッフ${named(MIKA)}、${named(TAKESHI, OSAKA)}希望する時間帯10:00〜12:00、18:00〜20:30`,
        ),
      ])
      expect(
        detailsIn(screen.getByRole('region', { name: '好みの設定' })),
      ).toEqual(EVERYTHING_SAID)
      expect(statusMessages()).toContain('好みの設定を変更しました。')
      expect(address()).toBe('/mypage')
      expect(await storedPreferences()).toMatchObject(await everything())
    })

    it('should send what the customer changed and nothing else: what a salon wrote into its ledger meanwhile stays', async () => {
      // Arrange
      await prefers(await everything())
      await openForm()
      const user = userEvent.setup()
      await salonWrites({
        specialRequests: 'Allergic to hair dye (noted by the salon)',
        preferredTimeSlots: [{ startTime: '09:00', endTime: '09:30' }],
      })
      await user.clear(text('接客の好み'))
      await user.type(text('接客の好み'), 'Likes to talk')

      // Act
      await user.click(saveButton())

      // Assert
      await screen.findByText('好みの設定を変更しました。')
      expect(await storedPreferences()).toMatchObject({
        ...(await everything()),
        communicationStyle: 'Likes to talk',
        specialRequests: 'Allergic to hair dye (noted by the salon)',
        preferredTimeSlots: [{ startTime: '09:00', endTime: '09:30' }],
      })
    })

    it('should ask the API for nothing when nothing was changed, and say so on the page', async () => {
      // Arrange
      await openForm()

      // Act
      await userEvent.click(saveButton())

      // Assert: no preferences were ever written for this customer
      expect(await heading('マイページ')).toHaveFocus()
      expect(statusMessages()).toContain('変更された項目はありません。')
      expect(address()).toBe('/mypage')
      expect(await storedPreferences()).toBeNull()
    })

    it('should not write again what is stored when nothing was changed', async () => {
      // Arrange
      await prefers(await everything())
      const before = await storedPreferences()
      await openForm()

      // Act
      await userEvent.click(saveButton())

      // Assert
      expect(await heading('マイページ')).toHaveFocus()
      expect(statusMessages()).toContain('変更された項目はありません。')
      expect(await storedPreferences()).toEqual(before)
    })

    it('should take a row of the time slots away, add another, and store the rows in the order of the form', async () => {
      // Arrange
      await prefers(await everything())
      await openForm()
      const user = userEvent.setup()

      // Act
      await user.click(button('時間帯 1 を削除する'))
      await user.click(button('時間帯を追加する'))
      await user.type(time('時間帯 2 の開始'), '08:00')
      await user.type(time('時間帯 2 の終了'), '09:15')
      await user.click(saveButton())

      // Assert
      await screen.findByText('好みの設定を変更しました。')
      expect(await storedPreferences()).toMatchObject({
        ...(await everything()),
        preferredTimeSlots: [
          { startTime: '18:00', endTime: '20:30' },
          { startTime: '08:00', endTime: '09:15' },
        ],
      })
    })

    it('should take away what was wished for: nobody, no time slot, no style, and no request', async () => {
      // Arrange
      await prefers(await everything())
      await openForm()
      const user = userEvent.setup()

      // Act
      await user.selectOptions(wished(), '指名しない')
      await user.click(box(named(MIKA)))
      await user.click(box(named(TAKESHI, OSAKA)))
      await user.click(button('時間帯 2 を削除する'))
      await user.click(button('時間帯 1 を削除する'))
      await user.clear(text('希望の長さ'))
      await user.clear(text('好きな色'))
      await user.clear(text('避けたいスタイル'))
      await user.clear(text('参考の画像の URL'))
      await user.clear(text('接客の好み'))
      await user.clear(text('特別な要望'))
      await user.click(saveButton())

      // Assert
      const part = await region('好みの設定')
      await within(part).findByRole('link', { name: '好みの設定を変更する' })
      expect(detailsIn(part)).toEqual(NOTHING_SAID)
      expect(await storedPreferences()).toMatchObject({
        preferredStaffId: null,
        avoidStaffIds: [],
        preferredTimeSlots: [],
        stylePreferences: null,
        communicationStyle: null,
        specialRequests: null,
      })
    })

    it('should say at its control what cannot be right, put the focus on the first of them, and send nothing', async () => {
      // Arrange
      await prefers(await everything())
      const before = await storedPreferences()
      await openForm()
      const user = userEvent.setup()
      await user.click(box(named(HIROSHI)))
      await user.click(button('時間帯を追加する'))
      await user.type(time('時間帯 3 の開始'), '11:00')
      await user.type(time('時間帯 3 の終了'), '13:00')
      await user.type(text('参考の画像の URL'), '{Enter}no address')
      await user.type(text('接客の好み'), 'x'.repeat(96))

      // Act
      await user.click(saveButton())

      // Assert: the first box of the group, whoever the salon lists first
      expect(screen.getAllByRole('checkbox').at(0)).toHaveFocus()
      expect(box(named(HIROSHI))).toHaveAttribute('aria-invalid', 'true')
      expect(
        screen.getByRole('group', { name: '避けたいスタッフ' }),
      ).toHaveAccessibleDescription(
        '指名したいスタッフは、避けたいスタッフに選べません。どちらかを変えてください。',
      )
      expect(time('時間帯 3 の開始')).toHaveAccessibleDescription(
        'ほかの時間帯と重なっています。重ならない時刻にしてください。',
      )
      expect(text('参考の画像の URL')).toHaveAccessibleDescription(
        expect.stringContaining('2 行目を確かめてください。'),
      )
      expect(text('接客の好み')).toHaveAccessibleDescription(
        expect.stringContaining('100 文字以内で入力してください。'),
      )
      expect(address()).toBe('/mypage/preferences')
      expect(await storedPreferences()).toEqual(before)
    })

    it('should not offer a member of the staff whose salon no longer shows them, and keep them stored when something else is changed', async () => {
      // Arrange
      await prefers(await everything())
      await leaves(HIROSHI)
      await leaves(TAKESHI)
      await openForm()
      const user = userEvent.setup()

      // Assert
      expect(wished()).toHaveValue('')
      expect(avoided()).toEqual([named(MIKA)])
      expect(
        screen.queryByRole('checkbox', { name: named(HIROSHI) }),
      ).toBeNull()
      expect(
        screen.queryByRole('checkbox', { name: named(TAKESHI, OSAKA) }),
      ).toBeNull()

      // Act
      await user.clear(text('接客の好み'))
      await user.click(saveButton())

      // Assert
      await screen.findByText('好みの設定を変更しました。')
      expect(await storedPreferences()).toMatchObject({
        preferredStaffId: await staffId(HIROSHI),
        avoidStaffIds: [await staffId(MIKA), await staffId(TAKESHI)],
        communicationStyle: null,
      })
    })

    it('should store the staff the customer chose in the place of those it could not show, when the customer changes them', async () => {
      // Arrange
      await prefers(await everything())
      await leaves(HIROSHI)
      await leaves(TAKESHI)
      await openForm()
      const user = userEvent.setup()

      // Act
      await user.selectOptions(wished(), named(YUI))
      await user.click(box(named(AKIKO)))
      await user.click(saveButton())

      // Assert
      await screen.findByText('好みの設定を変更しました。')
      const stored = await storedPreferences()
      expect(stored?.preferredStaffId).toBe(await staffId(YUI))
      expect(stored?.avoidStaffIds.toSorted()).toEqual(
        [await staffId(MIKA), await staffId(AKIKO)].toSorted(),
      )
    })

    it('should say at the member who is wished for that a salon has stored them as one to avoid meanwhile, and write nothing', async () => {
      // Arrange: the form does not send those to avoid, which it shows as
      // they were when it opened, so the API compares with what is stored
      await openForm()
      const user = userEvent.setup()
      await salonWrites({ avoidStaffIds: [await staffId(MIKA)] })
      const before = await storedPreferences()

      // Act
      await user.selectOptions(wished(), named(MIKA))
      await user.click(saveButton())

      // Assert
      expect(
        await screen.findByText(
          'このスタッフは、避けたいスタッフに入っています。どちらかを変えてください。',
        ),
      ).toBeVisible()
      expect(wished()).toHaveFocus()
      expect(wished()).toHaveAttribute('aria-invalid', 'true')
      expect(address()).toBe('/mypage/preferences')
      expect(await storedPreferences()).toEqual(before)
    })

    it('should say at the member who is wished for that they can no longer be chosen, when their salon removed them while the form was open', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      await isRemoved(AKIKO)

      // Act
      await user.selectOptions(wished(), named(AKIKO))
      await user.click(saveButton())

      // Assert
      expect(
        await screen.findByText(
          'このスタッフは、選べなくなりました。ほかのスタッフを選んでください。',
        ),
      ).toBeVisible()
      expect(wished()).toHaveFocus()
      expect(await storedPreferences()).toBeNull()
    })

    it('should open with what is stored now, also when the application read the preferences a moment ago', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const client = asTheApplicationKeeps()
      const first = renderAt('/mypage/preferences', { client })
      await screen.findByRole('button', { name: '変更を保存する' })
      first.unmount()
      await salonWrites({ communicationStyle: 'Likes to talk' })

      // Act
      renderAt('/mypage/preferences', { client })

      // Assert: the first form there is, not one that is corrected later.
      // A form that opened with what was kept would keep that value
      await screen.findByRole('button', { name: '変更を保存する' })
      expect(text('接客の好み')).toHaveValue('Likes to talk')
    })

    it('should read nothing behind the form: what is being typed stays when the connection comes back and when the window is looked at again', async () => {
      // Arrange: whatever is asked of the API about the preferences now fails
      await openForm()
      const user = userEvent.setup()
      await user.type(text('特別な要望'), 'A towel under the neck, please.')
      await takeAway('customer_preferences')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act: the connection comes back, the window is looked at again, and
      // then the form is sent. A read behind the form would have been asked
      // for before the change, and its failure would have taken the form
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await user.click(saveButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SENT)
      expect(asked(fetched).filter(ofThePreferences)).toEqual([
        'PATCH /customers/me/preferences',
      ])
      expect(text('特別な要望')).toHaveValue('A towel under the neck, please.')
      await giveBack('customer_preferences')
    })

    it('should say that nothing was sent when the API fails, keep what was typed and the rows, and write it when it is sent again', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      await user.click(button('時間帯を追加する'))
      await user.type(time('時間帯 1 の開始'), '10:00')
      await user.type(time('時間帯 1 の終了'), '12:00')
      await user.type(text('好きな色'), 'Beige')
      await takeAway('customer_preferences')

      // Act
      await user.click(saveButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SENT)
      expect(times()).toEqual(['10:00', '12:00'])
      expect(text('好きな色')).toHaveValue('Beige')
      expect(saveButton()).toBeEnabled()
      expect(address()).toBe('/mypage/preferences')

      // Act
      await giveBack('customer_preferences')
      await user.click(saveButton())

      // Assert
      await screen.findByText('好みの設定を変更しました。')
      expect(await storedPreferences()).toMatchObject({
        preferredTimeSlots: [{ startTime: '10:00', endTime: '12:00' }],
        stylePreferences: {
          preferredLength: null,
          preferredColors: ['Beige'],
          avoidStyles: [],
          inspirationImages: [],
        },
      })
    })

    it('should say that preferences need a profile, and why nothing was written, when a salon removed the customer from its ledger before a change was sent', async () => {
      // Arrange: what the removal of a customer does to the ledger and to
      // the account (the API refuses it while the customer has a booking
      // to come, so the test writes it)
      await openForm()
      const user = userEvent.setup()
      await user.type(text('接客の好み'), 'Quiet')
      await testApi().query(
        `update customers set "deletedAt" = now() where email = $1`,
        [CUSTOMER],
      )
      await testApi().query(
        `update users set "customerId" = null where email = $1`,
        [CUSTOMER],
      )

      // Act
      await user.click(saveButton())

      // Assert
      expect(
        await screen.findByText(
          '好みの設定は、お客様の情報を登録すると使えます',
        ),
      ).toBeVisible()
      expect(await heading('好みの設定')).toHaveFocus()
      expect(statusMessages()).toContain(
        'お客様の情報が見つからなかったため、変更を保存できませんでした。',
      )
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(address()).toBe('/mypage/preferences')
      expect(
        await testApi().query(
          'select count(*)::int as n from customer_preferences',
        ),
      ).toEqual([{ n: 0 }])

      // Act: the page of the customer knows that there is no profile
      await user.click(
        within(
          screen.getByRole('navigation', { name: 'メインメニュー' }),
        ).getByRole('link', { name: 'マイページ' }),
      )

      // Assert: in the commit that shows the page, without asking
      expect(await heading('マイページ')).toHaveFocus()
      expect(firstSight()).toEqual([
        '/mypage',
        expect.stringContaining('お客様の情報は、まだ登録されていません'),
      ])
    })

    it('should lead back to the page without sending what was typed', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      await user.type(text('接客の好み'), 'Quiet')

      // Act
      await user.click(screen.getByRole('link', { name: 'マイページへ戻る' }))

      // Assert
      expect(await heading('マイページ')).toHaveFocus()
      expect(address()).toBe('/mypage')
      expect(await storedPreferences()).toBeNull()
    })
  })

  describe('the form of somebody who has a booking nowhere', () => {
    it('should have no control for the staff, say how to get one, and write the rest', async () => {
      // Arrange
      await registerNewcomerWithProfile()
      await openForm(NEWCOMER, NEWCOMER_PASSWORD)
      const user = userEvent.setup()

      // Assert
      expect(
        within(screen.getByRole('main')).queryByRole('combobox'),
      ).toBeNull()
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(
        screen.getByText(
          '指名したいスタッフと、避けたいスタッフは、サロンを予約すると選べるようになります。',
        ),
      ).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await user.type(text('特別な要望'), 'First visit.')
      await user.click(saveButton())

      // Assert
      await screen.findByText('好みの設定を変更しました。')
      expect(await storedPreferences(NEWCOMER)).toMatchObject({
        preferredStaffId: null,
        avoidStaffIds: [],
        specialRequests: 'First visit.',
      })
    })

    it('should offer the member of the staff that is stored, with their salon, and nobody else', async () => {
      // Arrange: a salon wrote down whom the customer asked for on the phone
      await registerNewcomerWithProfile()
      await prefers(
        { preferredStaffId: await staffId(HIROSHI) },
        NEWCOMER,
        NEWCOMER_PASSWORD,
      )

      // Act
      await openForm(NEWCOMER, NEWCOMER_PASSWORD)

      // Assert
      expect(optionsOf(wished())).toEqual(['指名しない', named(HIROSHI)])
      expect(wished()).toHaveValue(await staffId(HIROSHI))
      expect(
        screen
          .getAllByRole('checkbox')
          .map((each) => each.closest('label')?.textContent),
      ).toEqual([named(HIROSHI)])
    })
  })
})

describe('the preferences of a customer on a page in English, against the API', () => {
  const saveInEnglish = () => button('Save the changes')

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should ask in English somebody who is not signed in to sign in', async () => {
    // Act
    renderAt('/mypage/preferences')

    // Assert
    expect(
      await screen.findByText('Sign in to change your preferences.'),
    ).toBeVisible()
  })

  it('should say in English what the customer wishes for on the page, and lead to the form', async () => {
    // Arrange
    await prefers(await everything())
    await signedInAs(CUSTOMER)
    renderAt('/mypage')
    const user = userEvent.setup()
    const part = await region('Preferences')
    const link = await within(part).findByRole('link', {
      name: 'Change your preferences',
    })
    expect(detailsIn(part)).toMatchObject({
      'Preferred staff': `${HIROSHI} (${TOKYO})`,
      'Favorite colors': 'Ash brown, Beige',
      'Special requests': 'A towel under the neck, please.',
    })

    // Act
    await user.click(link)

    // Assert
    expect(await heading('Preferences')).toHaveFocus()
    expect(document.title).toBe(`Preferences | ${TITLE}`)
    expect(
      await screen.findByRole('button', { name: 'Save the changes' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('link', { name: 'Back to my page' }),
    ).toHaveAttribute('href', '/mypage')
  })

  it('should say in English that nothing was changed, and that the preferences were changed', async () => {
    // Arrange
    await signedInAs(CUSTOMER)
    renderAt('/mypage/preferences')
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Save the changes' })

    // Act
    await user.click(saveInEnglish())

    // Assert
    expect(await heading('My page')).toHaveFocus()
    expect(statusMessages()).toContain('Nothing was changed.')

    // Act
    await user.click(
      await within(await region('Preferences')).findByRole('link', {
        name: 'Change your preferences',
      }),
    )
    await screen.findByRole('button', { name: 'Save the changes' })
    await user.type(text('Special requests'), 'A towel under the neck, please.')
    await user.click(saveInEnglish())

    // Assert
    expect(await heading('My page')).toHaveFocus()
    expect(statusMessages()).toContain('Your preferences were changed.')
    expect(await storedPreferences()).toMatchObject({
      specialRequests: 'A towel under the neck, please.',
    })
  })

  it('should say in English that the preferences could not be read', async () => {
    // Arrange
    await signedInAs(CUSTOMER)
    await takeAway('customer_preferences')

    // Act
    renderAt('/mypage/preferences')

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your preferences. Check your connection and try again.',
    )
    await giveBack('customer_preferences')
  })

  it('should say in English to an account that has no profile that preferences need one', async () => {
    // Arrange
    await registerNewcomer()
    await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)

    // Act
    renderAt('/mypage/preferences')

    // Assert
    expect(
      await screen.findByText(
        'You can set your preferences once your details are registered',
      ),
    ).toBeVisible()
    expect(
      screen.getByText('Register your name and phone number, then try again.'),
    ).toBeVisible()
    expect(
      within(screen.getByRole('main')).getByRole('link', {
        name: 'Register your details',
      }),
    ).toHaveAttribute('href', '/mypage/profile')
  })
})
