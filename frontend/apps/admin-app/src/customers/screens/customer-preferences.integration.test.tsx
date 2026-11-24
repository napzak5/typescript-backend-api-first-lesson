import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { refuse, salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  address,
  firstSight,
  heading,
  notifications,
  optionsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import type { Locale } from '@beauty-salon-shared/i18n'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import {
  arrangePreferences,
  arrangeWishes,
  customerIdOf,
  removeMeanwhile,
  requestMeanwhile,
  staffIdOf,
  staffRemovedMeanwhile,
  staffShownAt,
  storedPreferencesOf,
} from '../__tests__/arrangements'

/*
 * The customer of these tests is the first of the seed data, Tanaka Yuki,
 * who says in the portal what she wishes for (`arrangeWishes`): a member of
 * the staff of the salon in Osaka, and not one of Tokyo. The screen is
 * opened at the salon in Tokyo, whose five members of the staff it offers.
 */

/** How the form names a member of the staff: with their salon. */
const named = (displayName: string, salon = TOKYO): string =>
  `${displayName}（${salon}）`

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const box = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

const wished = (): HTMLElement =>
  screen.getByRole('combobox', { name: '指名したいスタッフ' })

const saveButton = (): HTMLElement =>
  screen.getByRole('button', { name: '変更を保存する' })

/** The members of the staff the form has checked as those to avoid. */
const avoided = (): (string | null)[] =>
  screen
    .queryAllByRole('checkbox', { checked: true })
    .map((checked) => checked.closest('label')?.textContent ?? null)

/** What the part of the preferences on the page of a customer describes, term by term, under the name of the page. */
const preferencesShown = (part = '好み設定'): Record<string, string> =>
  Object.fromEntries(
    within(screen.getByRole('region', { name: part }))
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )

/** The heading and the button of the form, as a page in each language names them */
const FORM = {
  ja: { title: '好み設定を直す', save: '変更を保存する' },
  en: { title: 'Edit the preferences', save: 'Save changes' },
}

/** Opens the form of the preferences of a customer at the salon in Tokyo, signed in, and waits for it. */
const openForm = async (
  email = YUKI.email,
  account = STYLIST,
  language: Locale = 'ja',
) => {
  const [tokyo, customer] = await Promise.all([
    salonIdOf(TOKYO),
    customerIdOf(email),
  ])
  await openAs(
    `/salons/${tokyo}/customers/${customer}/preferences`,
    account,
    language,
  )
  await heading(FORM[language].title)
  await screen.findByRole('button', { name: FORM[language].save })

  return { tokyo, customer }
}

describe('the preferences of a customer, changed by a salon against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead from the page of the customer to the form, opened with what is stored, offering the staff of the salon and the member of another salon she wishes for', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeWishes(YUKI.email)
    const [tokyo, yuki, takeshi] = await Promise.all([
      salonIdOf(TOKYO),
      customerIdOf(YUKI.email),
      staffIdOf('Takeshi Ito'),
    ])
    renderAt(`/salons/${tokyo}/customers/${yuki}`)
    await signInAs(STYLIST)
    await heading('お客様の台帳')

    // Act
    await user.click(
      await within(
        await screen.findByRole('region', { name: '好み設定' }),
      ).findByRole('link', { name: '好み設定を直す' }),
    )

    // Assert
    await heading('好み設定を直す')
    await screen.findByRole('button', { name: '変更を保存する' })
    expect(address()).toBe(`/salons/${tokyo}/customers/${yuki}/preferences`)
    expect(screen.getByText('Tanaka Yuki（タナカ ユキ） 様')).toBeVisible()
    expect(optionsOf(wished())).toEqual([
      '指名しない',
      ...(await staffShownAt(TOKYO)).map((name) => named(name)),
      named('Takeshi Ito', OSAKA),
    ])
    expect(await staffShownAt(TOKYO)).toHaveLength(5)
    expect(wished()).toHaveValue(takeshi)
    expect(avoided()).toEqual([named('Mika Suzuki')])
    expect(screen.getByLabelText('時間帯 1 の開始')).toHaveValue('10:00')
    expect(text('接客の好み')).toHaveValue('静かに過ごしたい')
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })

  it('should write what was changed, say so, and show it on the page of the customer', async () => {
    // Arrange: from the page, which read the preferences before
    const user = userEvent.setup()
    await arrangeWishes(YUKI.email)
    const { tokyo, customer } = await openForm()
    await user.click(screen.getByRole('link', { name: 'やめる' }))
    await user.click(
      await within(
        await screen.findByRole('region', { name: '好み設定' }),
      ).findByRole('link', { name: '好み設定を直す' }),
    )
    await screen.findByRole('button', { name: '変更を保存する' })
    await user.selectOptions(wished(), named('Hiroshi Tanaka'))
    await user.click(box(named('Mika Suzuki')))
    await user.click(box(named('Yui Watanabe')))
    await user.clear(text('接客の好み'))
    await user.type(text('接客の好み'), '話すのが好き')

    // Act
    await user.click(saveButton())

    // Assert: the part reads what was written, and never shows what it read before
    await heading('お客様の台帳')
    expect(address()).toBe(`/salons/${tokyo}/customers/${customer}`)
    expect(firstSight()[1]).not.toContain('静かに過ごしたい')
    expect(notifications()).toContain('好み設定を直しました。')
    await waitFor(() =>
      expect(preferencesShown()).toMatchObject({
        指名したいスタッフ: 'Hiroshi Tanaka',
        避けたいスタッフ: 'Yui Watanabe',
        希望する時間帯: '10:00〜12:00',
        接客の好み: '話すのが好き',
      }),
    )
    expect(await storedPreferencesOf(YUKI.email)).toMatchObject({
      preferredStaffId: await staffIdOf('Hiroshi Tanaka'),
      avoidStaffIds: [await staffIdOf('Yui Watanabe')],
      preferredTimeSlots: [{ startTime: '10:00', endTime: '12:00' }],
      communicationStyle: '話すのが好き',
    })
  })

  it('should write the first preferences of a customer who has said nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openForm(KENJI.email)
    expect(wished()).toHaveValue('')
    expect(avoided()).toEqual([])

    // Act
    await user.type(text('特別な要望'), 'シャンプーはぬるめで')
    await user.click(saveButton())

    // Assert
    await heading('お客様の台帳')
    expect(await storedPreferencesOf(KENJI.email)).toMatchObject({
      preferredStaffId: null,
      avoidStaffIds: [],
      specialRequests: 'シャンプーはぬるめで',
    })
  })

  it('should send what was changed and nothing else: what the customer wrote in the portal meanwhile stays', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeWishes(YUKI.email)
    await openForm()
    await requestMeanwhile(YUKI.email, 'タオルを首に')
    await user.clear(text('接客の好み'))

    // Act
    await user.click(saveButton())

    // Assert
    await heading('お客様の台帳')
    expect(await storedPreferencesOf(YUKI.email)).toMatchObject({
      preferredStaffId: await staffIdOf('Takeshi Ito'),
      communicationStyle: null,
      specialRequests: 'タオルを首に',
    })
  })

  it('should not offer a member of the staff the salon removed, and keep them stored when something else is changed', async () => {
    // Arrange: Sakura avoids Mika Suzuki and Takeshi Ito, who was removed
    const user = userEvent.setup()
    await arrangePreferences(SAKURA.email)
    await openForm(SAKURA.email)
    expect(avoided()).toEqual([named('Mika Suzuki')])
    expect(
      screen.queryByRole('checkbox', { name: named('Takeshi Ito', OSAKA) }),
    ).not.toBeInTheDocument()

    // Act
    await user.clear(text('接客の好み'))
    await user.click(saveButton())

    // Assert
    await heading('お客様の台帳')
    expect(await storedPreferencesOf(SAKURA.email)).toMatchObject({
      avoidStaffIds: [
        await staffIdOf('Mika Suzuki'),
        await staffIdOf('Takeshi Ito'),
      ],
      communicationStyle: null,
    })
  })

  it('should open with what is stored now, not with what the form read when it was open before', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeWishes(YUKI.email)
    const { tokyo, customer } = await openForm()
    await user.click(screen.getByRole('link', { name: 'やめる' }))
    const link = await within(
      await screen.findByRole('region', { name: '好み設定' }),
    ).findByRole('link', { name: '好み設定を直す' })
    await requestMeanwhile(YUKI.email, 'タオルを首に')

    // Act
    await user.click(link)

    // Assert: no control at first sight, then what was written meanwhile
    await heading('好み設定を直す')
    expect(firstSight()[0]).toBe(
      `/salons/${tokyo}/customers/${customer}/preferences`,
    )
    expect(firstSight()[1]).not.toContain('特別な要望')
    await screen.findByRole('button', { name: '変更を保存する' })
    expect(text('特別な要望')).toHaveValue('タオルを首に')
  })

  it('should ask for nothing when nothing was changed, and say so', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeWishes(YUKI.email)
    await openForm()
    const before = await storedPreferencesOf(YUKI.email)

    // Act
    await user.click(saveButton())

    // Assert
    await heading('お客様の台帳')
    expect(notifications()).toContain('変更された項目はありません。')
    expect(await storedPreferencesOf(YUKI.email)).toEqual(before)
  })

  it('should say at the member who is wished for that they can no longer be chosen, when the salon removed them while the form was open', async () => {
    // Arrange
    const user = userEvent.setup()
    await openForm()
    await staffRemovedMeanwhile('Yui Watanabe')
    await user.selectOptions(wished(), named('Yui Watanabe'))

    // Act
    await user.click(saveButton())

    // Assert
    expect(
      await screen.findByText(
        'このスタッフは、選べなくなりました。ほかのスタッフを選んでください。',
      ),
    ).toBeVisible()
    expect(wished()).toHaveFocus()
    expect(wished()).toHaveAttribute('aria-invalid', 'true')
    expect(await storedPreferencesOf(YUKI.email)).toBeNull()
  })

  it('should say that the customer is gone when they were removed while the form was open', async () => {
    // Arrange
    const user = userEvent.setup()
    await openForm(SAKURA.email, OWNER)
    await removeMeanwhile(SAKURA.email)
    await user.type(text('特別な要望'), 'シャンプーはぬるめで')

    // Act
    await user.click(saveButton())

    // Assert
    await heading('お客様が見つかりません')
    expect(screen.getByRole('link', { name: '顧客台帳へ' })).toBeVisible()
  })

  it('should say that nothing was written when the database fails, and keep what was typed', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeWishes(YUKI.email)
    await refuse('update', 'customer_preferences')
    await openForm()
    await user.clear(text('接客の好み'))
    await user.type(text('接客の好み'), '話すのが好き')

    // Act
    await user.click(saveButton())

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(text('接客の好み')).toHaveValue('話すのが好き')
    expect((await storedPreferencesOf(YUKI.email))?.communicationStyle).toBe(
      '静かに過ごしたい',
    )
  })

  it('should lead back to the page of the customer without sending what was typed', async () => {
    // Arrange
    const user = userEvent.setup()
    const { tokyo, customer } = await openForm()
    await user.type(text('特別な要望'), 'シャンプーはぬるめで')

    // Act
    await user.click(screen.getByRole('link', { name: 'やめる' }))

    // Assert
    await heading('お客様の台帳')
    expect(address()).toBe(`/salons/${tokyo}/customers/${customer}`)
    expect(await storedPreferencesOf(YUKI.email)).toBeNull()
  })
})

