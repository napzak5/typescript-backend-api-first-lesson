import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import { OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import { renderAt } from '../../__tests__/screens'

/*
 * What the screen tests of the sales share: how they open a page, wait for
 * a sale and read the parts of a page.
 */

/** Opens a page of the salon in Tokyo at its address, signed in, and answers the ID of the salon. */
export const openAt = async (
  path: (tokyo: string) => string,
  email = OWNER,
): Promise<string> => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(path(tokyo))
  await signInAs(email)

  return tokyo
}

/** The part of a page under a heading. */
export const part = (name: string): HTMLElement =>
  screen.getByRole('heading', { name }).closest('section') ?? document.body

/** What a part of a page describes, term by term. */
export const describedIn = (name: string): Record<string, string> =>
  Object.fromEntries(
    within(part(name))
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )

/** Waits for the page of a sale: its heading, then its parts, which are read after it. */
export const theSale = async (): Promise<void> => {
  await heading('売上の内容')
  await screen.findByRole('table', { name: '明細' })
}
