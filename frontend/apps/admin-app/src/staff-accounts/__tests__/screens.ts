import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { staffAccountHrefOf } from '../../navigation'
import { staffIdOf } from '../../staff/__tests__/arrangements'

/*
 * What the screen tests of the accounts of the staff open and wait for.
 */

/** Opens the account of a member of the salon in Tokyo, signed in as an account of the seed data. */
export const openAccountOf = async (
  staffCode: string,
  as = OWNER,
  language: 'ja' | 'en' = 'ja',
): Promise<void> => {
  renderAt(
    staffAccountHrefOf(await salonIdOf(TOKYO), await staffIdOf(staffCode)),
  )
  await signInAs(as, language)
}

/** Waits for the heading of a card. */
export const cardHeading = (name: string): Promise<HTMLElement> =>
  screen.findByRole('heading', { level: 2, name })

/**
 * Waits until the heading of a card has the focus. It takes the focus once
 * the part a write left is shown, which can be a moment after the heading
 * itself: what was read anew reaches the screen after the write is done.
 */
export const expectFocusOn = async (name: string): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 2, name })).toHaveFocus()
  })
}