describe('the preferences of a customer, changed by a salon on a page in English, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should lead in English from the page of the customer to the form, write what was changed, and say so', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeWishes(YUKI.email)
    const [tokyo, yuki] = await Promise.all([
      salonIdOf(TOKYO),
      customerIdOf(YUKI.email),
    ])
    await openAs(`/salons/${tokyo}/customers/${yuki}`, STYLIST, 'en')
    await heading('Customer record')
    await user.click(
      await within(
        await screen.findByRole('region', { name: 'Preferences' }),
      ).findByRole('link', { name: 'Edit the preferences' }),
    )
    await heading('Edit the preferences')
    await screen.findByRole('button', { name: 'Save changes' })
    expect(screen.getByText('Tanaka Yuki (タナカ ユキ)')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/salons/${tokyo}/customers/${yuki}`,
    )
    expect(await findAccessibilityViolations(document.body)).toEqual([])

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Preferred staff' }),
      `Hiroshi Tanaka (${TOKYO})`,
    )
    await user.clear(text('How you like to be served'))
    await user.type(text('How you like to be served'), '話すのが好き')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // Assert
    await heading('Customer record')
    expect(notifications()).toContain('The preferences were changed.')
    await waitFor(() =>
      expect(preferencesShown('Preferences')).toMatchObject({
        'Preferred staff': 'Hiroshi Tanaka',
        'How you like to be served': '話すのが好き',
      }),
    )
  })

  it('should say in English that the customer is gone when they were removed while the form was open', async () => {
    // Arrange
    const user = userEvent.setup()
    await openForm(SAKURA.email, OWNER, 'en')
    await removeMeanwhile(SAKURA.email)
    await user.type(text('Special requests'), 'シャンプーはぬるめで')

    // Act
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // Assert
    await heading('Customer not found')
    expect(
      screen.getByRole('link', { name: 'Back to the customer ledger' }),
    ).toBeVisible()
  })
})
