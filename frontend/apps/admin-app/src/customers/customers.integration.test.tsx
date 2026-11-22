import { dayAfter, dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  salonIdOf,
  signInAs,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  firstSight,
  heading,
  notifications,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  TOKYO,
  VIP,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../__tests__/screens'
import { arrange, refuse } from '../bookings/__tests__/arrangements'
import {
  arrangeCustomers,
  arrangePreferences,
  customerIdOf,
  giveReferralCode,
  referredMeanwhile,
  registeredDaysAgo,
  removeMeanwhile,
  storedCustomerCount,
  storedCustomerOf,
  writeNoteMeanwhile,
} from './__tests__/arrangements'

const field = (name: string): HTMLElement => screen.getByLabelText(name)

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

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

/** The names in a table of customers, in alphabetical order: customers registered at once come in no order of their own. */
const namesIn = (name: string): string[] =>
  rowsOf(name)
    .map(([customer]) => customer ?? '')
    .toSorted()

/** The part of a page under a heading. */
const part = (name: string): HTMLElement => screen.getByRole('region', { name })

/** What a part of a page describes, term by term. */
const describedIn = (name: string): Record<string, string> =>
  Object.fromEntries(
    within(part(name))
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )

/** Opens a page of the salon in Tokyo at its address, signed in. */
const openAt = async (path: (tokyo: string) => string, email = STYLIST) => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(path(tokyo))
  await signInAs(email)

  return tokyo
}

/** Waits for the ledger: its heading, then its table. */
const theLedger = async (caption = '顧客台帳'): Promise<void> => {
  await heading('顧客台帳')
  await screen.findByRole('table', { name: caption })
}

/** Waits for the page of a customer: its heading, then its parts, which are read after it. */
const theCustomer = async (): Promise<void> => {
  await heading('お客様の台帳')
  await screen.findByRole('region', { name: '台帳' })
  await within(part('好み設定')).findAllByRole('term')
  await within(part('このサロンでの利用')).findAllByRole('term')
}

/** The dialog that chooses the referrer, open */
const referrerDialog = (): HTMLElement =>
  screen.getByRole('dialog', { name: '紹介元を選ぶ' })

/** Chooses the referrer of the form: searches the ledger for a keyword in the dialog, and presses the name. */
const chooseReferrer = async (
  user: ReturnType<typeof userEvent.setup>,
  keyword: string,
  name: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: '紹介元を選ぶ' }))
  await user.type(
    within(referrerDialog()).getByRole('searchbox', { name: 'キーワード' }),
    `${keyword}{Enter}`,
  )
  await user.click(
    await within(referrerDialog()).findByRole('button', { name }),
  )
}

/** The customers of the seed data, in alphabetical order */
const EVERYONE = [YUKI.name, KENJI.name, SAKURA.name, VIP.name].toSorted()

const NEW_EMAIL = 'hanako.yamada@example.com'

/** Fills in what a new customer must have. */
const fillInTheNeeded = async (
  user: ReturnType<typeof userEvent.setup>,
  email = NEW_EMAIL,
): Promise<void> => {
  await user.type(text('姓'), '山田')
  await user.type(text('名'), '花子')
  await user.type(text('メールアドレス'), email)
  await user.type(text('電話番号'), '090-1234-5678')
}

