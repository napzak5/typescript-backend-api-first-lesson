import { applications } from '@beauty-salon-frontend/brand'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type RenderResult,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { App } from '../App'

/*
 * What the screen tests of the dashboard share: the application at an
 * address, and how they read what a screen shows.
 */

/** The title of the application in the tests */
export const TITLE = applications.dashboard.name

/** The path a screen was opened at, and what the page showed in the commit that opened it */
let opened: [string, string] = ['', '']

const FirstSight = () => {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    opened = [pathname, document.querySelector('main')?.textContent ?? '']
  }, [pathname])

  return null
}

/** The path the last screen was opened at, and what it showed at first sight. */
export const firstSight = (): [string, string] => opened

/** The application at an address, with a client of its own that tries a read once. */
export const renderAt = (path: string): RenderResult =>
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

export const heading = (name: string): Promise<HTMLElement> =>
  screen.findByRole('heading', { level: 1, name })

/** What a card says, term by term */
export const termsOf = async (card: string): Promise<[string, string][]> =>
  within(await screen.findByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** The rows of a table, cell by cell in the order they are shown */
export const rowsOf = (table: string): (string | null)[][] =>
  within(screen.getByRole('table', { name: table }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent),
    )

/** A link of the header */
export const menuLink = (name: string): HTMLElement =>
  within(screen.getByRole('navigation', { name: 'メインメニュー' })).getByRole(
    'link',
    { name },
  )

/** Changes the days a screen counts over, as the owner types them, and counts. */
export const countOver = async (from: string, to: string): Promise<void> => {
  const user = userEvent.setup()
  const first = screen.getByLabelText('集計する期間（から）')
  const last = screen.getByLabelText('集計する期間（まで）')
  await user.clear(first)
  await user.type(first, from)
  await user.clear(last)
  await user.type(last, to)
  await user.click(screen.getByRole('button', { name: '集計する' }))
}
