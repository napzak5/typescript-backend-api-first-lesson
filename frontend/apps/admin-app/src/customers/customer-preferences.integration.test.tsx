import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  KENJI,
  OWNER,
  refuse,
  SAKURA,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
  YUKI,
} from '../bookings/__tests__/arrangements'
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
} from './__tests__/arrangements'

/*
 * The customer of these tests is the first of the seed data, Tanaka Yuki,
 * who says in the portal what she wishes for (`arrangeWishes`): a member of
 * the staff of the salon in Osaka, and not one of Tokyo. The screen is
 * opened at the salon in Tokyo, whose five members of the staff it offers.
 */

const OSAKA = 'Hair & Spa Osaka'

/** How the form names a member of the staff: with their salon. */
const named = (displayName: string, salon = TOKYO): string =>
  `${displayName}（${salon}）`

/** The address the application is at, as the router knows it */
let address = ''

/** The address a screen was opened at, and what the page showed in the commit that opened it */
let firstSight: [string, string] = ['', '']

const Address = () => {
  const { pathname, search } = useLocation()
  address = `${pathname}${search}`
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
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

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

/** What the application says in its notifications. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((said) => said !== '')

/** What the part of the preferences on the page of a customer describes, term by term. */
const preferencesShown = (): Record<string, string> =>
  Object.fromEntries(
    within(screen.getByRole('region', { name: '好み設定' }))
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )

/** Opens the form of the preferences of a customer at the salon in Tokyo, signed in, and waits for it. */
const openForm = async (email = YUKI.email, account = STYLIST) => {
  const [tokyo, customer] = await Promise.all([
    salonIdOf(TOKYO),
    customerIdOf(email),
  ])
  renderAt(`/salons/${tokyo}/customers/${customer}/preferences`)
  await signInAs(account)
  await heading('好み設定を直す')
  await screen.findByRole('button', { name: '変更を保存する' })

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
    expect(address).toBe(`/salons/${tokyo}/customers/${yuki}/preferences`)
    expect(screen.getByText('Tanaka Yuki（タナカ ユキ） 様')).toBeVisible()
    expect(
      within(wished())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
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
    expect(address).toBe(`/salons/${tokyo}/customers/${customer}`)
    expect(firstSight[1]).not.toContain('静かに過ごしたい')
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
    expect(firstSight[0]).toBe(
      `/salons/${tokyo}/customers/${customer}/preferences`,
    )
    expect(firstSight[1]).not.toContain('特別な要望')
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
    expect(address).toBe(`/salons/${tokyo}/customers/${customer}`)
    expect(await storedPreferencesOf(YUKI.email)).toBeNull()
  })
})
