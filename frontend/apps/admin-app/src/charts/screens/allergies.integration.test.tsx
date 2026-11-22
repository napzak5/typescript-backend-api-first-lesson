import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  notifications,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  MANAGER,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import {
  customerIdOf,
  removedMeanwhile,
} from '../../customers/__tests__/arrangements'
import {
  allergyChangeHrefOf,
  allergyEntryHrefOf,
  chartHrefOf,
} from '../../navigation'
import {
  allergyIdOf,
  allergyRemovedMeanwhile,
  mildAllergiesOf,
  storedAllergiesOf,
  symptomsWrittenMeanwhile,
} from '../__tests__/arrangements'

/*
 * The allergies of the seed data: Tanaka Yuki has two, a severe one of
 * PPD recorded first and a mild one of strong fragrances; Yamamoto Kenji
 * has none, and no chart either. An owner writes them, unless a test says
 * otherwise; a manager did something meanwhile.
 */

const PPD = 'パラフェニレンジアミン（PPD）'

const FRAGRANCE = '強い香料'

/** The allergies of Tanaka Yuki as the seed data stores them */
const SEEDED = [
  {
    allergyType: 'chemical',
    allergenName: PPD,
    severityType: 'severe',
    symptoms: 'カラー剤で頭皮に赤みとかゆみが出た',
    notes: 'ジアミンを含まないカラー剤を使う',
    confirmedDate: '2025-06-10',
  },
  {
    allergyType: 'fragrance',
    allergenName: FRAGRANCE,
    severityType: 'mild',
    symptoms: null,
    notes: '無香料のスタイリング剤を使う',
    confirmedDate: null,
  },
]

const allergies = (): HTMLElement =>
  screen.getByRole('region', { name: 'アレルギー' })

/** Waits until the allergies are listed, and gives their table. */
const listed = (): Promise<HTMLElement> =>
  screen.findByRole('table', { name: 'アレルギーの一覧' })

/** The allergens of the table, in its order */
const allergensListed = (table: HTMLElement): (string | null)[] =>
  within(table)
    .getAllByRole('rowheader')
    .map((header) => header.textContent)

/** Opens the chart of a customer in the salon in Tokyo, or a screen below it, signed in. */
const openChartOf = async (
  email: string,
  below = '',
  account = OWNER,
): Promise<{ salonId: string; customerId: string }> => {
  const customerId = await customerIdOf(email)
  const salonId = await salonIdOf(TOKYO)
  renderAt(`${chartHrefOf(salonId, customerId)}${below}`)
  await signInAs(account)

  return { salonId, customerId }
}

/** Opens the change of an allergy of a customer, signed in. */
const openChangeOf = async (
  email: string,
  allergenName: string,
  account = OWNER,
): Promise<void> => {
  const customerId = await customerIdOf(email)
  const salonId = await salonIdOf(TOKYO)
  const allergyId = await allergyIdOf(email, allergenName)
  renderAt(allergyChangeHrefOf(salonId, customerId, allergyId))
  await signInAs(account)
}

/** Waits until the form of an allergy is shown. */
const theForm = (): Promise<HTMLElement> =>
  screen.findByRole('radiogroup', { name: '重篤度' })

