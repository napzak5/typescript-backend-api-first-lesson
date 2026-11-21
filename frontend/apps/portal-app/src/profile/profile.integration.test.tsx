import { applications } from '@beauty-salon-frontend/brand'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
  accessTokenOf,
  ask,
  CUSTOMER,
  giveBack,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  registerNewcomer,
  signedInAs,
  takeAway,
} from '../bookings/__tests__/arrangements'

/*
 * The customer of these tests is the first of the seed data: Yuki Tanaka,
 * a member of the rank gold with 2,500 points, who came twice and has said
 * everything about herself but a second phone number.
 *
 * What the API refuses of a value is not met here: the form sends nothing
 * the API does not take, so such an answer cannot be brought about through
 * the screen. It is in `profile-api.test.ts` and `profile-flow.test.ts`.
 */

const TITLE = applications.portal.name

const STYLIST = 'stylist1@beautysalon.jp'

/** The address the application is at, as the router knows it */
let address = ''

/**
 * The path of the last screen, and what the page said in the commit that
 * showed it: before an answer of the API could arrive. A test that looks
 * at the page after waiting for something on it looks too late: by then,
 * a screen that showed what it had kept has read again.
 */
let firstSight: [string, string] = ['', '']

const Address = () => {
  const { pathname, search } = useLocation()
  address = `${pathname}${search}`
  useLayoutEffect(() => {
    firstSight = [pathname, document.querySelector('main')?.textContent ?? '']
  }, [pathname])

  return null
}

/** What the application keeps of what it read: for five minutes, it does not read again. */
const asTheApplicationKeeps = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  })

const renderAt = (
  path: string,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  )

// --- What the tests ask of the database

const storedSchema = z.tuple([
  z.object({
    lastName: z.string(),
    firstName: z.string(),
    lastNameKana: z.string().nullable(),
    firstNameKana: z.string().nullable(),
    phoneNumber: z.string(),
    alternativePhone: z.string().nullable(),
    postalCode: z.string().nullable(),
    prefecture: z.string().nullable(),
    city: z.string().nullable(),
    address: z.string().nullable(),
    building: z.string().nullable(),
    birthDate: z.string().nullable(),
    gender: z.string().nullable(),
    occupation: z.string().nullable(),
    preferences: z.unknown(),
    allowEmail: z.boolean(),
    allowSms: z.boolean(),
    allowMarketing: z.boolean(),
    membershipTier: z.string(),
    loyaltyPoints: z.number(),
    visitCount: z.number(),
    firstVisitDate: z.iso.date().nullable(),
    lastVisitDate: z.iso.date().nullable(),
    updatedAt: z.string(),
  }),
])

/** The customer of an address, as the ledger of the salons has them. */
const storedProfile = async (email: string) => {
  const [row] = storedSchema.parse(
    await testApi().query(
      `select "lastName", "firstName", "lastNameKana", "firstNameKana", "phoneNumber", "alternativePhone",
              "postalCode", prefecture, city, address, building, "birthDate"::text, gender::text, occupation,
              preferences, "allowEmail", "allowSms", "allowMarketing", "membershipTier"::text,
              "loyaltyPoints", "visitCount", "firstVisitDate"::text, "lastVisitDate"::text, "updatedAt"::text
       from customers where email = $1 and "deletedAt" is null`,
      [email],
    ),
  )

  return row
}

/** What a salon writes into its ledger while the customer looks at a screen. */
const salonWrites = (email: string, assignments: string) =>
  testApi().query(`update customers set ${assignments} where email = $1`, [
    email,
  ])

// --- What the tests read on the screen

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

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

/**
 * The requests about the profile of the account that were sent since
 * `fetch` is watched: the method of each, in their order.
 */
const askedOfTheProfile = (
  fetched: MockInstance<typeof fetch>,
): (string | undefined)[] =>
  fetched.mock.calls.flatMap(([input, init]) =>
    String(input).endsWith('/api/v1/customers/me') ? [init?.method] : [],
  )

const statusMessages = (): (string | null)[] =>
  within(screen.getByRole('main'))
    .getAllByRole('status')
    .map((status) => status.textContent)

