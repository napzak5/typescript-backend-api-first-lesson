import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  KENJI,
  MANAGER,
  OWNER,
  SAKURA,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
  YUKI,
} from '../bookings/__tests__/arrangements'
import {
  arrangeCrowd,
  customerIdOf,
  removedMeanwhile,
} from '../customers/__tests__/arrangements'
import {
  chartChangeHrefOf,
  chartEntryHrefOf,
  chartHrefOf,
  chartSearchHrefOf,
  customerHrefOf,
} from '../navigation'
import {
  chartMadeMeanwhile,
  chartsOfTagged,
  conditionsWrittenMeanwhile,
  storedChartOf,
} from './__tests__/arrangements'

/*
 * The charts of the seed data: Tanaka Yuki has one, with allergies
 * recorded, and so has Sato Sakura, without; Yamamoto Kenji has none. An
 * owner writes them, unless a test says otherwise; a manager did something
 * meanwhile.
 */

/** A moment at the salon, as the screens show one: 「2026年11月18日（水） 14:30」 */
const MOMENT = /^\d{4}年\d{1,2}月\d{1,2}日（.） \d{2}:\d{2}$/

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
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

const part = (name: string): HTMLElement => screen.getByRole('region', { name })

const treatment = (place: number): HTMLElement =>
  screen.getByRole('group', { name: `${place} 件目の施術` })

/** What the part of the chart describes, term by term. */
const described = (): Record<string, string> =>
  Object.fromEntries(
    within(part('カルテ'))
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )

/** The rows of a table, each as the texts of its cells. */
const rowsOf = (table: HTMLElement): (string | null)[][] =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).getAllByRole('rowheader'),
        ...within(row).getAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

/** The customers the table of the search lists, in the order of their names. */
const customersListed = (name: string): (string | null)[] =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('rowheader')
    .map((header) => header.textContent)
    .toSorted()

/**
 * Opens a screen of the chart of a customer in the salon in Tokyo,
 * signed in: the chart itself, or the screen below it (`/new`, `/edit`).
 */
const openChartOf = async (
  email: string,
  below: '' | '/new' | '/edit' = '',
  account = OWNER,
): Promise<{ salonId: string; customerId: string }> => {
  const customerId = await customerIdOf(email)
  const salonId = await salonIdOf(TOKYO)
  renderAt(`${chartHrefOf(salonId, customerId)}${below}`)
  await signInAs(account)

  return { salonId, customerId }
}

/** Waits until the form of the chart is shown. */
const theForm = (): Promise<HTMLElement> =>
  screen.findByRole('group', { name: '施術の前に確かめること' })

