import { applications } from '@beauty-salon-frontend/brand'
import { renderApplicationAt } from '@beauty-salon-frontend/testing/screens'
import { type RenderResult, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'

/*
 * What the screen tests of the dashboard share: the application at an
 * address, and how they read what its screens show. What the tests read of
 * any screen is in `@beauty-salon-frontend/testing/screens`.
 */

/** The title of the application in the tests */
export const TITLE = applications.dashboard.name

/** What the tests find on a screen, as a page in each language names it */
const NAMES = {
  ja: {
    menu: 'メインメニュー',
    from: '集計する期間（から）',
    to: '集計する期間（まで）',
    count: '集計する',
  },
  en: {
    menu: 'Main menu',
    from: 'Period to count (from)',
    to: 'Period to count (to)',
    count: 'Calculate',
  },
}

/** The language of the page a test reads: Japanese unless it says */
export type Language = keyof typeof NAMES

/** A link of the header */
export const menuLink = (
  name: string,
  language: Language = 'ja',
): HTMLElement =>
  within(
    screen.getByRole('navigation', { name: NAMES[language].menu }),
  ).getByRole('link', { name })

/** Changes the days a screen counts over, as the owner types them, and counts. */
export const countOver = async (
  from: string,
  to: string,
  language: Language = 'ja',
): Promise<void> => {
  const names = NAMES[language]
  const user = userEvent.setup()
  const first = screen.getByLabelText(names.from)
  const last = screen.getByLabelText(names.to)
  await user.clear(first)
  await user.type(first, from)
  await user.clear(last)
  await user.type(last, to)
  await user.click(screen.getByRole('button', { name: names.count }))
}

/** A day of the calendar (`2026-11-20`) with its weekday, as a page in English writes it: 「Fri, November 20, 2026」. */
export const dayInEnglish = (day: string): string =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))

/** The days a screen counts over, as a page in English writes them. */
export const periodInEnglish = (from: string, to: string): string =>
  `${dayInEnglish(from)} – ${dayInEnglish(to)}`

/** The application at an address. */
export const renderAt = (path: string): RenderResult =>
  renderApplicationAt(<App />, path)
