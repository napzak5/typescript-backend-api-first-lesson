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

/** The application at an address. */
export const renderAt = (path: string): RenderResult =>
  renderApplicationAt(<App />, path)