describe('the ledger of the customers, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('finding a customer', () => {
    it('should lead from the header to every customer of the ledger, with how many there are', async () => {
      // Arrange
      const user = userEvent.setup()
      const lastVisit = await dayFromToday(-5)
      const tokyo = await openAt((salon) => `/salons/${salon}/bookings`)

      // Act
      await user.click(await screen.findByRole('link', { name: '顧客' }))

      // Assert
      await theLedger()
      expect(address()).toBe(`/salons/${tokyo}/customers`)
      expect(namesIn('顧客台帳')).toEqual(EVERYONE)
      expect(rowsOf('顧客台帳')).toContainEqual([
        KENJI.name,
        // The cell that chooses the customer: the label of its checkbox, read by a screen reader
        `${KENJI.name} 様を選ぶ`,
        'ヤマモト ケンジ',
        '+81-80-9876-5432',
        'シルバー',
        '通常',
        '2 回',
        dayNameOf(lastVisit),
      ])
      expect(screen.getByText('4 人')).toBeVisible()
      expect(screen.getByRole('link', { name: '顧客' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(await findAccessibilityViolations(document.body)).toEqual([])
    })

    it('should find customers by a keyword, by tags, by their state and by their rank, keep them in the address, and lead back to all of them', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/customers`)
      await theLedger()

      // Act: the kana of a name
      await user.type(
        screen.getByRole('searchbox', { name: 'キーワード' }),
        'ヤマモト{Enter}',
      )

      // Assert
      await theLedger('条件に合うお客様')
      expect(address()).toBe(
        `/salons/${tokyo}/customers?${new URLSearchParams({ search: 'ヤマモト' })}`,
      )
      expect(namesIn('条件に合うお客様')).toEqual([KENJI.name])

      // Act: two tags and a rank, every one of them
      await user.clear(screen.getByRole('searchbox', { name: 'キーワード' }))
      await user.type(text('タグ'), 'vip、platinum')
      await user.selectOptions(field('会員ランク'), 'プラチナ')
      await user.click(screen.getByRole('button', { name: '探す' }))

      // Assert
      await waitFor(() =>
        expect(address()).toBe(
          `/salons/${tokyo}/customers?tags=vip&tags=platinum&membershipTier=platinum`,
        ),
      )
      await waitFor(() =>
        expect(namesIn('条件に合うお客様')).toEqual([VIP.name]),
      )

      // Act
      await user.click(screen.getByRole('link', { name: '条件を外す' }))

      // Assert
      await theLedger()
      expect(namesIn('顧客台帳')).toEqual(EVERYONE)
      expect(text('タグ')).toHaveValue('')
    })

    it('should find the customers registered on the days of the salon, the first and the last of them too', async () => {
      // Arrange
      const user = userEvent.setup()
      await registeredDaysAgo(YUKI.email, 10)
      await registeredDaysAgo(KENJI.email, 3)
      const from = await dayFromToday(-10)
      const to = await dayFromToday(-3)
      await openAt((salon) => `/salons/${salon}/customers`)
      await theLedger()

      // Act
      await user.type(field('登録日（から）'), from)
      await user.type(field('登録日（まで）'), to)
      await user.click(screen.getByRole('button', { name: '探す' }))

      // Assert
      await theLedger('条件に合うお客様')
      // The latest registered first
      expect(rowsOf('条件に合うお客様').map(([name]) => name)).toEqual([
        KENJI.name,
        YUKI.name,
      ])
      expect(screen.getByText('2 人')).toBeVisible()
    })

    it('should say that no customer meets the conditions, and offer to register one', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/customers`)
      await theLedger()

      // Act
      await user.selectOptions(field('ステータス'), '利用停止')
      await user.click(screen.getByRole('button', { name: '探す' }))

      // Assert
      expect(
        await screen.findByText('条件に合うお客様はいません'),
      ).toBeVisible()
      // The link of the header, and the one of the empty ledger
      expect(
        screen
          .getAllByRole('link', { name: 'お客様を登録する' })
          .map((link) => link.getAttribute('href')),
      ).toEqual([
        `/salons/${tokyo}/customers/new`,
        `/salons/${tokyo}/customers/new`,
      ])
    })

    it('should say at its control what is wrong with the conditions, and ask for nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/customers`)
      await theLedger()

      // Act
      await user.type(field('登録日（から）'), '2026-11-20')
      await user.type(field('登録日（まで）'), '2026-11-19')
      await user.click(screen.getByRole('button', { name: '探す' }))

      // Assert
      expect(field('登録日（まで）')).toHaveAccessibleDescription(
        '終わりの日は、始まりの日と同じか、その後にしてください。',
      )
      expect(field('登録日（まで）')).toHaveFocus()
      expect(address()).toBe(`/salons/${tokyo}/customers`)
    })

    it('should open with the conditions of its address, show twenty customers at a time, and the next ones with the focus on the first of them', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeCustomers(21, 'walk-in')
      await openAt((salon) => `/salons/${salon}/customers?tags=walk-in`)
      await theLedger('条件に合うお客様')
      expect(text('タグ')).toHaveValue('walk-in')
      expect(rowsOf('条件に合うお客様').map(([name]) => name)).toEqual(
        Array.from(
          { length: 20 },
          (_, index) => `Walk In ${String(index + 1).padStart(2, '0')}`,
        ),
      )
      expect(screen.getByText('21 人（20 人を表示しています）')).toBeVisible()

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      await waitFor(() => expect(rowsOf('条件に合うお客様')).toHaveLength(21))
      expect(rowsOf('条件に合うお客様').at(-1)?.[0]).toBe('Walk In 21')
      expect(
        within(screen.getByRole('table', { name: '条件に合うお客様' }))
          .getAllByRole('link')
          .at(20),
      ).toHaveFocus()
      expect(screen.getByText('21 人')).toBeVisible()
      expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
    })
  })

  describe('registering a customer', () => {
    it('should register a customer from the ledger, show them at once, and find them in the ledger', async () => {
      // Arrange
      const user = userEvent.setup()
      const tokyo = await openAt((salon) => `/salons/${salon}/customers`)
      await theLedger()
      await user.click(screen.getByRole('link', { name: 'お客様を登録する' }))
      await heading('お客様を登録する')
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await fillInTheNeeded(user, 'Hanako.Yamada@Example.com')
      await user.type(text('姓（フリガナ）'), 'ヤマダ')
      await user.type(text('名（フリガナ）'), 'ハナコ')
      await user.selectOptions(field('髪質'), 'ウェーブ')
      await user.click(screen.getByRole('checkbox', { name: 'スパ' }))
      await user.type(text('タグ'), '紹介、カラー')
      await user.type(text('スタッフ間の申し送り'), '電話で予約')
      await user.click(screen.getByRole('checkbox', { name: 'メールでの連絡' }))
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert: the customer the API answered is shown at first sight
      await theCustomer()
      const id = await customerIdOf(NEW_EMAIL)
      expect(address()).toBe(`/salons/${tokyo}/customers/${id}`)
      expect(firstSight()[1]).toContain('山田 花子（ヤマダ ハナコ） 様')
      expect(notifications()).toContain('山田 花子 様を台帳に登録しました。')
      expect(describedIn('台帳')).toMatchObject({
        メールアドレス: NEW_EMAIL,
        髪と頭皮: 'ウェーブ',
        好みのメニュー: 'スパ',
        タグ: '紹介カラー',
        送ってよい連絡: 'メール',
        スタッフ間の申し送り: '電話で予約',
      })
      expect(describedIn('来店とポイント')).toMatchObject({
        来店回数: '0 回',
        ポイント: '0 ポイント',
      })
      expect(await storedCustomerOf(NEW_EMAIL)).toMatchObject({
        lastName: '山田',
        lastNameKana: 'ヤマダ',
        membershipTier: 'regular',
        customerStatus: 'active',
        isActive: true,
        tags: ['紹介', 'カラー'],
        preferences: { preferredServices: ['spa'], notes: null },
        hairType: 'wavy',
        internalNotes: '電話で予約',
        referredBy: null,
        allowEmail: true,
        allowSms: false,
      })

      // Act
      await user.click(screen.getByRole('link', { name: '顧客' }))

      // Assert: the ledger that was read before has the new customer
      await theLedger()
      expect(namesIn('顧客台帳')).toEqual([...EVERYONE, '山田 花子'].toSorted())
    })

    it('should register a customer with the customer who referred them, chosen from the ledger, and name the referrer on the page', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      const tokyo = await openAt((salon) => `/salons/${salon}/customers/new`)
      await heading('お客様を登録する')
      await fillInTheNeeded(user)
      expect(text('紹介元')).toHaveValue('なし')
      await user.click(screen.getByRole('button', { name: '紹介元を選ぶ' }))
      await user.type(
        within(referrerDialog()).getByRole('searchbox', {
          name: 'キーワード',
        }),
        'yamamoto{Enter}',
      )
      await within(referrerDialog()).findByRole('button', { name: KENJI.name })
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(
        within(referrerDialog()).getByRole('button', { name: KENJI.name }),
      )

      // Assert
      expect(text('紹介元')).toHaveValue(`${KENJI.name} 様`)

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      await theCustomer()
      expect((await storedCustomerOf(NEW_EMAIL)).referredBy).toBe(kenji)
      expect(
        await within(part('台帳')).findByRole('link', {
          name: `${KENJI.name} 様`,
        }),
      ).toHaveAttribute('href', `/salons/${tokyo}/customers/${kenji}`)
    })

    it('should say that no customer has the keyword, find one registered meanwhile when it is searched again, and keep nobody as the referrer when the choice is given up', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt((salon) => `/salons/${salon}/customers/new`)
      await heading('お客様を登録する')
      await user.click(screen.getByRole('button', { name: '紹介元を選ぶ' }))
      await user.type(
        within(referrerDialog()).getByRole('searchbox', {
          name: 'キーワード',
        }),
        'walk-in{Enter}',
      )
      expect(
        await within(referrerDialog()).findByText(
          'キーワードに合うお客様が見つかりませんでした',
        ),
      ).toBeVisible()

      // Act: the same keyword, once somebody was registered meanwhile
      await arrangeCustomers(1, 'walk-in')
      await user.click(
        within(referrerDialog()).getByRole('button', { name: '探す' }),
      )

      // Assert
      expect(
        await within(referrerDialog()).findByRole('button', {
          name: 'Walk In 01',
        }),
      ).toBeVisible()

      // Act
      await user.click(
        within(referrerDialog()).getByRole('button', { name: 'やめる' }),
      )

      // Assert
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(text('紹介元')).toHaveValue('なし')
    })

    it('should say what is missing at each control, and send nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      await openAt((salon) => `/salons/${salon}/customers/new`)
      await heading('お客様を登録する')

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      expect(text('姓')).toHaveFocus()
      expect(text('姓')).toHaveAccessibleDescription('姓を入力してください。')
      expect(text('メールアドレス')).toHaveAttribute('aria-invalid', 'true')
      expect(text('電話番号')).toHaveAccessibleDescription(
        '電話番号を入力してください。',
      )
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should say at its control that another customer has the address of mail, in capitals too', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      await openAt((salon) => `/salons/${salon}/customers/new`)
      await heading('お客様を登録する')
      await fillInTheNeeded(user, YUKI.email.toUpperCase())

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      await waitFor(() =>
        expect(text('メールアドレス')).toHaveAccessibleDescription(
          '台帳のお客様の間で、同じアドレスは使えません。 このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
        ),
      )
      expect(text('メールアドレス')).toHaveFocus()
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should say at its control that another customer has the referral code', async () => {
      // Arrange
      const user = userEvent.setup()
      await giveReferralCode(KENJI.email, 'KENJI-2026')
      await openAt((salon) => `/salons/${salon}/customers/new`)
      await heading('お客様を登録する')
      await fillInTheNeeded(user)
      await user.type(text('紹介コード'), 'KENJI-2026')

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      await waitFor(() => expect(text('紹介コード')).toHaveFocus())
      expect(text('紹介コード')).toHaveAttribute('aria-invalid', 'true')
      expect(text('紹介コード')).toHaveAccessibleDescription(
        expect.stringContaining(
          'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを入力してください。',
        ),
      )
      expect(text('メールアドレス')).not.toHaveAttribute('aria-invalid')
    })

    it('should say that the customer was not registered when the database fails, and keep what was filled in', async () => {
      // Arrange
      const user = userEvent.setup()
      await refuse('insert', 'customers')
      await openAt((salon) => `/salons/${salon}/customers/new`)
      await heading('お客様を登録する')
      await fillInTheNeeded(user)

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(text('姓')).toHaveValue('山田')
      expect(text('メールアドレス')).toHaveValue(NEW_EMAIL)
    })
  })

  describe('the page of a customer', () => {
    it('should show what the ledger keeps, the preferences with the members named, and what the customer did at the salon over the last year', async () => {
      // Arrange
      await arrangePreferences(SAKURA.email)
      const sakura = await customerIdOf(SAKURA.email)
      const [visit, today, yearAgo] = await Promise.all([
        dayFromToday(-20),
        dayFromToday(0),
        dayFromToday(-365),
      ])

      // Act
      await openAt((salon) => `/salons/${salon}/customers/${sakura}`)

      // Assert
      await theCustomer()
      expect(screen.getByText('Sato Sakura（サトウ サクラ） 様')).toBeVisible()
      expect(describedIn('台帳')).toMatchObject({
        電話番号: '+81-70-1111-2222',
        住所: '〒160-0022 TokyoShinjuku-ku5-6-7 Shinjuku Shinjuku Tower 15F',
        生年月日: dayNameOf('1995-03-10'),
        好みのメニュー: 'カラー、トリートメント、スパ',
        好みについてのメモ: 'Sensitive skin, requires patch test',
        会員ランク: 'レギュラー',
        タグ: 'sensitive-skintreatment-focus',
      })
      expect(describedIn('来店とポイント')).toMatchObject({
        初回来店日: dayNameOf(visit),
        最終来店日: dayNameOf(visit),
        来店回数: '1 回',
        ポイント: '300 ポイント',
      })
      expect(describedIn('好み設定')).toMatchObject({
        指名したいスタッフ: 'Hiroshi Tanaka',
        避けたいスタッフ: 'Mika Suzuki、一覧にないスタッフ',
        希望する時間帯: '10:00〜12:00',
        希望の長さ: 'ボブ',
        接客の好み: '静かに過ごしたい',
      })
      expect(
        screen.getByText(`${dayNameOf(yearAgo)}〜${dayNameOf(today)}の集計`),
      ).toBeVisible()
      expect(describedIn('このサロンでの利用')).toEqual({
        予約: '2 件',
        利用額: '￥0',
        '予約 1 件あたりの会計': '￥0',
        最後の来店: `${dayNameOf(visit)} 10:30`,
        キャンセル率: '0%',
        無断キャンセル率: '50%',
      })
      expect(rowsOf('よく受けたメニュー')).toEqual([['Mens Cut', '1 件']])
      expect(rowsOf('よく担当したスタッフ')).toEqual([['Yui Watanabe', '1 件']])
      expect(await findAccessibilityViolations(document.body)).toEqual([])
    })

    it('should count over another period, keep it in the address, and say at its control a period the API does not count over', async () => {
      // Arrange
      const user = userEvent.setup()
      const sakura = await customerIdOf(SAKURA.email)
      const [from, to] = await Promise.all([dayFromToday(-7), dayFromToday(7)])
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${sakura}`,
      )
      await theCustomer()

      // Act: the week before and after today, with the booking to come
      await user.clear(field('集計する期間（から）'))
      await user.type(field('集計する期間（から）'), from)
      await user.clear(field('集計する期間（まで）'))
      await user.type(field('集計する期間（まで）'), to)
      await user.click(screen.getByRole('button', { name: '集計する' }))

      // Assert
      await waitFor(() =>
        expect(address()).toBe(
          `/salons/${tokyo}/customers/${sakura}?from=${from}&to=${to}`,
        ),
      )
      await waitFor(() =>
        expect(describedIn('このサロンでの利用')).toMatchObject({
          予約: '2 件',
          最後の来店: 'なし',
          無断キャンセル率: '50%',
        }),
      )
      expect(rowsOf('よく受けたメニュー')).toEqual([
        ['この期間に完了した予約はありません'],
      ])

      // Act
      await user.clear(field('集計する期間（から）'))
      await user.type(field('集計する期間（から）'), dayAfter(to, -366))
      await user.click(screen.getByRole('button', { name: '集計する' }))

      // Assert
      expect(field('集計する期間（まで）')).toHaveAccessibleDescription(
        '366 日まで集計できます。 期間は 366 日までにしてください。',
      )
      expect(address()).toBe(
        `/salons/${tokyo}/customers/${sakura}?from=${from}&to=${to}`,
      )
    })

    it('should lead from a booking to its customer, and from the customer to a new booking of theirs', async () => {
      // Arrange
      const user = userEvent.setup()
      const bookingId = await arrange({
        bookingNumber: 'BK-TEST-0301',
        day: 0,
        at: '11:00',
        customer: KENJI.email,
      })
      const kenji = await customerIdOf(KENJI.email)
      const today = await dayFromToday(0)
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/bookings/${bookingId}`,
      )
      await heading('予約の内容')

      // Act
      await user.click(await screen.findByRole('link', { name: KENJI.name }))

      // Assert
      await theCustomer()
      expect(address()).toBe(`/salons/${tokyo}/customers/${kenji}`)

      // Act
      await user.click(screen.getByRole('link', { name: '予約を入れる' }))

      // Assert: the customer is chosen, and the form asks for the rest
      await heading('予約を入れる')
      expect(address()).toBe(
        `/salons/${tokyo}/bookings/new?date=${today}&customerId=${kenji}`,
      )
      expect(
        await screen.findByRole('region', { name: 'お客様' }),
      ).toHaveTextContent(KENJI.name)
    })

    it('should name the customer who referred this one, lead to their page, and say of one who was removed that they are not in the ledger', async () => {
      // Arrange
      const user = userEvent.setup()
      await referredMeanwhile(SAKURA.email, YUKI.email)
      const [sakura, yuki] = await Promise.all([
        customerIdOf(SAKURA.email),
        customerIdOf(YUKI.email),
      ])
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${sakura}`,
      )
      await theCustomer()

      // Act
      await user.click(
        await within(part('台帳')).findByRole('link', {
          name: `${YUKI.name} 様`,
        }),
      )

      // Assert
      await waitFor(() =>
        expect(address()).toBe(`/salons/${tokyo}/customers/${yuki}`),
      )
      expect(
        await screen.findByText('Tanaka Yuki（タナカ ユキ） 様'),
      ).toBeVisible()

      // Act
      await removeMeanwhile(YUKI.email)
      await user.click(screen.getByRole('link', { name: '顧客' }))
      await theLedger()
      await user.click(screen.getByRole('link', { name: SAKURA.name }))

      // Assert
      await theCustomer()
      await waitFor(() =>
        expect(describedIn('台帳')['紹介元']).toBe('台帳にいないお客様'),
      )
      expect(
        within(part('台帳')).getByText('台帳にいないお客様').closest('a'),
      ).not.toBeInTheDocument()
    })

    it('should say that a customer is not found who is not in the ledger, and lead to the ledger', async () => {
      // Arrange
      const kenji = await customerIdOf(KENJI.email)
      await removeMeanwhile(KENJI.email)

      // Act
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${kenji}`,
      )

      // Assert
      await heading('お客様が見つかりません')
      expect(screen.getByRole('link', { name: '顧客台帳へ' })).toHaveAttribute(
        'href',
        `/salons/${tokyo}/customers`,
      )
    })

    it('should say to a member of another salon that its use of the salon is not theirs to see, and show the rest of the customer', async () => {
      // Arrange
      const osaka = await salonIdOf(OSAKA)
      const sakura = await customerIdOf(SAKURA.email)

      // Act
      renderAt(`/salons/${osaka}/customers/${sakura}`)
      await signInAs(STYLIST)

      // Assert
      await heading('お客様の台帳')
      await screen.findByRole('region', { name: '台帳' })
      await within(part('好み設定')).findAllByRole('term')
      expect(
        await within(part('このサロンでの利用')).findByText(
          'このサロンの利用の集計は、見られません。利用の集計を見られるのは、そのサロンのスタッフと、管理者です。',
        ),
      ).toBeVisible()
      expect(describedIn('台帳')).toMatchObject({
        電話番号: '+81-70-1111-2222',
      })
    })
  })

  describe('changing a customer', () => {
    it('should send what was changed, keep what another salon wrote meanwhile, and show the customer so at once', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      const lastVisit = await dayFromToday(-5)
      const tokyo = await openAt((salon) => `/salons/${salon}/customers`)
      await theLedger()
      await user.click(screen.getByRole('link', { name: KENJI.name }))
      await theCustomer()
      await user.click(screen.getByRole('link', { name: '台帳を直す' }))
      await heading('台帳を直す')
      await screen.findByRole('textbox', { name: '姓' })
      expect(text('タグ')).toHaveValue('regular、monthly')
      expect(await findAccessibilityViolations(document.body)).toEqual([])
      await writeNoteMeanwhile(KENJI.email, '駐車場を使う')

      // Act
      await user.clear(text('電話番号'))
      await user.type(text('電話番号'), '080-1111-2222')
      await user.type(text('タグ'), '、紹介')
      await user.selectOptions(field('ステータス'), '休眠')
      await user.click(screen.getByRole('checkbox', { name: '有効なお客様' }))
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await theCustomer()
      expect(address()).toBe(`/salons/${tokyo}/customers/${kenji}`)
      expect(firstSight()[1]).toContain('080-1111-2222')
      expect(notifications()).toContain('台帳を直しました。')
      expect(describedIn('台帳')).toMatchObject({
        電話番号: '080-1111-2222',
        ステータス: '休眠',
        有効: '無効（ご自分では予約を入れられません）',
        タグ: 'regularmonthly紹介',
      })
      expect(await storedCustomerOf(KENJI.email)).toMatchObject({
        phoneNumber: '080-1111-2222',
        customerStatus: 'inactive',
        isActive: false,
        tags: ['regular', 'monthly', '紹介'],
        notes: '駐車場を使う',
        allowSms: false,
      })

      // Act
      await user.click(screen.getByRole('link', { name: '顧客' }))

      // Assert: the ledger that was read before shows the customer as they are
      await theLedger()
      expect(rowsOf('顧客台帳')).toContainEqual([
        KENJI.name,
        // The cell that chooses the customer: the label of its checkbox, read by a screen reader
        `${KENJI.name} 様を選ぶ`,
        'ヤマモト ケンジ',
        '080-1111-2222',
        'シルバー',
        '休眠',
        '2 回',
        dayNameOf(lastVisit),
      ])
    })

    it('should open the form only once the customer was read anew, not with what the page read before', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${kenji}`,
      )
      await theCustomer()
      await writeNoteMeanwhile(KENJI.email, '駐車場を使う')

      // Act
      await user.click(screen.getByRole('link', { name: '台帳を直す' }))

      // Assert: no control at first sight, then the note written meanwhile
      await heading('台帳を直す')
      expect(firstSight()[0]).toBe(`/salons/${tokyo}/customers/${kenji}/edit`)
      expect(firstSight()[1]).not.toContain('備考')
      expect(await screen.findByRole('textbox', { name: '備考' })).toHaveValue(
        '駐車場を使う',
      )
    })

    it('should ask for nothing when nothing was changed', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      const { updatedAt } = await storedCustomerOf(KENJI.email)
      await openAt((salon) => `/salons/${salon}/customers/${kenji}/edit`)
      await heading('台帳を直す')
      await screen.findByRole('textbox', { name: '姓' })

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await theCustomer()
      expect(notifications()).toContain('変更された項目はありません。')
      expect((await storedCustomerOf(KENJI.email)).updatedAt).toBe(updatedAt)
    })

    it('should say at its control that another customer has the address of mail, and keep the customer as they were', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await openAt((salon) => `/salons/${salon}/customers/${kenji}/edit`, OWNER)
      await heading('台帳を直す')
      await screen.findByRole('textbox', { name: '姓' })

      // Act
      await user.clear(text('メールアドレス'))
      await user.type(text('メールアドレス'), YUKI.email)
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await waitFor(() => expect(text('メールアドレス')).toHaveFocus())
      expect(text('メールアドレス')).toHaveAccessibleDescription(
        expect.stringContaining(
          'このメールアドレスのお客様が、すでに台帳にいます。',
        ),
      )
      expect((await storedCustomerOf(KENJI.email)).email).toBe(KENJI.email)
    })

    it('should open with the referrer by name, send no referrer once they were taken away, and say so on the page', async () => {
      // Arrange
      const user = userEvent.setup()
      await referredMeanwhile(SAKURA.email, YUKI.email)
      const sakura = await customerIdOf(SAKURA.email)
      await openAt((salon) => `/salons/${salon}/customers/${sakura}/edit`)
      await heading('台帳を直す')
      expect(
        await screen.findByRole('textbox', { name: '紹介元' }),
      ).toHaveValue(`${YUKI.name} 様`)

      // Act
      await user.click(screen.getByRole('button', { name: '紹介元を外す' }))
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await theCustomer()
      expect(describedIn('台帳')['紹介元']).toBe('なし')
      expect((await storedCustomerOf(SAKURA.email)).referredBy).toBeNull()
    })

    it('should not offer the customer as their own referrer, and change the referrer to the one chosen', async () => {
      // Arrange
      const user = userEvent.setup()
      const [kenji, yuki] = await Promise.all([
        customerIdOf(KENJI.email),
        customerIdOf(YUKI.email),
      ])
      await openAt((salon) => `/salons/${salon}/customers/${kenji}/edit`)
      await heading('台帳を直す')
      await screen.findByRole('textbox', { name: '紹介元' })
      await user.click(screen.getByRole('button', { name: '紹介元を選ぶ' }))
      await user.type(
        within(referrerDialog()).getByRole('searchbox', {
          name: 'キーワード',
        }),
        'example.com{Enter}',
      )

      // Assert
      expect(
        await within(referrerDialog()).findByText(
          `${KENJI.name}（このお客様）`,
        ),
      ).toBeVisible()
      expect(
        within(referrerDialog()).queryByRole('button', { name: KENJI.name }),
      ).not.toBeInTheDocument()

      // Act
      await user.click(
        within(referrerDialog()).getByRole('button', { name: YUKI.name }),
      )
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await theCustomer()
      expect((await storedCustomerOf(KENJI.email)).referredBy).toBe(yuki)
    })

    it('should keep a referrer who was removed from the ledger when something else is changed', async () => {
      // Arrange
      const user = userEvent.setup()
      await referredMeanwhile(SAKURA.email, YUKI.email)
      const [sakura, yuki] = await Promise.all([
        customerIdOf(SAKURA.email),
        customerIdOf(YUKI.email),
      ])
      await removeMeanwhile(YUKI.email)
      await openAt((salon) => `/salons/${salon}/customers/${sakura}/edit`)
      await heading('台帳を直す')
      expect(
        await screen.findByRole('textbox', { name: '紹介元' }),
      ).toHaveValue('台帳にいないお客様')

      // Act
      await user.type(text('備考'), '駐車場を使う')
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await theCustomer()
      expect(await storedCustomerOf(SAKURA.email)).toMatchObject({
        notes: '駐車場を使う',
        referredBy: yuki,
      })
    })

    it('should say at the referrer that the customer chosen was removed while the form was open, and change nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await openAt((salon) => `/salons/${salon}/customers/${kenji}/edit`)
      await heading('台帳を直す')
      await screen.findByRole('textbox', { name: '紹介元' })
      await chooseReferrer(user, 'tanaka', YUKI.name)
      await removeMeanwhile(YUKI.email)

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await waitFor(() => expect(text('紹介元')).toHaveFocus())
      expect(text('紹介元')).toHaveAttribute('aria-invalid', 'true')
      expect(text('紹介元')).toHaveAccessibleDescription(
        expect.stringContaining(
          '選んだお客様は、台帳にいません。紹介元を選び直すか、外してください。',
        ),
      )
      expect((await storedCustomerOf(KENJI.email)).referredBy).toBeNull()
    })

    it('should say that the customer is gone when they were removed while the form was open', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await openAt((salon) => `/salons/${salon}/customers/${kenji}/edit`)
      await heading('台帳を直す')
      await screen.findByRole('textbox', { name: '姓' })
      await removeMeanwhile(KENJI.email)

      // Act
      await user.clear(text('電話番号'))
      await user.type(text('電話番号'), '080-1111-2222')
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      await heading('お客様が見つかりません')
      expect(screen.getByRole('link', { name: '顧客台帳へ' })).toBeVisible()
    })

    it('should say that the ledger was not changed when the database fails, and keep what was filled in', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await refuse('update', 'customers')
      await openAt((salon) => `/salons/${salon}/customers/${kenji}/edit`)
      await heading('台帳を直す')
      await screen.findByRole('textbox', { name: '姓' })

      // Act
      await user.clear(text('電話番号'))
      await user.type(text('電話番号'), '080-1111-2222')
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '台帳を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(text('電話番号')).toHaveValue('080-1111-2222')
    })
  })
})
