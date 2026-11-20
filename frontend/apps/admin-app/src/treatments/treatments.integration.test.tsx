import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  ADMIN,
  arrange,
  arrangeMany,
  dayFromToday,
  KENJI,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
  YUKI,
} from '../bookings/__tests__/arrangements'
import {
  customerIdOf,
  removeMeanwhile,
  staffRemovedMeanwhile,
} from '../customers/__tests__/arrangements'
import {
  bookingHrefOf,
  customerHrefOf,
  treatmentChangeHrefOf,
  treatmentEntryHrefOf,
  treatmentHrefOf,
  treatmentsHrefOf,
} from '../navigation'
import {
  bookingCancelledMeanwhile,
  bookingRemovedMeanwhile,
  evaluationWrittenMeanwhile,
  lotOf,
  productRemovedMeanwhile,
  recordMany,
  storedTreatmentCount,
  storedTreatmentOf,
  treatedBookingOf,
  treatmentIdOf,
  treatmentRemovedMeanwhile,
  writtenMeanwhile,
} from './__tests__/arrangements'

/*
 * The treatment records of the seed data are those of the three visits
 * that took place at the salon in Tokyo (`__tests__/arrangements.ts`). A
 * test that writes one arranges a booking of Yamamoto Kenji, who has none,
 * by Hiroshi Tanaka, of a ladies' cut. An owner works, unless a test says
 * otherwise; another account did something meanwhile.
 */

const TITLE = 'Beauty Salon Admin'

const VIP = { email: 'vip.customer@example.com', name: 'Nakamura Hiroshi' }

const MASK = 'Intensive Hair Mask 250ml（TREAT001）'
const SHAMPOO = 'Professional Shampoo 500ml（SHMP001）'

/** The path a screen was opened at, and what the page showed in the commit that opened it */
let firstSight: [string, string] = ['', '']

const FirstSight = () => {
  const { pathname } = useLocation()
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
        <FirstSight />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** What the application says in its notifications. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((said) => said !== '')

/** The rows of a table, each as the texts of its cells, but for when a record was written. */
const rowsOf = (table: HTMLElement): (string | null)[][] =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .queryAllByRole('cell')
        .map((cell) => cell.textContent),
    )