/** A day of the calendar, as the page writes it. */
const dayOf = (date: string | null): string =>
  date === null
    ? 'まだ来店がありません'
    : new Intl.DateTimeFormat('ja-JP', {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${date}T00:00:00Z`))

const text = (name: string) => screen.findByRole('textbox', { name })
const box = (name: string) => screen.getByRole('checkbox', { name })

const saveButton = () => screen.getByRole('button', { name: '変更を保存する' })
const registerButton = () => screen.getByRole('button', { name: '登録する' })

/** Opens the form of the customer of the tests, and waits for it. */
const openForm = async (client?: QueryClient): Promise<void> => {
  await signedInAs(CUSTOMER)
  renderAt('/mypage/profile', client)
  await screen.findByRole('button', { name: '変更を保存する' })
}

/** Opens the form of an account that has no profile, and waits for it. */
const openEmptyForm = async (): Promise<void> => {
  await registerNewcomer()
  await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
  renderAt('/mypage/profile')
  await screen.findByRole('button', { name: '登録する' })
}

/** What the form of a new profile says to somebody whose profile was gone when they changed it */
const GONE =
  'お客様の情報が見つからなかったため、変更を保存できませんでした。お手数ですが、もう一度登録してください。'

/** What the page says of the customer of the tests as the seed data has her. */
const SEEDED = {
  お名前: 'Tanaka Yuki',
  フリガナ: 'タナカ ユキ',
  メールアドレス: CUSTOMER,
  電話番号: '+81-90-1234-5678',
  予備の電話番号: '記録なし',
  住所: '〒153-0063Tokyo Meguro-ku 7-8-9 MeguroMeguro Heights 301',
  生年月日: '1990年5月15日',
  性別: '女性',
  職業: 'Designer',
  好みのメニュー: 'カット、カラー',
  サロンに伝えておきたいこと: 'Prefers organic products',
  受け取る連絡: 'メールでの連絡、SMS での連絡、キャンペーンなどのお知らせ',
}

describe('the page and the profile of a customer, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  describe.each([
    [
      '/mypage',
      'マイページを見るには、サインインしてください。',
      () => screen.findByText('Designer'),
    ],
    [
      '/mypage/profile',
      'お客様の情報を登録、変更するには、サインインしてください。',
      () => screen.findByDisplayValue('Designer'),
    ],
  ])('the screen at %s', (path, notice, occupation) => {
    it('should ask somebody who is not signed in to sign in', async () => {
      // Act
      renderAt(path)

      // Assert
      expect(await screen.findByText(notice)).toBeVisible()
      expect(screen.queryByRole('region')).toBeNull()
      expect(screen.queryByRole('group')).toBeNull()
    })

    it('should tell an account of the staff of a salon that the screen is not for it', async () => {
      // Arrange
      await signedInAs(STYLIST)

      // Act
      renderAt(path)

      // Assert
      expect(
        await screen.findByText(
          `${STYLIST} のアカウントでは利用できません。利用できるアカウントでサインインし直してください。`,
        ),
      ).toBeVisible()
      expect(screen.queryByRole('region')).toBeNull()
      expect(screen.queryByRole('group')).toBeNull()
    })

    it('should say that the profile could not be read when the API fails, and read it when asked again', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      await takeAway('customers')
      renderAt(path)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'お客様の情報を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(screen.queryByRole('textbox')).toBeNull()

      // Act
      await giveBack('customers')
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(await occupation()).toBeVisible()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should mark the page of the customer in the header', async () => {
      // Arrange
      await signedInAs(CUSTOMER)

      // Act
      renderAt(path)

      // Assert
      expect(
        within(
          await screen.findByRole('navigation', { name: 'メインメニュー' }),
        )
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
    })
  })

  describe('the page', () => {
    it('should say what the salons keep of the member, and what the customer said about themselves', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      const stored = await storedProfile(CUSTOMER)

      // Act
      renderAt('/mypage')

      // Assert
      expect(detailsIn(await region('会員の情報'))).toEqual({
        会員ランク: 'ゴールド',
        ポイント: '2,500 ポイント',
        来店回数: '2 回',
        初めての来店: dayOf(stored.firstVisitDate),
        最後の来店: dayOf(stored.lastVisitDate),
        紹介コード: '未発行',
        髪質: '記録なし',
        髪の太さ: '記録なし',
        頭皮の状態: '記録なし',
      })
      expect(stored.firstVisitDate).not.toBeNull()
      expect(stored.lastVisitDate).not.toBe(stored.firstVisitDate)
      expect(detailsIn(await region('お客様の情報'))).toEqual(SEEDED)
      expect(document.title).toBe(`マイページ | ${TITLE}`)
      expect(document.body).toHaveFocus()
    })

    it('should have nothing that keeps somebody from using it', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt('/mypage')
      await region('お客様の情報')

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should lead from the header to the page, and from the page to the form of the profile', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt('/')
      const user = userEvent.setup()

      // Act
      await user.click(
        within(
          await screen.findByRole('navigation', { name: 'メインメニュー' }),
        ).getByRole('link', { name: 'マイページ' }),
      )

      // Assert
      expect(await heading('マイページ')).toHaveFocus()
      expect(address).toBe('/mypage')

      // Act
      await user.click(
        within(await region('お客様の情報')).getByRole('link', {
          name: 'お客様の情報を変更する',
        }),
      )

      // Assert
      expect(await heading('お客様の情報')).toHaveFocus()
      expect(address).toBe('/mypage/profile')
      expect(document.title).toBe(`お客様の情報 | ${TITLE}`)
      expect(await text('姓')).toHaveValue('Tanaka')
      expect(await heading('お客様の情報')).toHaveFocus()
    })

    it('should say to an account that has no profile that there is none, and lead to the form that makes one', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      renderAt('/mypage')

      // Assert
      expect(
        await screen.findByText('お客様の情報は、まだ登録されていません'),
      ).toBeVisible()
      // Nothing of a profile: the account alone, which every account has
      expect(screen.getAllByRole('region')).toEqual([
        screen.getByRole('region', { name: 'アカウントの安全' }),
      ])
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(
        screen.getByRole('link', { name: 'お客様の情報を登録する' }),
      )

      // Assert
      expect(await heading('お客様の情報')).toHaveFocus()
      expect(address).toBe('/mypage/profile')
      expect(
        await screen.findByRole('button', { name: '登録する' }),
      ).toBeEnabled()
      expect(await text('姓')).toHaveValue('')
    })

    it('should read the profile again whenever it is shown, with what the application keeps: the points a salon gave meanwhile are there', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt('/mypage', asTheApplicationKeeps())
      const user = userEvent.setup()
      expect(detailsIn(await region('会員の情報'))).toMatchObject({
        ポイント: '2,500 ポイント',
      })
      await user.click(screen.getByRole('link', { name: '予約の一覧' }))
      await heading('予約の一覧')
      await salonWrites(
        CUSTOMER,
        `"loyaltyPoints" = 2750, "membershipTier" = 'platinum'`,
      )

      // Act
      await user.click(screen.getByRole('link', { name: 'マイページ' }))

      // Assert
      await waitFor(async () =>
        expect(detailsIn(await region('会員の情報'))).toMatchObject({
          会員ランク: 'プラチナ',
          ポイント: '2,750 ポイント',
        }),
      )
    })
  })

  describe('the form of the profile there is', () => {
    it('should open with the profile as the salons have it', async () => {
      // Act
      await openForm()

      // Assert
      expect(await text('姓')).toHaveValue('Tanaka')
      expect(await text('名')).toHaveValue('Yuki')
      expect(await text('姓（フリガナ）')).toHaveValue('タナカ')
      expect(await text('名（フリガナ）')).toHaveValue('ユキ')
      expect(await text('電話番号')).toHaveValue('+81-90-1234-5678')
      expect(await text('予備の電話番号')).toHaveValue('')
      expect(
        within(screen.getByRole('group', { name: '連絡先' })).getByText(
          `メールアドレス（${CUSTOMER}）は、ここでは変更できません。変更するときは、サロンにお問い合わせください。`,
        ),
      ).toBeVisible()
      expect(await text('郵便番号')).toHaveValue('153-0063')
      expect(await text('都道府県')).toHaveValue('Tokyo')
      expect(await text('市区町村')).toHaveValue('Meguro-ku')
      expect(await text('番地')).toHaveValue('7-8-9 Meguro')
      expect(await text('建物名・部屋番号')).toHaveValue('Meguro Heights 301')
      expect(screen.getByLabelText('生年月日')).toHaveValue('1990-05-15')
      expect(screen.getByRole('combobox', { name: '性別' })).toHaveValue(
        'female',
      )
      expect(await text('職業')).toHaveValue('Designer')
      expect(
        within(screen.getByRole('group', { name: '好みのメニュー' }))
          .getAllByRole('checkbox', { checked: true })
          .map((kind) => kind.getAttribute('value')),
      ).toEqual(['cut', 'color'])
      expect(await text('サロンに伝えておきたいこと')).toHaveValue(
        'Prefers organic products',
      )
      expect(box('メールでの連絡を受け取る')).toBeChecked()
      expect(box('SMS での連絡を受け取る')).toBeChecked()
      expect(box('キャンペーンなどのお知らせを受け取る')).toBeChecked()
      expect(document.body).toHaveFocus()
    })

    it('should have nothing that keeps somebody from using it, also when it says what is wrong', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()

      // Assert
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await user.clear(await text('名'))
      await user.click(saveButton())

      // Assert
      expect(await text('名')).toHaveAccessibleDescription(
        '名を入力してください。',
      )
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should change what the customer changed, say so, and show the profile as it is now', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      await user.clear(await text('姓'))
      await user.type(await text('姓'), '  Sato ')
      await user.type(await text('予備の電話番号'), '03-5550-0142')
      await user.clear(await text('建物名・部屋番号'))
      fireEvent.change(screen.getByLabelText('生年月日'), {
        target: { value: '1991-06-16' },
      })
      await user.selectOptions(
        screen.getByRole('combobox', { name: '性別' }),
        '回答しない',
      )
      await user.click(box('カラー'))
      await user.click(box('スパ'))
      await user.clear(await text('サロンに伝えておきたいこと'))
      await user.type(
        await text('サロンに伝えておきたいこと'),
        '香りの強い製品は苦手です。',
      )
      await user.click(box('SMS での連絡を受け取る'))

      // Act
      await user.click(saveButton())

      // Assert
      expect(
        await screen.findByText('お客様の情報を変更しました。'),
      ).toBeVisible()
      expect(statusMessages()).toContain('お客様の情報を変更しました。')
      expect(await heading('マイページ')).toHaveFocus()
      expect(address).toBe('/mypage')
      // The page shows the profile as it is now in the commit that shows
      // the page, not the one it had read before
      expect(firstSight).toEqual([
        '/mypage',
        expect.stringContaining('お名前Sato Yuki'),
      ])
      expect(detailsIn(await region('お客様の情報'))).toEqual({
        ...SEEDED,
        お名前: 'Sato Yuki',
        予備の電話番号: '03-5550-0142',
        住所: '〒153-0063Tokyo Meguro-ku 7-8-9 Meguro',
        生年月日: '1991年6月16日',
        性別: '回答しない',
        好みのメニュー: 'カット、スパ',
        サロンに伝えておきたいこと: '香りの強い製品は苦手です。',
        受け取る連絡: 'メールでの連絡、キャンペーンなどのお知らせ',
      })
      expect(await storedProfile(CUSTOMER)).toMatchObject({
        lastName: 'Sato',
        firstName: 'Yuki',
        alternativePhone: '03-5550-0142',
        building: null,
        birthDate: '1991-06-16',
        gender: 'prefer_not_to_say',
        occupation: 'Designer',
        preferences: {
          preferredServices: ['cut', 'spa'],
          notes: '香りの強い製品は苦手です。',
        },
        allowEmail: true,
        allowSms: false,
        allowMarketing: true,
      })
    })

    it('should send what the customer changed and nothing else: what a salon wrote into its ledger meanwhile stays', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      await salonWrites(
        CUSTOMER,
        `"phoneNumber" = '03-5550-0142', city = 'Shibuya-ku'`,
      )
      await user.clear(await text('職業'))
      await user.type(await text('職業'), 'Illustrator')

      // Act
      await user.click(saveButton())

      // Assert
      await screen.findByText('お客様の情報を変更しました。')
      expect(await storedProfile(CUSTOMER)).toMatchObject({
        occupation: 'Illustrator',
        phoneNumber: '03-5550-0142',
        city: 'Shibuya-ku',
      })
      expect(detailsIn(await region('お客様の情報'))).toMatchObject({
        職業: 'Illustrator',
        電話番号: '03-5550-0142',
        住所: '〒153-0063Tokyo Shibuya-ku 7-8-9 MeguroMeguro Heights 301',
      })
    })

    it('should ask the API for nothing when nothing was changed, and say so on the page', async () => {
      // Arrange
      await openForm()
      const { updatedAt } = await storedProfile(CUSTOMER)

      // Act
      await userEvent.click(saveButton())

      // Assert
      expect(
        await screen.findByText('変更された項目はありません。'),
      ).toBeVisible()
      expect(await heading('マイページ')).toHaveFocus()
      expect(address).toBe('/mypage')
      expect(detailsIn(await region('お客様の情報'))).toEqual(SEEDED)
      expect(await storedProfile(CUSTOMER)).toMatchObject({ updatedAt })
    })

    it('should say at its control what cannot be right, put the focus on the first of them, and send nothing', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      const { updatedAt } = await storedProfile(CUSTOMER)
      await user.clear(await text('名'))
      await user.clear(await text('電話番号'))
      await user.type(await text('電話番号'), '090-1234')
      await user.type(await text('郵便番号'), '-0000')
      fireEvent.change(screen.getByLabelText('生年月日'), {
        target: { value: '1899-12-31' },
      })

      // Act
      await user.click(saveButton())

      // Assert
      expect(await text('名')).toHaveFocus()
      expect(await text('名')).toHaveAccessibleDescription(
        '名を入力してください。',
      )
      expect(await text('電話番号')).toHaveAccessibleDescription(
        expect.stringContaining(
          '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
        ),
      )
      expect(await text('郵便番号')).toHaveAccessibleDescription(
        '10 文字以内で入力してください。',
      )
      expect(screen.getByLabelText('生年月日')).toHaveAccessibleDescription(
        '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
      )
      expect(await text('姓')).not.toHaveAttribute('aria-invalid')
      expect(address).toBe('/mypage/profile')
      expect(await storedProfile(CUSTOMER)).toMatchObject({
        firstName: 'Yuki',
        updatedAt,
      })
    })

    it('should open with what the salons have now, also when the application read the profile a moment ago', async () => {
      // Arrange
      await signedInAs(CUSTOMER)
      renderAt('/mypage', asTheApplicationKeeps())
      await region('お客様の情報')
      await salonWrites(CUSTOMER, `"phoneNumber" = '03-5550-0142'`)

      // Act
      await userEvent.click(
        screen.getByRole('link', { name: 'お客様の情報を変更する' }),
      )

      // Assert: the first form there is, not one that is corrected later.
      // A form that opened with what was kept would keep that value
      expect(await text('電話番号')).toHaveValue('03-5550-0142')
      expect(await heading('お客様の情報')).toHaveFocus()
    })

    it('should read nothing behind the form: what is being typed stays when the connection comes back and when the window is looked at again', async () => {
      // Arrange: whatever is asked of the API now fails
      await openForm()
      const user = userEvent.setup()
      await user.type(await text('職業'), ' and Illustrator')
      await takeAway('customers')
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
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(askedOfTheProfile(fetched)).toEqual(['PATCH'])
      expect(await text('職業')).toHaveValue('Designer and Illustrator')
      await giveBack('customers')
    })

    it('should say that nothing was sent when the API fails, keep what was typed, and change the profile when it is sent again', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      await user.clear(await text('職業'))
      await user.type(await text('職業'), 'Illustrator')
      await takeAway('customers')

      // Act
      await user.click(saveButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await text('職業')).toHaveValue('Illustrator')
      expect(saveButton()).toBeEnabled()
      expect(address).toBe('/mypage/profile')

      // Act
      await giveBack('customers')
      await user.click(saveButton())

      // Assert
      await screen.findByText('お客様の情報を変更しました。')
      expect(await storedProfile(CUSTOMER)).toMatchObject({
        occupation: 'Illustrator',
      })
    })

    it('should show the form that makes a profile, and say why, when a salon removed the customer from its ledger before a change was sent', async () => {
      // Arrange: what the removal of a customer does to the ledger and to
      // the account (the API refuses it while the customer has a booking
      // to come, so the test writes it)
      await openForm()
      const user = userEvent.setup()
      await user.clear(await text('職業'))
      await user.type(await text('職業'), 'Illustrator')
      await salonWrites(CUSTOMER, `"deletedAt" = now()`)
      await testApi().query(
        `update users set "customerId" = null where email = $1`,
        [CUSTOMER],
      )

      // Act
      await user.click(saveButton())

      // Assert
      expect(
        await screen.findByRole('button', { name: '登録する' }),
      ).toBeEnabled()
      expect(await heading('お客様の情報')).toHaveFocus()
      expect(statusMessages()).toContain(GONE)
      expect(await text('姓')).toHaveValue('')
      expect(address).toBe('/mypage/profile')
      expect(
        await testApi().query(
          'select occupation from customers where email = $1',
          [CUSTOMER],
        ),
      ).toEqual([{ occupation: 'Designer' }])

      // Act: what the screen asks for
      await user.type(await text('姓'), 'Tanaka')
      await user.type(await text('名'), 'Yuki')
      await user.type(await text('電話番号'), '090-5550-0199')
      await user.click(registerButton())

      // Assert
      expect(
        await screen.findByText('お客様の情報を登録しました。'),
      ).toBeVisible()
      expect(detailsIn(await region('会員の情報'))).toMatchObject({
        会員ランク: 'レギュラー',
        来店回数: '0 回',
      })
      expect(await storedProfile(CUSTOMER)).toMatchObject({
        lastName: 'Tanaka',
        phoneNumber: '090-5550-0199',
        occupation: null,
      })
    })

    it('should lead back to the page without sending what was typed', async () => {
      // Arrange
      await openForm()
      const user = userEvent.setup()
      const { updatedAt } = await storedProfile(CUSTOMER)
      await user.type(await text('職業'), ' and Illustrator')

      // Act
      await user.click(screen.getByRole('link', { name: 'マイページへ戻る' }))

      // Assert
      expect(await heading('マイページ')).toHaveFocus()
      expect(detailsIn(await region('お客様の情報'))).toEqual(SEEDED)
      expect(await storedProfile(CUSTOMER)).toMatchObject({ updatedAt })
    })
  })

  describe('the form of an account that has no profile', () => {
    it('should be empty, and have nothing that keeps somebody from using it', async () => {
      // Act
      await openEmptyForm()

      // Assert
      for (const control of screen.getAllByRole('textbox')) {
        expect(control).toHaveValue('')
      }
      expect(screen.queryByRole('checkbox', { checked: true })).toBeNull()
      expect(
        screen.getByText(
          'メールアドレスは、サインインに使っているものを登録します。',
        ),
      ).toBeVisible()
      expect(document.title).toBe(`お客様の情報 | ${TITLE}`)
      expect(
        screen.getByText(
          'お名前と電話番号は、サロンを予約するために必要です。そのほかの項目は、あとからでも登録できます。',
        ),
      ).toBeVisible()
      expect(statusMessages()).not.toContain(GONE)
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should make the profile of what was said, say so, and show it on the page', async () => {
      // Arrange
      await openEmptyForm()
      const user = userEvent.setup()
      await user.type(await text('姓'), '山田')
      await user.type(await text('名'), '花子')
      await user.type(await text('姓（フリガナ）'), 'ヤマダ')
      await user.type(await text('電話番号'), '090-5550-0199')
      await user.type(await text('郵便番号'), '150-0001')
      await user.type(await text('都道府県'), '東京都')
      await user.type(await text('市区町村'), '渋谷区')
      await user.selectOptions(
        screen.getByRole('combobox', { name: '性別' }),
        '女性',
      )
      await user.click(box('スパ'))
      await user.click(box('カット'))
      await user.click(box('メールでの連絡を受け取る'))

      // Act
      await user.click(registerButton())

      // Assert
      expect(
        await screen.findByText('お客様の情報を登録しました。'),
      ).toBeVisible()
      expect(await heading('マイページ')).toHaveFocus()
      expect(address).toBe('/mypage')
      // The page shows what was just made in the commit that shows the
      // page: it does not say first that nothing is registered
      expect(firstSight).toEqual([
        '/mypage',
        expect.stringContaining('お名前山田 花子'),
      ])
      expect(
        detailsIn(screen.getByRole('region', { name: 'お客様の情報' })),
      ).toEqual({
        お名前: '山田 花子',
        フリガナ: 'ヤマダ',
        メールアドレス: NEWCOMER,
        電話番号: '090-5550-0199',
        予備の電話番号: '記録なし',
        住所: '〒150-0001東京都 渋谷区',
        生年月日: '記録なし',
        性別: '女性',
        職業: '記録なし',
        好みのメニュー: 'カット、スパ',
        サロンに伝えておきたいこと: '記録なし',
        受け取る連絡: 'メールでの連絡',
      })
      expect(detailsIn(await region('会員の情報'))).toMatchObject({
        会員ランク: 'レギュラー',
        ポイント: '0 ポイント',
        来店回数: '0 回',
        初めての来店: 'まだ来店がありません',
        最後の来店: 'まだ来店がありません',
      })
      expect(await storedProfile(NEWCOMER)).toMatchObject({
        lastName: '山田',
        firstName: '花子',
        lastNameKana: 'ヤマダ',
        firstNameKana: null,
        phoneNumber: '090-5550-0199',
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        address: null,
        birthDate: null,
        gender: 'female',
        preferences: { preferredServices: ['cut', 'spa'], notes: null },
        allowEmail: true,
        allowSms: false,
        allowMarketing: false,
      })
    })

    it('should take over the customer the salons have for the address of the account: what the form says replaces what they had, and what it leaves empty stays', async () => {
      // Arrange: somebody who came to a salon before they had an account
      await registerNewcomer()
      await testApi().query(
        `insert into customers ("lastName", "firstName", email, "phoneNumber", occupation, city, tags,
                                "membershipTier", "loyaltyPoints", "allowSms")
         values ('Yamada', 'Hanako', $1, '03-5550-0142', 'Teacher', 'Osaka', '{}', 'silver', 300, true)`,
        [NEWCOMER],
      )
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      renderAt('/mypage')
      const user = userEvent.setup()

      // Act: the page knows of no profile, and the form opens with nothing
      // of what the salons have: the account has not said who it is
      await user.click(
        await screen.findByRole('link', { name: 'お客様の情報を登録する' }),
      )
      await screen.findByRole('button', { name: '登録する' })
      for (const control of screen.getAllByRole('textbox')) {
        expect(control).toHaveValue('')
      }
      await user.type(await text('姓'), '山田')
      await user.type(await text('名'), '花子')
      await user.type(await text('電話番号'), '090-5550-0199')
      await user.type(await text('市区町村'), '渋谷区')
      await user.click(registerButton())

      // Assert
      expect(
        await screen.findByText('お客様の情報を登録しました。'),
      ).toBeVisible()
      expect(await heading('マイページ')).toHaveFocus()
      expect(
        detailsIn(screen.getByRole('region', { name: 'お客様の情報' })),
      ).toMatchObject({
        お名前: '山田 花子',
        電話番号: '090-5550-0199',
        住所: '渋谷区',
        職業: 'Teacher',
        受け取る連絡: 'なし',
      })
      expect(
        detailsIn(screen.getByRole('region', { name: '会員の情報' })),
      ).toMatchObject({
        会員ランク: 'シルバー',
        ポイント: '300 ポイント',
      })
      expect(await storedProfile(NEWCOMER)).toMatchObject({
        lastName: '山田',
        firstName: '花子',
        phoneNumber: '090-5550-0199',
        city: '渋谷区',
        occupation: 'Teacher',
        membershipTier: 'silver',
        loyaltyPoints: 300,
        allowSms: false,
      })
    })

    it('should ask for the name and the phone number, at their controls, and send nothing', async () => {
      // Arrange
      await openEmptyForm()
      const user = userEvent.setup()
      await user.type(await text('職業'), 'デザイナー')

      // Act
      await user.click(registerButton())

      // Assert
      expect(await text('姓')).toHaveFocus()
      expect(await text('姓')).toHaveAccessibleDescription(
        '姓を入力してください。',
      )
      expect(await text('名')).toHaveAccessibleDescription(
        '名を入力してください。',
      )
      expect(await text('電話番号')).toHaveAccessibleDescription(
        expect.stringContaining('電話番号を入力してください。'),
      )
      expect(await text('職業')).toHaveValue('デザイナー')
      expect(
        await testApi().query('select id from customers where email = $1', [
          NEWCOMER,
        ]),
      ).toEqual([])
    })

    it('should say that the account cannot have the profile when it got one elsewhere in the meantime, and keep what was typed', async () => {
      // Arrange
      await openEmptyForm()
      const user = userEvent.setup()
      const elsewhere = await ask(
        '/customers/me',
        {
          lastName: '山田',
          firstName: '花子',
          lastNameKana: null,
          firstNameKana: null,
          phoneNumber: '090-5550-0199',
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
      expect(elsewhere.status).toBe(201)
      await user.type(await text('姓'), '山田')
      await user.type(await text('名'), '華子')
      await user.type(await text('電話番号'), '090-5550-0199')

      // Act
      await user.click(registerButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
      )
      expect(await text('名')).toHaveValue('華子')
      expect(address).toBe('/mypage/profile')
      expect(await storedProfile(NEWCOMER)).toMatchObject({ firstName: '花子' })
    })
  })
})
