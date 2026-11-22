import { signInAs } from '@beauty-salon-frontend/testing/api'
import {
  type ApplicationAt,
  renderApplicationAt,
} from '@beauty-salon-frontend/testing/screens'
import type { RenderResult } from '@testing-library/react'
import { App } from '../App'

/*
 * The application in the tests of its screens. What the tests read of a
 * screen is in `@beauty-salon-frontend/testing/screens`.
 */

/** The application at an address. */
export const renderAt = (path: string, options?: ApplicationAt): RenderResult =>
  renderApplicationAt(<App />, path, options)

/** The application at an address, with an account of the seed data signed in on its screen. */
export const openAs = async (
  path: string,
  email: string,
): Promise<RenderResult> => {
  const rendered = renderAt(path)
  await signInAs(email)

  return rendered
}
