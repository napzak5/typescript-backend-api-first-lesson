import {
  refuse,
  salonIdOf,
  unreadable,
} from '@beauty-salon-frontend/testing/api'
import { heading, readAgain } from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OWNER,
  SAKURA,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import {
  arrangeCrowd,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import { chartSearchHrefOf } from '../../navigation'
import {
  allergyIdOf,
  chartIdOf,
  chartMadeMeanwhile,
  chartsOfTagged,
  everyChartRemoved,
  firstChartId,
  mildAllergiesOf,
  storedAllergiesOf,
  storedChartOf,
} from '../__tests__/arrangements'
import {
  ALLERGIES_UNREAD,
  allergiesListed,
  allergiesPart,
  allergyForm,
  CHARTS_UNREAD,
  chartForm,
  openAllergyChangeOf,
  openChartOf,
} from '../__tests__/screens'

/*
 * The charts and the allergies, when a read fails, when a write is
 * refused, and when the form or the conditions of the search are wrong.
 * The failures are arranged in the database; what goes well is in
 * `charts.integration.test.tsx` and `allergies.integration.test.tsx`.
 */

const PPD = 'パラフェニレンジアミン（PPD）'

const FRAGRANCE = '強い香料'

/** What Tanaka Yuki has to take care of, as the seed data stores it */
const CONDITIONS = '頭皮が乾燥しやすく、季節の変わり目にかゆみが出る'

/** The customers the search lists, by the headers of the rows */
const chartsListed = (): HTMLElement[] =>
  within(screen.getByRole('table', { name: 'カルテ' })).getAllByRole(
    'rowheader',
  )

/** Opens the search of the charts of the salon in Tokyo, and waits for its form. */
const openSearch = async (): Promise<void> => {
  await openAs(chartSearchHrefOf(await salonIdOf(TOKYO)), OWNER)
  await heading('カルテを探す')
}

describe('the charts and the allergies, when something fails, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the chart could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'medical_charts',
      'updatedAt',
      await chartIdOf(YUKI.email),
    )
    await openChartOf(YUKI.email)
    expect(await screen.findByText(CHARTS_UNREAD)).toBeVisible()
    await allergiesListed()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await screen.findByText(CONDITIONS)).toBeVisible()
  })

  it('should say that the allergies could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'customer_allergies',
      'updatedAt',
      await allergyIdOf(YUKI.email, PPD),
    )
    await openChartOf(YUKI.email)
    expect(await screen.findByText(ALLERGIES_UNREAD)).toBeVisible()
    expect(within(allergiesPart()).getByText(ALLERGIES_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user, { inside: within(allergiesPart()) })

    // Assert
    expect(within(await allergiesListed()).getByText(PPD)).toBeVisible()
  })

  it('should say that the allergies that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await mildAllergiesOf(KENJI.email, 23)
    const readable = await unreadable(
      'customer_allergies',
      'updatedAt',
      await allergyIdOf(KENJI.email, 'アレルゲン 23'),
    )
    await openChartOf(KENJI.email)
    await allergiesListed()
    await user.click(
      within(allergiesPart()).getByRole('button', { name: 'さらに表示' }),
    )
    expect(await within(allergiesPart()).findByText(REST_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user, { inside: within(allergiesPart()) })

    // Assert
    expect(
      await within(allergiesPart()).findByText('アレルゲン 23'),
    ).toBeVisible()
    expect(within(allergiesPart()).getByText('23 件')).toBeVisible()
  })

  it('should say in the dialog that the allergy could not be removed, and keep it', async () => {
    // Arrange
    const user = userEvent.setup()
    await refuse('delete', 'customer_allergies')
    await openChartOf(YUKI.email)
    await allergiesListed()
    await user.click(
      within(allergiesPart()).getByRole('button', {
        name: `${FRAGRANCE}の記録を削除する`,
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: `${FRAGRANCE}の記録を削除しますか？`,
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'アレルギーの記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(await storedAllergiesOf(YUKI.email)).toHaveLength(2)
  })

  it('should say that the allergy could not be read, and show its form when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'customer_allergies',
      'updatedAt',
      await allergyIdOf(YUKI.email, PPD),
    )
    await openAllergyChangeOf(YUKI.email, PPD)
    expect(await screen.findByText(ALLERGIES_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await allergyForm()
    expect(screen.getByRole('textbox', { name: 'アレルゲン' })).toHaveValue(PPD)
  })

  it('should change nothing when the day an allergy was confirmed is after today, and say why at the control', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAllergyChangeOf(YUKI.email, PPD)
    await allergyForm()
    const confirmed = screen.getByLabelText('確かめた日')
    await user.clear(confirmed)
    await user.click(confirmed)
    await user.paste('2999-12-31')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await waitFor(() =>
      expect(confirmed).toHaveAccessibleDescription(
        expect.stringContaining('確かめた日は、今日までにしてください。'),
      ),
    )
    expect(confirmed).toHaveFocus()
    expect((await storedAllergiesOf(YUKI.email))[0]?.confirmedDate).toBe(
      '2025-06-10',
    )
  })

  it('should say that the chart could not be made, and keep what was typed', async () => {
    // Arrange
    const user = userEvent.setup()
    await refuse('insert', 'medical_charts')
    await openChartOf(KENJI.email, '/new')
    await chartForm()
    await user.type(
      screen.getByRole('textbox', { name: '持病や体調' }),
      '腰痛がある',
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'カルテを作る' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'カルテを作れませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('textbox', { name: '持病や体調' })).toHaveValue(
      '腰痛がある',
    )
    expect(await storedChartOf(KENJI.email)).toBeUndefined()
  })

  it('should say that the account may not write charts when it no longer belongs to a salon, and change nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email, '/edit', STYLIST)
    await chartForm()
    await user.type(screen.getByRole('textbox', { name: '持病や体調' }), '。')
    await staffRemovedMeanwhile('Hiroshi Tanaka')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このアカウントでは、カルテを書けません。',
    )
    expect((await storedChartOf(YUKI.email))?.medicalConditions).toBe(
      CONDITIONS,
    )
  })

  it('should change nothing when the name of a product is too long, and say why at the control', async () => {
    // Arrange
    const user = userEvent.setup()
    await openChartOf(YUKI.email, '/edit')
    await chartForm()
    const preferred = screen.getByRole('textbox', { name: '好みの商材' })
    await user.clear(preferred)
    await user.click(preferred)
    await user.paste('あ'.repeat(101))

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await waitFor(() =>
      expect(preferred).toHaveAccessibleDescription(
        expect.stringContaining(
          '商材の名前は、1 つ 100 文字以内で入力してください。',
        ),
      ),
    )
    expect(preferred).toHaveFocus()
    expect((await storedChartOf(YUKI.email))?.preferredProducts).not.toContain(
      'あ'.repeat(101),
    )
  })

  it('should say that the charts could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'medical_charts',
      'updatedAt',
      await chartIdOf(YUKI.email),
    )
    await openSearch()
    expect(await screen.findByText(CHARTS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await screen.findByRole('table', { name: 'カルテ' })
    expect(chartsListed()).toHaveLength(2)
  })

  it('should say that the charts that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeCrowd(25, 'カルテのある人')
    await chartsOfTagged('カルテのある人')
    const readable = await unreadable(
      'medical_charts',
      'updatedAt',
      await firstChartId(),
    )
    await openSearch()
    await screen.findByRole('table', { name: 'カルテ' })
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(chartsListed()).toHaveLength(20)
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await screen.findByText('27 件')).toBeVisible()
    expect(chartsListed()).toHaveLength(27)
  })

  it('should search for nothing with a keyword of more than 100 characters, and say why at the control', async () => {
    // Arrange
    const user = userEvent.setup()
    await openSearch()
    await screen.findByRole('table', { name: 'カルテ' })
    const keyword = screen.getByRole('searchbox', { name: 'キーワード' })
    await user.click(keyword)
    await user.paste('あ'.repeat(101))

    // Act
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await waitFor(() =>
      expect(keyword).toHaveAccessibleDescription(
        expect.stringContaining(
          'キーワードは、100 文字以内で入力してください。',
        ),
      ),
    )
    expect(screen.getByRole('table', { name: 'カルテ' })).toBeVisible()
    expect(chartsListed()).toHaveLength(2)
  })

  it('should read the charts again when the same conditions are sent again', async () => {
    // Arrange
    const user = userEvent.setup()
    await openSearch()
    await screen.findByRole('table', { name: 'カルテ' })
    expect(chartsListed()).toHaveLength(2)
    await chartMadeMeanwhile(KENJI.email, '腰痛がある')

    // Act
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(await screen.findByText(`${KENJI.name} 様`)).toBeVisible()
    expect(chartsListed()).toHaveLength(3)
    expect(screen.getByText(`${SAKURA.name} 様`)).toBeVisible()
  })

  it('should say that no customer has a chart yet, and lead to the ledger', async () => {
    // Arrange
    await everyChartRemoved()

    // Act
    await openSearch()

    // Assert
    expect(await screen.findByText('カルテはありません')).toBeVisible()
    expect(
      screen.getByText('カルテは、お客様の台帳から作ります。'),
    ).toBeVisible()
    expect(screen.queryByRole('table', { name: 'カルテ' })).toBeNull()
  })
})