/** The rows of the materials of a record, cell by cell. */
const materialsOf = (): (string | null)[][] =>
  within(screen.getByRole('table', { name: '使った商材の一覧' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

/** What a card says, term by term */
const termsOf = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** Waits until the form of a record is shown. */
const theForm = (): Promise<HTMLElement> =>
  screen.findByRole('group', { name: '提供したサービス' })

const material = (place: number): HTMLElement =>
  screen.getByRole('group', { name: `${place} 件目の商材` })

/** Arranges a booking of Yamamoto Kenji that was done today, by Hiroshi Tanaka, of a ladies' cut. */
const arrangeVisit = (): Promise<string> =>
  arrange({
    bookingNumber: 'BK-TREAT-0001',
    day: 0,
    at: '10:00',
    status: 'completed',
    customer: KENJI.email,
  })

/** Arranges a booking of Yamamoto Kenji of tomorrow, confirmed. */
const arrangeUpcoming = (): Promise<string> =>
  arrange({
    bookingNumber: 'BK-TREAT-0002',
    day: 1,
    at: '10:00',
    status: 'confirmed',
    customer: KENJI.email,
  })

/** Opens the writing of the record of a booking, signed in, and waits for the form. */
const openEntryOf = async (
  bookingId: string,
  account = OWNER,
): Promise<void> => {
  renderAt(treatmentEntryHrefOf(await salonIdOf(TOKYO), bookingId))
  await signInAs(account)
  await theForm()
}

/** Opens the change of the record of a customer of the seed data, signed in, and waits for the form. */
const openChangeOf = async (email: string, account = OWNER): Promise<void> => {
  renderAt(
    treatmentChangeHrefOf(await salonIdOf(TOKYO), await treatmentIdOf(email)),
  )
  await signInAs(account)
  await theForm()
}

/** Adds a material of a product, and gives its row. */
const addMaterial = async (
  user: ReturnType<typeof userEvent.setup>,
  product: string,
  quantity: string,
): Promise<HTMLElement> => {
  await user.click(screen.getByRole('button', { name: '商材を足す' }))
  const rows = screen.getAllByRole('group', { name: /件目の商材/ })
  const row = rows.at(-1) ?? document.body
  await user.selectOptions(
    within(row).getByRole('combobox', { name: '商品' }),
    product,
  )
  await user.type(within(row).getByRole('textbox', { name: '量' }), quantity)

  return row
}

describe('the treatment records, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should list the records of the salon, the latest written first, with who had them, who did them and what they were', async () => {
    // Act
    renderAt(treatmentsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Assert
    await heading('施術記録')
    const table = await screen.findByRole('table', { name: '施術記録' })
    expect(rowsOf(table)).toEqual([
      [
        `${VIP.name} 様`,
        'Mika Suzuki',
        'Full Color、Ladies Cut',
        '120 分',
        '4（満足）',
      ],
      [`${SAKURA.name} 様`, 'Yui Watanabe', 'Mens Cut', '45 分', '未回答'],
      [
        `${YUKI.name} 様`,
        'Hiroshi Tanaka',
        'Ladies Cut、Deep Conditioning Treatment',
        '75 分',
        '5（とても満足）',
      ],
    ])
    expect(within(table).getAllByRole('rowheader')[0]?.textContent).toMatch(
      /^\d{4}年\d{1,2}月\d{1,2}日（.） \d{2}:\d{2}$/,
    )
    expect(screen.getByText('3 件')).toBeInTheDocument()
  })

  it('should narrow the records to those of a member of the staff, and keep it in the address', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(treatmentsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: '施術記録' })

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '担当' }),
      'Yui Watanabe',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    const table = await screen.findByRole('table', {
      name: '条件に合う施術記録',
    })
    expect(rowsOf(table)).toEqual([
      [`${SAKURA.name} 様`, 'Yui Watanabe', 'Mens Cut', '45 分', '未回答'],
    ])
    expect(screen.getByRole('link', { name: '条件をすべて外す' })).toBeVisible()
  })

  it('should narrow the records to the days they were written on at the salon, and refuse a last day before the first', async () => {
    // Arrange
    const user = userEvent.setup()
    const today = await dayFromToday(0)
    const tomorrow = await dayFromToday(1)
    renderAt(treatmentsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: '施術記録' })

    // Act
    await user.type(screen.getByLabelText('書いた日（から）'), tomorrow)
    await user.type(screen.getByLabelText('書いた日（まで）'), today)
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    const to = screen.getByLabelText('書いた日（まで）')
    expect(to).toHaveAccessibleDescription(
      '終わりの日は、始まりの日と同じか、その後にしてください。',
    )
    expect(to).toHaveFocus()

    // Act
    await user.clear(to)
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(
      await screen.findByText('条件に合う施術記録はありません'),
    ).toBeInTheDocument()
  })

  it('should lead from the customer to their records, and from there to every customer', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    renderAt(customerHrefOf(salonId, await customerIdOf(YUKI.email)))
    await signInAs(OWNER)
    await heading('お客様の台帳')

    // Act
    await user.click(
      await screen.findByRole('link', { name: '施術記録を見る' }),
    )

    // Assert
    await heading('施術記録')
    expect(
      await screen.findByText(`お客様：${YUKI.name} 様`),
    ).toBeInTheDocument()
    expect(
      rowsOf(await screen.findByRole('table', { name: '条件に合う施術記録' })),
    ).toEqual([
      [
        `${YUKI.name} 様`,
        'Hiroshi Tanaka',
        'Ladies Cut、Deep Conditioning Treatment',
        '75 分',
        '5（とても満足）',
      ],
    ])

    // Act
    await user.click(screen.getByRole('link', { name: 'すべてのお客様にする' }))

    // Assert
    expect(
      within(
        await screen.findByRole('table', { name: '施術記録' }),
      ).getAllByRole('rowheader'),
    ).toHaveLength(3)
  })

  it('should read the records that come next', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMany(-1, 21)
    await recordMany()
    renderAt(treatmentsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: '施術記録' })
    expect(
      screen.getByText('24 件（20 件を表示しています）'),
    ).toBeInTheDocument()

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText('24 件')).toBeInTheDocument()
    const links = within(
      screen.getByRole('table', { name: '施術記録' }),
    ).getAllByRole('rowheader')
    expect(links).toHaveLength(24)
    expect(within(links[20] ?? document.body).getByRole('link')).toHaveFocus()
  })

  it('should show a record with its materials and their lots, and lead to its booking and its customer', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const bookingId = await treatedBookingOf(VIP.email)

    // Act
    renderAt(treatmentHrefOf(salonId, await treatmentIdOf(VIP.email)))
    await signInAs(OWNER)

    // Assert
    await screen.findByRole('table', { name: '使った商材の一覧' })
    expect(termsOf('施術').filter(([term]) => term !== '書いた日時')).toEqual([
      ['お客様', `${VIP.name} 様`],
      // The seed data puts its bookings on days counted from the day it ran
      [
        '予約',
        expect.stringMatching(
          /^BK-SEED-0004（\d{4}年\d{1,2}月\d{1,2}日（.））$/,
        ),
      ],
      ['担当', 'Mika Suzuki'],
      ['提供したサービス', 'Full ColorLadies Cut'],
      ['技法', 'ワンメイクカラーレイヤーカット'],
      ['施術時間', '120 分'],
    ])
    expect(termsOf('カウンセリングと状態')).toEqual([
      [
        'カウンセリングのメモ',
        '前回より明るめのブラウンを希望。頭皮のしみる感じはなし',
      ],
      ['頭皮の状態', 'やや乾燥'],
      ['毛髪の状態', '中間から毛先に前回のカラーの退色'],
      ['カラー剤の配合', 'ブラウン 7 レベル 1:1、6% オキシ、放置 25 分'],
    ])
    expect(materialsOf()).toEqual([
      [
        'Hair Color - Natural Brown（COLOR001）',
        '1 tube',
        await lotOf('COLOR001'),
        '',
      ],
      [
        'Developer 6% 1000ml（DEVELOPER001）',
        '0.5 bottle',
        await lotOf('DEVELOPER001'),
        '6% を使用',
      ],
    ])
    expect(
      screen.getByRole('link', { name: `${VIP.name} 様` }),
    ).toHaveAttribute(
      'href',
      customerHrefOf(salonId, await customerIdOf(VIP.email)),
    )
    expect(screen.getByRole('link', { name: /^BK-SEED-0004/ })).toHaveAttribute(
      'href',
      bookingHrefOf(salonId, bookingId),
    )
  })

  it('should write the record of a booking that was done from its page, with a material of a lot, and show it', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await arrangeVisit()
    const lot = await lotOf('TREAT001')
    const nextVisit = await dayFromToday(28)
    renderAt(bookingHrefOf(await salonIdOf(TOKYO), bookingId))
    await signInAs(STYLIST)
    const part = await screen.findByRole('region', { name: '施術記録' })
    await user.click(
      await within(part).findByRole('link', { name: '施術記録を書く' }),
    )
    await heading('施術記録を書く')
    await theForm()
    expect(screen.getByRole('combobox', { name: '担当' })).toHaveDisplayValue(
      'Hiroshi Tanaka',
    )

    // Act: a material is added, another added and taken away
    await addMaterial(user, MASK, '15')
    await addMaterial(user, SHAMPOO, '1')
    await user.click(screen.getByRole('button', { name: '2 件目の商材を外す' }))
    await user.type(
      screen.getByRole('textbox', { name: '技法' }),
      'レイヤーカット、ブロー',
    )
    await user.type(
      screen.getByRole('textbox', { name: '施術時間（分）' }),
      '60',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'お客様の満足度' }),
      '4（満足）',
    )
    await user.type(screen.getByLabelText('次に勧める日'), nextVisit)
    await user.click(
      within(
        screen.getByRole('group', { name: '次に勧めるサービス' }),
      ).getByRole('checkbox', { name: 'Ladies Cut' }),
    )
    await user.click(screen.getByRole('button', { name: '施術記録を書く' }))

    // Assert: the lot of a product kept by lots is asked for
    const lotNumber = within(material(1)).getByRole('textbox', {
      name: 'ロット番号',
    })
    expect(lotNumber).toHaveAccessibleDescription(
      expect.stringContaining('ロット番号を入力してください。'),
    )
    expect(lotNumber).toHaveFocus()

    // Act
    await user.type(lotNumber, lot)
    await user.click(screen.getByRole('button', { name: '施術記録を書く' }))

    // Assert
    await screen.findByRole('table', { name: '使った商材の一覧' })
    expect(notifications()).toContain(
      `${KENJI.name} 様の施術記録を書きました。`,
    )
    expect(materialsOf()).toEqual([[MASK, '15 jar', lot, '']])
    const { updatedAt: _updatedAt, ...stored } =
      (await storedTreatmentOf(bookingId)) ?? {}
    expect(stored).toEqual({
      staff: 'Hiroshi Tanaka',
      services: ['Ladies Cut'],
      techniques: ['レイヤーカット', 'ブロー'],
      consultationNotes: null,
      scalpCondition: null,
      hairCondition: null,
      colorFormula: null,
      processingTime: 60,
      resultNotes: null,
      nextRecommendedDate: nextVisit,
      nextRecommendedServices: ['Ladies Cut'],
      homeCareSuggestions: null,
      customerSatisfaction: 4,
      staffEvaluation: null,
      materials: [
        {
          productCode: 'TREAT001',
          quantity: '15.00',
          unit: 'jar',
          lotNumber: lot,
          notes: null,
        },
      ],
    })
  })

  it('should say on the page of a booking whose treatment has not begun that its record is written later', async () => {
    // Arrange
    const bookingId = await arrangeUpcoming()

    // Act
    renderAt(bookingHrefOf(await salonIdOf(TOKYO), bookingId))
    await signInAs(OWNER)

    // Assert
    const part = await screen.findByRole('region', { name: '施術記録' })
    expect(
      within(part).getByText('施術を始めると、施術記録を書けます。'),
    ).toBeVisible()
    expect(within(part).queryByRole('link')).toBeNull()
  })

  it('should offer no form for a booking whose treatment has not begun', async () => {
    // Arrange
    const bookingId = await arrangeUpcoming()

    // Act
    renderAt(treatmentEntryHrefOf(await salonIdOf(TOKYO), bookingId))
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'この予約は、施術中でも完了でもありません。施術を始めた予約に、施術記録を書けます。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '提供したサービス' })).toBeNull()
  })

  it('should lead from a booking whose record was written to the record, and write no other', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const bookingId = await treatedBookingOf(YUKI.email)
    renderAt(treatmentEntryHrefOf(salonId, bookingId))
    await signInAs(OWNER)

    // Act
    await user.click(
      await screen.findByRole('link', { name: '施術記録を見る' }),
    )

    // Assert
    await screen.findByRole('table', { name: '使った商材の一覧' })
    expect(termsOf('施術')[0]).toEqual(['お客様', `${YUKI.name} 様`])
    expect(screen.queryByRole('group', { name: '提供したサービス' })).toBeNull()
  })

  it('should lead to the record another account wrote of the booking meanwhile, and keep it', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const bookingId = await arrangeVisit()
    await openEntryOf(bookingId)
    const written = await writtenMeanwhile(bookingId)

    // Act
    await user.click(screen.getByRole('button', { name: '施術記録を書く' }))

    // Assert
    const said = await screen.findByText(
      /その間に、ほかのアカウントがこの予約の施術記録を書いていました。/,
    )
    expect(
      within(said).getByRole('link', { name: '書かれていた施術記録を見る' }),
    ).toHaveAttribute('href', treatmentHrefOf(salonId, written))
    expect(await storedTreatmentOf(bookingId)).toMatchObject({
      resultNotes: 'ほかのアカウントが書いた',
    })
  })

  it.each<[string, () => Promise<unknown>, string, string]>([
    [
      'the member of the staff',
      () => staffRemovedMeanwhile('Hiroshi Tanaka'),
      '担当',
      'このスタッフは、その間に削除されたか、ほかのサロンに移りました。ほかのスタッフを選んでください。',
    ],
    [
      'the product of a material',
      () => productRemovedMeanwhile('TREAT001'),
      '商品',
      'この商品は、その間に削除されました。ほかの商品を選ぶか、この商材を外してください。',
    ],
  ])(
    'should say at its control that %s was removed meanwhile',
    async (_case, removedMeanwhile, control, said) => {
      // Arrange
      const user = userEvent.setup()
      const bookingId = await arrangeVisit()
      await openEntryOf(bookingId)
      const row = await addMaterial(user, MASK, '1')
      await user.type(
        within(row).getByRole('textbox', { name: 'ロット番号' }),
        await lotOf('TREAT001'),
      )
      await removedMeanwhile()

      // Act
      await user.click(screen.getByRole('button', { name: '施術記録を書く' }))

      // Assert
      const refused = screen.getByRole('combobox', { name: control })
      await waitFor(() =>
        expect(refused).toHaveAccessibleDescription(
          expect.stringContaining(said),
        ),
      )
      expect(refused).toHaveFocus()
      expect(await storedTreatmentOf(bookingId)).toBeUndefined()
    },
  )

  it('should say that the customer left the ledger meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await arrangeVisit()
    await openEntryOf(bookingId)
    await removeMeanwhile(KENJI.email)

    // Act
    await user.click(screen.getByRole('button', { name: '施術記録を書く' }))

    // Assert
    expect(
      await screen.findByText(
        'このお客様は、その間に台帳から削除されました。施術記録は書けません。',
      ),
    ).toBeInTheDocument()
    expect(await storedTreatmentOf(bookingId)).toBeUndefined()
  })

  it('should say above the form that the booking was cancelled meanwhile, and keep what was written', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await arrangeVisit()
    await openEntryOf(bookingId)
    const time = screen.getByRole('textbox', { name: '施術時間（分）' })
    await user.type(time, '50')
    await bookingCancelledMeanwhile(bookingId)

    // Act
    await user.click(screen.getByRole('button', { name: '施術記録を書く' }))

    // Assert
    const said = await screen.findByText(
      'この予約は、施術中でも完了でもありません。施術を始めた予約に、施術記録を書けます。',
    )
    // The alert takes the focus in the part that holds it
    await waitFor(() => expect(said.closest('[tabindex="-1"]')).toHaveFocus())
    expect(time).toHaveValue('50')
    expect(await storedTreatmentOf(bookingId)).toBeUndefined()
  })

  it('should not show a record at the address of another salon', async () => {
    // Arrange
    const treatmentId = await treatmentIdOf(VIP.email)

    // Act
    renderAt(treatmentHrefOf(await salonIdOf(OSAKA), treatmentId))
    await signInAs(ADMIN)

    // Assert
    expect(await heading('施術記録が見つかりません')).toHaveFocus()
    expect(screen.queryByRole('table', { name: '使った商材の一覧' })).toBeNull()
  })

  it('should say that the booking was removed meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await arrangeVisit()
    await openEntryOf(bookingId)
    await bookingRemovedMeanwhile(bookingId)

    // Act
    await user.click(screen.getByRole('button', { name: '施術記録を書く' }))

    // Assert
    expect(await heading('予約が見つかりません')).toBeInTheDocument()
    expect(await storedTreatmentCount()).toBe(3)
  })

  it('should send what was changed, replace the materials, and keep what another account wrote meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await treatedBookingOf(YUKI.email)
    await openChangeOf(YUKI.email, STYLIST)
    expect(screen.queryByRole('combobox', { name: '担当' })).toBeNull()
    await evaluationWrittenMeanwhile(
      await treatmentIdOf(YUKI.email),
      '次は毛先を 1 cm 多めに切る',
    )

    // Act
    const time = screen.getByRole('textbox', { name: '施術時間（分）' })
    await user.clear(time)
    await user.type(time, '80')
    await user.click(screen.getByRole('button', { name: '1 件目の商材を外す' }))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('使った商材はありません'),
    ).toBeInTheDocument()
    expect(notifications()).toContain(`${YUKI.name} 様の施術記録を直しました。`)
    expect(await storedTreatmentOf(bookingId)).toMatchObject({
      staff: 'Hiroshi Tanaka',
      processingTime: 80,
      materials: [],
      staffEvaluation: '次は毛先を 1 cm 多めに切る',
      homeCareSuggestions: '週 1 回の集中トリートメント',
    })
  })

  it('should ask for nothing when nothing was changed', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await treatedBookingOf(VIP.email)
    const before = await storedTreatmentOf(bookingId)
    await openChangeOf(VIP.email)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await screen.findByRole('table', { name: '使った商材の一覧' })
    expect(notifications()).toContain('変更はありませんでした。')
    expect(await storedTreatmentOf(bookingId)).toEqual(before)
  })

  it('should say that the record was removed meanwhile, and lead to the list', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChangeOf(SAKURA.email)
    await treatmentRemovedMeanwhile(await treatmentIdOf(SAKURA.email))

    // Act
    await user.type(
      screen.getByRole('textbox', { name: '施術時間（分）' }),
      '0',
    )
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await heading('施術記録が見つかりません')
    expect(
      screen.getByRole('link', { name: '施術記録の一覧へ' }),
    ).toHaveAttribute('href', treatmentsHrefOf(await salonIdOf(TOKYO)))
  })

  it('should remove a record after the dialog asked, and show the list without it', async () => {
    // Arrange: the record is opened from the list
    const user = userEvent.setup()
    const bookingId = await treatedBookingOf(SAKURA.email)
    const salonId = await salonIdOf(TOKYO)
    renderAt(treatmentsHrefOf(salonId))
    await signInAs(OWNER)
    await user.click(
      within(
        await screen.findByRole('table', { name: '施術記録' }),
      ).getAllByRole('link', { name: /^\d{4}年/ })[1] ?? document.body,
    )
    await user.click(await screen.findByRole('button', { name: '削除' }))
    const dialog = await screen.findByRole('dialog', {
      name: `${SAKURA.name} 様の施術記録を削除しますか？`,
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert: the list read before is not shown
    const table = await screen.findByRole('table', { name: '施術記録' })
    expect(notifications()).toContain(
      `${SAKURA.name} 様の施術記録を削除しました。`,
    )
    expect(firstSight[0]).toBe(treatmentsHrefOf(salonId))
    // Her row is the one with a men's cut
    expect(firstSight[1]).not.toContain('Mens Cut')
    expect(within(table).getAllByRole('rowheader')).toHaveLength(2)
    expect(await storedTreatmentOf(bookingId)).toBeUndefined()
  })

  it('should open the change of a record from its page with the focus on its heading, and lead back', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(
      treatmentHrefOf(await salonIdOf(TOKYO), await treatmentIdOf(VIP.email)),
    )
    await signInAs(OWNER)
    await heading('施術記録の内容')

    // Act
    await user.click(
      await screen.findByRole('link', { name: '施術記録を直す' }),
    )

    // Assert
    await theForm()
    expect(await heading('施術記録を直す')).toHaveFocus()

    // Act
    await user.click(screen.getByRole('link', { name: 'やめる' }))

    // Assert
    expect(await heading('施術記録の内容')).toHaveFocus()
  })

  it('should let a member of the staff change a record, and not remove it', async () => {
    // Act
    renderAt(
      treatmentHrefOf(await salonIdOf(TOKYO), await treatmentIdOf(YUKI.email)),
    )
    await signInAs(STYLIST)

    // Assert
    expect(
      await screen.findByRole('link', { name: '施術記録を直す' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: '削除' })).toBeNull()
  })

  it.each<
    [string, (salonId: string) => Promise<string>, () => Promise<unknown>]
  >([
    [
      'the list',
      async (salonId) => treatmentsHrefOf(salonId),
      () => screen.findByRole('table', { name: '施術記録' }),
    ],
    [
      'a record',
      async (salonId) =>
        treatmentHrefOf(salonId, await treatmentIdOf(VIP.email)),
      () => screen.findByRole('table', { name: '使った商材の一覧' }),
    ],
    [
      'the writing of a record',
      async (salonId) => treatmentEntryHrefOf(salonId, await arrangeVisit()),
      theForm,
    ],
    [
      'the change of a record',
      async (salonId) =>
        treatmentChangeHrefOf(salonId, await treatmentIdOf(VIP.email)),
      theForm,
    ],
  ])('should be accessible on %s', async (_, hrefOf, shown) => {
    // Arrange
    renderAt(await hrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
