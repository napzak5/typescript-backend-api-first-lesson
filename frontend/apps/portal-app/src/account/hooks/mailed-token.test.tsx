import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it } from 'vitest'
import { tokenIn, useMailedToken } from './mailed-token'

describe('tokenIn', () => {
  it('should read the token that the API puts behind the address of a mailed link', () => {
    expect(tokenIn('#token=Zm9vYmFy_-0123456789abcdefghijklmnopqrstuvw')).toBe(
      'Zm9vYmFy_-0123456789abcdefghijklmnopqrstuvw',
    )
  })

  it.each([
    ['no fragment', ''],
    ['an empty fragment', '#'],
    ['a fragment without a token', '#token='],
    ['another fragment', '#section'],
    ['a token under another name', '#code=abc'],
    ['a token with something behind it', '#token=abc&next=/'],
    ['a token of characters no token has', '#token=abc def'],
    ['a token longer than the API takes', `#token=${'a'.repeat(256)}`],
  ])('should find no token in %s', (_case, hash) => {
    expect(tokenIn(hash)).toBeNull()
  })

  it('should take a token as long as the API takes', () => {
    expect(tokenIn(`#token=${'a'.repeat(255)}`)).toHaveLength(255)
  })
})

/** Where the screen is told to go, as a link opened in the same tab takes it */
let go: (to: string) => void = () => undefined

/** The token the screen has, and the address it is at */
const Screen = () => {
  const token = useMailedToken()
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  go = (to) => void navigate(to)

  return (
    <>
      <p>{`token: ${token ?? 'none'}`}</p>
      <p>{`address: ${pathname}${hash}`}</p>
    </>
  )
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Screen />
    </MemoryRouter>,
  )

describe('useMailedToken', () => {
  it('should read the token of the link that opened the screen, and take it out of the address', async () => {
    // Act
    renderAt('/reset-password#token=first')

    // Assert
    expect(await screen.findByText('address: /reset-password')).toBeVisible()
    expect(screen.getByText('token: first')).toBeVisible()
  })

  it('should have no token on a page that was opened without one', () => {
    // Act
    renderAt('/reset-password')

    // Assert
    expect(screen.getByText('token: none')).toBeVisible()
  })

  it('should take the token of a link opened in the same tab while the screen is shown', async () => {
    // Arrange
    renderAt('/share#token=first')
    await screen.findByText('address: /share')

    // Act
    act(() => go('/share#token=second'))

    // Assert
    expect(await screen.findByText('token: second')).toBeVisible()
    expect(await screen.findByText('address: /share')).toBeVisible()
  })

  it('should keep the token when the fragment that follows holds none', async () => {
    // Arrange
    renderAt('/share#token=first')
    await screen.findByText('address: /share')

    // Act
    act(() => go('/share#section'))

    // Assert
    expect(await screen.findByText('address: /share')).toBeVisible()
    expect(screen.getByText('token: first')).toBeVisible()
  })
})