describe('the charts of the customers, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should show the chart of the customer, with the treatments they had before', async () => {
    // Act
    const { salonId, customerId } = await openChartOf(YUKI.email)
    await heading('カルテ')
    await screen.findByRole('region', { name: '過去の施術' })

    // Assert
    expect(described()).toEqual({
      持病や体調: '頭皮が乾燥しやすく、季節の変わり目にかゆみが出る',
      好みの商材: 'Avedaオーガニックシャンプー',
      避ける商材: '強い香料の整髪料',
      メモ: 'シャンプーはぬるめのお湯を希望',
      最後に書いた日時: expect.stringMatching(MOMENT),
    })
    expect(rowsOf(within(part('過去の施術')).getByRole('table'))).toEqual([
      [
        '2026年3月14日（土）',
        'カラー',
        'Hair Studio Aoyama',
        'ブリーチ 1 回のハイライト',
      ],
      ['2025年11月2日（日）', 'パーマ', '未登録', ''],
    ])
    expect(
      screen.getByRole('link', { name: 'お客様の台帳へ' }),
    ).toHaveAttribute('href', customerHrefOf(salonId, customerId))
  })

  it('should make the chart of a customer who has none, with the treatments they had before', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(KENJI.email)
    await user.click(await screen.findByRole('link', { name: 'カルテを作る' }))
    await heading('カルテを作る')
    await theForm()

    // Act
    await user.type(
      screen.getByRole('textbox', { name: '持病や体調' }),
      '肩こりがひどい',
    )
    await user.type(
      screen.getByRole('textbox', { name: '好みの商材' }),
      'Aveda、無香料のオイル、Aveda',
    )
    await user.click(screen.getByRole('button', { name: '施術を足す' }))
    await user.selectOptions(
      within(treatment(1)).getByRole('combobox', { name: '施術' }),
      'ヘッドスパ',
    )
    await user.type(within(treatment(1)).getByLabelText('施術日'), '2026-10-01')
    await user.type(
      within(treatment(1)).getByRole('textbox', { name: 'サロン' }),
      '駅前サロン',
    )
    await user.click(screen.getByRole('button', { name: '施術を足す' }))
    await user.click(screen.getByRole('button', { name: '2 件目の施術を外す' }))
    await user.click(screen.getByRole('button', { name: 'カルテを作る' }))

    // Assert
    await heading('カルテ')
    expect(notifications()).toContain(`${KENJI.name} 様のカルテを作りました。`)
    expect(await storedChartOf(KENJI.email)).toEqual({
      previousTreatments: [
        {
          treatment: 'head_spa',
          date: '2026-10-01',
          salonName: '駅前サロン',
          notes: null,
        },
      ],
      medicalConditions: '肩こりがひどい',
      preferredProducts: ['Aveda', '無香料のオイル'],
      avoidProducts: [],
      notes: null,
    })
    expect(described()['持病や体調']).toBe('肩こりがひどい')
  })

  it.each<
    [
      string,
      (user: ReturnType<typeof userEvent.setup>) => Promise<void>,
      string,
      string,
    ]
  >([
    [
      'a treatment after today',
      async (user) => {
        await user.click(screen.getByRole('button', { name: '施術を足す' }))
        await user.selectOptions(
          within(treatment(1)).getByRole('combobox', { name: '施術' }),
          'カット',
        )
        await user.type(
          within(treatment(1)).getByLabelText('施術日'),
          '2999-12-31',
        )
      },
      '施術日',
      '施術日は、今日までにしてください。',
    ],
    [
      'a name of a product of more than 100 characters',
      async (user) => {
        await user.click(screen.getByRole('textbox', { name: '避ける商材' }))
        await user.paste('あ'.repeat(101))
      },
      '避ける商材',
      '商材の名前は、1 つ 100 文字までで入力してください。',
    ],
  ])(
    'should make no chart with %s, and say why at the control',
    async (_, fill, control, message) => {
      // Arrange
      const user = userEvent.setup()
      await openChartOf(KENJI.email, '/new')
      await theForm()
      await fill(user)

      // Act
      await user.click(screen.getByRole('button', { name: 'カルテを作る' }))

      // Assert
      const wrong = await screen.findByLabelText(control)
      await waitFor(() =>
        expect(wrong).toHaveAccessibleDescription(
          expect.stringContaining(message),
        ),
      )
      expect(wrong).toHaveFocus()
      expect(await storedChartOf(KENJI.email)).toBeUndefined()
    },
  )

  it('should send what was changed, and keep what another account wrote meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email, '/edit')
    await heading('カルテを直す')
    await theForm()
    await conditionsWrittenMeanwhile(YUKI.email, '腰痛があるので、休憩をはさむ')

    // Act
    await user.clear(screen.getByRole('textbox', { name: 'メモ' }))
    await user.type(screen.getByRole('textbox', { name: 'メモ' }), '指名なし')
    await user.click(screen.getByRole('button', { name: '1 件目の施術を外す' }))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await heading('カルテ')
    expect(notifications()).toContain(`${YUKI.name} 様のカルテを直しました。`)
    expect(await storedChartOf(YUKI.email)).toEqual({
      previousTreatments: [
        { treatment: 'perm', date: '2025-11-02', salonName: null, notes: null },
      ],
      medicalConditions: '腰痛があるので、休憩をはさむ',
      preferredProducts: ['Aveda', 'オーガニックシャンプー'],
      avoidProducts: ['強い香料の整髪料'],
      notes: '指名なし',
    })
    expect(described()['メモ']).toBe('指名なし')
  })

  it('should ask for nothing when the form is sent as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email, '/edit')
    await theForm()
    const before = await storedChartOf(YUKI.email)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await heading('カルテ')
    expect(notifications()).toContain('変更はありませんでした。')
    expect(await storedChartOf(YUKI.email)).toEqual(before)
  })

  it('should say that another account made the chart meanwhile, keep what was written, and lead to that chart', async () => {
    // Arrange
    const user = userEvent.setup()
    const { salonId, customerId } = await openChartOf(KENJI.email, '/new')
    await theForm()
    await user.type(
      screen.getByRole('textbox', { name: '持病や体調' }),
      '花粉症の季節は、目がかゆくなる',
    )
    await chartMadeMeanwhile(KENJI.email, '乾燥肌')

    // Act
    await user.click(screen.getByRole('button', { name: 'カルテを作る' }))

    // Assert
    expect(
      await screen.findByText(
        'その間に、ほかのアカウントがこのお客様のカルテを作っていました。書いた内容は、そのカルテを直して書き足してください。',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '持病や体調' })).toHaveValue(
      '花粉症の季節は、目がかゆくなる',
    )
    expect(
      screen.getByRole('link', { name: 'そのカルテを直す' }),
    ).toHaveAttribute('href', chartChangeHrefOf(salonId, customerId))
    expect((await storedChartOf(KENJI.email))?.medicalConditions).toBe('乾燥肌')
  })

  it.each<[string, string, '/new' | '/edit', string, string | undefined]>([
    ['made', KENJI.email, '/new', 'カルテを作る', undefined],
    [
      'changed',
      YUKI.email,
      '/edit',
      '変更を保存する',
      '頭皮が乾燥しやすく、季節の変わり目にかゆみが出る',
    ],
  ])(
    'should show the customer as not found when they left the ledger before their chart was %s, and write nothing',
    async (_, email, below, submit, stored) => {
      // Arrange
      const user = userEvent.setup()
      const { customerId } = await openChartOf(email, below)
      await theForm()
      await user.type(screen.getByRole('textbox', { name: '持病や体調' }), '。')
      await removedMeanwhile(customerId, MANAGER)

      // Act
      await user.click(screen.getByRole('button', { name: submit }))

      // Assert
      await heading('お客様が見つかりません')
      expect((await storedChartOf(email))?.medicalConditions).toBe(stored)
    },
  )

  it.each<[string, string, '/new' | '/edit', string, string, string]>([
    [
      'change the chart a customer has',
      YUKI.email,
      '/new',
      'このお客様には、カルテがあります。',
      'カルテを直す',
      '/edit',
    ],
    [
      'make the chart a customer does not have',
      KENJI.email,
      '/edit',
      'このお客様のカルテは、まだありません。',
      'カルテを作る',
      '/new',
    ],
  ])('should lead to %s', async (_, email, below, said, link, to) => {
    // Act
    const { salonId, customerId } = await openChartOf(email, below)

    // Assert
    expect(await screen.findByText(said)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: link })).toHaveAttribute(
      'href',
      `${chartHrefOf(salonId, customerId)}${to}`,
    )
  })

  it('should find the charts by the allergies recorded and by a keyword, for a member of the staff', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(chartSearchHrefOf(await salonIdOf(TOKYO)))
    await signInAs(STYLIST)
    await heading('カルテを探す')
    await screen.findByRole('table', { name: 'カルテ' })
    expect(customersListed('カルテ')).toEqual([
      `${SAKURA.name} 様`,
      `${YUKI.name} 様`,
    ])
    expect(screen.getByText('2 件')).toBeInTheDocument()
    const allergies = screen.getByRole('combobox', { name: 'アレルギーの記録' })

    // Act
    await user.selectOptions(allergies, 'ある')
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await waitFor(() =>
      expect(customersListed('条件に合うカルテ')).toEqual([`${YUKI.name} 様`]),
    )

    // Act
    await user.selectOptions(allergies, 'ない')
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await waitFor(() =>
      expect(customersListed('条件に合うカルテ')).toEqual([
        `${SAKURA.name} 様`,
      ]),
    )

    // Act
    await user.selectOptions(allergies, 'すべて')
    await user.type(
      screen.getByRole('searchbox', { name: 'キーワード' }),
      'aveda',
    )
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await waitFor(() =>
      expect(customersListed('条件に合うカルテ')).toEqual([`${YUKI.name} 様`]),
    )

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'キーワード' }), 'X')
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(
      await screen.findByText('条件に合うカルテはありません'),
    ).toBeInTheDocument()
  })

  it('should read the charts that come next', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeCrowd(25, 'カルテのある人')
    await chartsOfTagged('カルテのある人')
    renderAt(chartSearchHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: 'カルテ' })
    expect(
      screen.getByText('27 件（20 件を表示しています）'),
    ).toBeInTheDocument()

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText('27 件')).toBeInTheDocument()
    expect(
      within(screen.getByRole('table', { name: 'カルテ' })).getAllByRole(
        'rowheader',
      ),
    ).toHaveLength(27)
  })

  it('should lead from the customer and from the ledger to the charts', async () => {
    // Arrange
    const customerId = await customerIdOf(YUKI.email)
    const salonId = await salonIdOf(TOKYO)
    renderAt(customerHrefOf(salonId, customerId))
    await signInAs(OWNER)
    await heading('お客様の台帳')

    // Assert
    expect(
      await screen.findByRole('link', { name: 'カルテを見る' }),
    ).toHaveAttribute('href', chartHrefOf(salonId, customerId))
    await userEvent.setup().click(screen.getByRole('link', { name: '顧客' }))
    await heading('顧客台帳')
    expect(screen.getByRole('link', { name: 'カルテを探す' })).toHaveAttribute(
      'href',
      chartSearchHrefOf(salonId),
    )
  })

  it.each<
    [
      string,
      (salonId: string, customerId: string) => string,
      string,
      'region' | 'group',
      string,
    ]
  >([
    ['the chart', chartHrefOf, YUKI.email, 'region', '過去の施術'],
    [
      'the form of the chart',
      chartChangeHrefOf,
      YUKI.email,
      'group',
      '施術の前に確かめること',
    ],
    [
      'the form of a new chart',
      chartEntryHrefOf,
      KENJI.email,
      'group',
      '施術の前に確かめること',
    ],
  ])('should be accessible on %s', async (_, hrefOf, email, role, shown) => {
    // Arrange
    const customerId = await customerIdOf(email)
    renderAt(hrefOf(await salonIdOf(TOKYO), customerId))
    await signInAs(OWNER)
    await screen.findByRole(role, { name: shown })

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })

  it('should be accessible on the search of the charts', async () => {
    // Arrange
    renderAt(chartSearchHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: 'カルテ' })

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})
