import { applications } from '@beauty-salon-frontend/brand'
import { act, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

/** The element `index.html` has for the application. */
const rootOfThePage = (): HTMLElement => {
  const root = document.createElement('div')
  root.id = 'root'

  return document.body.appendChild(root)
}

/*
 * The entry starts the application as the page loads it, and nothing ends
 * it: what it draws stays until the document of this file is gone.
 * `startApplication` itself is tested in `app-frame`.
 */
describe('the entry of the admin application', () => {
  it('should draw the admin application in the element of the page, at the sign-in for somebody who is not signed in', async () => {
    // Arrange
    const root = rootOfThePage()

    // Act
    await act(async () => {
      await import('./main')
    })

    // Assert
    expect(
      within(root).getByRole('heading', { level: 1, name: 'サインイン' }),
    ).toBeVisible()
    expect(
      within(root).getByRole('link', { name: applications.admin.name }),
    ).toHaveAttribute('href', '/')
  })
})