describe('the allergies of the customers, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should show the allergies first on the chart, the heaviest first, with their severity in a word', async () => {
    // Act
    await openChartOf(YUKI.email)

    // Assert
    await heading('カルテ')
    expect(rowsOf(await listed())).toEqual([
      [
        PPD,
        '重い',
        '化学物質',
        'カラー剤で頭皮に赤みとかゆみが出た',
        'ジアミンを含まないカラー剤を使う',
        '2025年6月10日（火）',
        '直す削除',
      ],
      [
        FRAGRANCE,
        '軽い',
        '香料',
        '記録なし',
        '無香料のスタイリング剤を使う',
        '不明',
        '直す削除',
      ],
    ])
    expect(within(allergies()).getByText('2 件')).toBeVisible()
    const chart = await screen.findByRole('region', { name: 'カルテ' })
    expect(
      allergies().compareDocumentPosition(chart) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('should record an allergy of a customer who has no chart, with everything it holds', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(KENJI.email)
    expect(
      within(await listed()).getByText('アレルギーの記録はありません'),
    ).toBeVisible()
    await user.click(
      within(allergies()).getByRole('link', { name: 'アレルギーを記録する' }),
    )
    await heading('アレルギーを記録する')
    await theForm()

    // Act
    await user.type(
      screen.getByRole('textbox', { name: 'アレルゲン' }),
      ' ラテックス ',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '種類' }),
      'ラテックス',
    )
    await user.click(screen.getByRole('radio', { name: '命に関わる' }))
    await user.type(
      screen.getByRole('textbox', { name: '症状' }),
      'じんましんと息苦しさ',
    )
    await user.type(
      screen.getByRole('textbox', { name: '施術のときの注意' }),
      'ニトリルの手袋を使う',
    )
    await user.type(screen.getByLabelText('確かめた日'), '2026-04-01')
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    await heading('カルテ')
    expect(notifications()).toContain(
      `${KENJI.name} 様のアレルギー（ラテックス）を記録しました。`,
    )
    expect(await storedAllergiesOf(KENJI.email)).toEqual([
      {
        allergyType: 'latex',
        allergenName: 'ラテックス',
        severityType: 'life_threatening',
        symptoms: 'じんましんと息苦しさ',
        notes: 'ニトリルの手袋を使う',
        confirmedDate: '2026-04-01',
      },
    ])
    await waitFor(() =>
      expect(allergensListed(allergies())).toEqual(['ラテックス']),
    )
    expect(
      within(screen.getByRole('region', { name: 'カルテ' })).getByRole('link', {
        name: 'カルテを作る',
      }),
    ).toBeVisible()
  })

  it('should record an allergy with only what is required, and nothing for the rest', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(KENJI.email, '/allergies/new')
    await theForm()

    // Act
    await user.type(
      screen.getByRole('textbox', { name: 'アレルゲン' }),
      'ニッケル',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '種類' }),
      '金属',
    )
    await user.click(screen.getByRole('radio', { name: '中程度' }))
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    await heading('カルテ')
    expect(await storedAllergiesOf(KENJI.email)).toEqual([
      {
        allergyType: 'metal',
        allergenName: 'ニッケル',
        severityType: 'moderate',
        symptoms: null,
        notes: null,
        confirmedDate: null,
      },
    ])
  })

  it('should say at the allergen that the customer has one of it already, and keep what was written', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email, '/allergies/new')
    await theForm()
    await user.type(screen.getByRole('textbox', { name: 'アレルゲン' }), PPD)
    await user.selectOptions(
      screen.getByRole('combobox', { name: '種類' }),
      '化学物質',
    )
    await user.click(screen.getByRole('radio', { name: '軽い' }))

    // Act
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    const allergen = screen.getByRole('textbox', { name: 'アレルゲン' })
    await waitFor(() =>
      expect(allergen).toHaveAccessibleDescription(
        expect.stringContaining(
          'このお客様には、同じアレルゲンの記録があります。',
        ),
      ),
    )
    expect(allergen).toHaveFocus()
    expect(allergen).toHaveValue(PPD)
    expect(await storedAllergiesOf(YUKI.email)).toEqual(SEEDED)
  })

  it.each<[string, string, string, string]>([
    [
      'a day after today',
      '確かめた日',
      '2999-12-31',
      '確かめた日は、今日までにしてください。',
    ],
    [
      'an allergen of more than 255 characters',
      'アレルゲン',
      'あ'.repeat(256),
      'アレルゲンは、255 文字以内で入力してください。',
    ],
  ])(
    'should record nothing with %s, and say why at the control',
    async (_, control, value, message) => {
      // Arrange
      const user = userEvent.setup()
      await openChartOf(KENJI.email, '/allergies/new')
      await theForm()
      await user.type(
        screen.getByRole('textbox', { name: 'アレルゲン' }),
        'ニッケル',
      )
      await user.selectOptions(
        screen.getByRole('combobox', { name: '種類' }),
        '金属',
      )
      await user.click(screen.getByRole('radio', { name: '軽い' }))
      await user.clear(screen.getByLabelText(control))
      await user.click(screen.getByLabelText(control))
      await user.paste(value)

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      const wrong = screen.getByLabelText(control)
      await waitFor(() =>
        expect(wrong).toHaveAccessibleDescription(
          expect.stringContaining(message),
        ),
      )
      expect(wrong).toHaveFocus()
      expect(await storedAllergiesOf(KENJI.email)).toEqual([])
    },
  )

  it('should send what was changed, and keep what another account wrote meanwhile', async () => {
    // Arrange: the change opened from the chart, which read the allergies
    const user = userEvent.setup()
    const { salonId, customerId } = await openChartOf(YUKI.email)
    await listed()
    await user.click(screen.getByRole('link', { name: `${PPD}の記録を直す` }))
    await heading('アレルギーの記録を直す')
    await theForm()
    await symptomsWrittenMeanwhile(YUKI.email, PPD, '頭皮が腫れた')

    // Act
    await user.click(screen.getByRole('radio', { name: '命に関わる' }))
    await user.clear(screen.getByLabelText('確かめた日'))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert: the severity before the change is not shown at first sight
    await heading('カルテ')
    expect(firstSight()).toEqual([
      chartHrefOf(salonId, customerId),
      expect.any(String),
    ])
    expect(firstSight()[1]).not.toContain('重い')
    expect(notifications()).toContain(
      `${YUKI.name} 様のアレルギー（${PPD}）の記録を直しました。`,
    )
    expect(await storedAllergiesOf(YUKI.email)).toEqual([
      {
        ...SEEDED[0],
        severityType: 'life_threatening',
        symptoms: '頭皮が腫れた',
        confirmedDate: null,
      },
      SEEDED[1],
    ])
    await waitFor(() =>
      expect(rowsOf(allergies())[0]?.slice(0, 2)).toEqual([PPD, '命に関わる']),
    )
  })

  it('should ask for nothing when the form is sent as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChangeOf(YUKI.email, FRAGRANCE)
    await theForm()

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await heading('カルテ')
    expect(notifications()).toContain('変更された項目はありません。')
    expect(await storedAllergiesOf(YUKI.email)).toEqual(SEEDED)
  })

  it('should say at the allergen that another allergy of the customer has the new one', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChangeOf(YUKI.email, FRAGRANCE)
    await theForm()

    // Act
    await user.clear(screen.getByRole('textbox', { name: 'アレルゲン' }))
    await user.type(screen.getByRole('textbox', { name: 'アレルゲン' }), PPD)
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'アレルゲン' }),
      ).toHaveAccessibleDescription(
        expect.stringContaining(
          'このお客様には、同じアレルゲンの記録があります。',
        ),
      ),
    )
    expect(await storedAllergiesOf(YUKI.email)).toEqual(SEEDED)
  })

  it('should say that the allergy is not there when another account removed it before it was changed', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChangeOf(YUKI.email, FRAGRANCE)
    await theForm()
    await user.click(screen.getByRole('radio', { name: '重い' }))
    await allergyRemovedMeanwhile(YUKI.email, FRAGRANCE)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText(
        'このアレルギーの記録は、ありません。ほかのアカウントが削除したのかもしれません。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'カルテへ' })).toBeVisible()
    expect(await storedAllergiesOf(YUKI.email)).toEqual([SEEDED[0]])
  })

  it.each<[string, () => Promise<unknown>, string]>([
    ['recorded', () => openChartOf(YUKI.email, '/allergies/new'), '記録する'],
    ['changed', () => openChangeOf(YUKI.email, FRAGRANCE), '変更を保存する'],
  ])(
    'should show the customer as not found when they left the ledger before their allergy was %s',
    async (_, open, submit) => {
      // Arrange
      const user = userEvent.setup()
      const customerId = await customerIdOf(YUKI.email)
      await open()
      await theForm()
      await user.type(screen.getByRole('textbox', { name: 'アレルゲン' }), '。')
      await user.selectOptions(
        screen.getByRole('combobox', { name: '種類' }),
        'その他',
      )
      await user.click(screen.getByRole('radio', { name: '軽い' }))
      await removedMeanwhile(customerId, MANAGER)

      // Act
      await user.click(screen.getByRole('button', { name: submit }))

      // Assert
      await heading('お客様が見つかりません')
      expect(await storedAllergiesOf(YUKI.email)).toEqual(SEEDED)
    },
  )

  it('should say that an address names no allergy of the customer, and lead to the chart', async () => {
    // Arrange
    const customerId = await customerIdOf(KENJI.email)
    const salonId = await salonIdOf(TOKYO)
    const ofAnother = await allergyIdOf(YUKI.email, PPD)

    // Act
    renderAt(allergyChangeHrefOf(salonId, customerId, ofAnother))
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'このアレルギーの記録は、ありません。ほかのアカウントが削除したのかもしれません。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'カルテへ' })).toHaveAttribute(
      'href',
      chartHrefOf(salonId, customerId),
    )
  })

  it('should remove an allergy after the dialog, and give the focus to the heading of the part', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email)
    await listed()
    await user.click(
      within(allergies()).getByRole('button', {
        name: `${FRAGRANCE}の記録を削除する`,
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: `${FRAGRANCE}の記録を削除しますか？`,
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      within(allergies()).getByRole('heading', { name: 'アレルギー' }),
    ).toHaveFocus()
    expect(notifications()).toContain(
      `${YUKI.name} 様のアレルギー（${FRAGRANCE}）の記録を削除しました。`,
    )
    await waitFor(() => expect(allergensListed(allergies())).toEqual([PPD]))
    expect(await storedAllergiesOf(YUKI.email)).toEqual([SEEDED[0]])
  })

  it('should remove nothing when the dialog is closed with the button that changes nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email)
    await listed()
    const button = within(allergies()).getByRole('button', {
      name: `${PPD}の記録を削除する`,
    })
    await user.click(button)
    const dialog = await screen.findByRole('dialog', {
      name: `${PPD}の記録を削除しますか？`,
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    // The browser gives the focus back to the button: the browser test sees it
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(button).toBeVisible()
    expect(await storedAllergiesOf(YUKI.email)).toEqual(SEEDED)
  })

  it('should say under the heading that another account removed the allergy meanwhile, and read the list again', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email)
    await listed()
    await user.click(
      within(allergies()).getByRole('button', {
        name: `${PPD}の記録を削除する`,
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: `${PPD}の記録を削除しますか？`,
    })
    await allergyRemovedMeanwhile(YUKI.email, PPD)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      within(allergies()).getByText(
        'その間に、ほかのアカウントがこのアレルギーの記録を削除していました。',
      ),
    ).toBeVisible()
    expect(
      within(allergies()).getByRole('heading', { name: 'アレルギー' }),
    ).toHaveFocus()
    await waitFor(() =>
      expect(allergensListed(allergies())).toEqual([FRAGRANCE]),
    )
  })

  it('should let a member of the staff record and change an allergy, and tell them who removes one', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email, '', STYLIST)
    await listed()

    // Act
    await user.click(
      within(allergies()).getByRole('link', {
        name: `${FRAGRANCE}の記録を直す`,
      }),
    )
    await theForm()
    await user.click(screen.getByRole('radio', { name: '中程度' }))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await heading('カルテ')
    await waitFor(() =>
      expect(rowsOf(allergies())[1]?.slice(0, 2)).toEqual([
        FRAGRANCE,
        '中程度',
      ]),
    )
    expect(within(allergies()).queryByRole('button')).toBeNull()
    expect(
      within(allergies()).getByText(
        '間違えて記録したアレルギーの削除は、オーナーとマネージャーができます。',
      ),
    ).toBeVisible()
    expect(
      within(allergies()).getByRole('link', { name: 'アレルギーを記録する' }),
    ).toBeVisible()
  })

  it('should read the allergies that come next, and give the focus to the first of them', async () => {
    // Arrange
    const user = userEvent.setup()
    await mildAllergiesOf(KENJI.email, 23)
    await openChartOf(KENJI.email)
    await listed()
    expect(
      within(allergies()).getByText('23 件（20 件を表示しています）'),
    ).toBeVisible()

    // Act
    await user.click(
      within(allergies()).getByRole('button', { name: 'さらに表示' }),
    )

    // Assert
    await waitFor(() => expect(allergensListed(allergies())).toHaveLength(23))
    expect(allergensListed(allergies())).toEqual(
      Array.from(
        { length: 23 },
        (_, index) => `アレルゲン ${String(index + 1).padStart(2, '0')}`,
      ),
    )
    expect(
      within(allergies()).getByRole('link', {
        name: 'アレルゲン 21の記録を直す',
      }),
    ).toHaveFocus()
    expect(
      within(allergies()).queryByRole('button', { name: 'さらに表示' }),
    ).toBeNull()
  })

  it.each<
    [
      string,
      (salonId: string, customerId: string) => string,
      () => Promise<HTMLElement>,
    ]
  >([
    ['the chart with the allergies', chartHrefOf, listed],
    ['the screen that records an allergy', allergyEntryHrefOf, theForm],
  ])('should be accessible on %s', async (_, hrefOf, shown) => {
    // Arrange
    const customerId = await customerIdOf(YUKI.email)
    const salonId = await salonIdOf(TOKYO)

    // Act
    renderAt(hrefOf(salonId, customerId))
    await signInAs(OWNER)
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })

  it('should be accessible on the change of an allergy', async () => {
    // Arrange
    await openChangeOf(YUKI.email, PPD)

    // Act
    await theForm()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
