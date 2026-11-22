import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  Button,
  type EnvironmentBannerProps,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { isAtOrBelow } from './addresses'
import { AppFrame, type NavigationOf } from './app-frame'

type Environment = EnvironmentBannerProps['environment']

const TITLE = 'Kushi Frame'

/** The links of an application that offers two screens to a visitor, and none to who is signed in. */
const navigationFor: NavigationOf = (role, pathname) =>
  role === undefined
    ? [
        { href: '/', label: 'サロンを探す', current: pathname === '/' },
        {
          href: '/bookings',
          label: '予約の一覧',
          current: isAtOrBelow(pathname, '/bookings'),
        },
      ]
    : []

/** A screen that says what it did. */
const Saving = () => {
  const { notify } = useNotifications()

  return (
    <>
      <PageHeader title='サロンを探す' />
      <Button
        onClick={() => notify({ tone: 'success', message: '保存しました。' })}
      >
        保存する
      </Button>
    </>
  )
}

const renderAt = (path: string, environment: Environment = 'production') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppFrame
          title={TITLE}
          account={<p>アカウントの欄</p>}
          navigationFor={navigationFor}
          environment={environment}
        >
          <Routes>
            <Route path='/' element={<Saving />} />
            <Route
              path='/bookings/*'
              element={<PageHeader title='予約の一覧' />}
            />
          </Routes>
        </AppFrame>
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** The links of the header that lead to the screens, with the one that is marked as shown. */
const linksOfTheHeader = (): [string | null, string | null, string | null][] =>
  within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => [
      link.textContent,
      link.getAttribute('href'),
      link.getAttribute('aria-current'),
    ])

/** Nobody is signed in: what the frame shows without asking the API. */
describe('AppFrame', () => {
  it('should name the application in the header, with a link to its first screen, and show its account there', () => {
    // Act
    renderAt('/')

    // Assert
    const header = within(screen.getByRole('banner'))
    expect(header.getByRole('link', { name: TITLE })).toHaveAttribute(
      'href',
      '/',
    )
    expect(header.getByText('アカウントの欄')).toBeVisible()
  })

  it('should show the screen of the address, under the name of the application', () => {
    // Act
    renderAt('/')

    // Assert
    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: 'サロンを探す',
      }),
    ).toBeVisible()
    expect(document.title).toBe(`サロンを探す | ${TITLE}`)
  })

  it.each<[string, [string, string, string | null][]]>([
    [
      '/',
      [
        ['サロンを探す', '/', 'page'],
        ['予約の一覧', '/bookings', null],
      ],
    ],
    [
      '/bookings/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c02',
      [
        ['サロンを探す', '/', null],
        ['予約の一覧', '/bookings', 'page'],
      ],
    ],
  ])(
    'should give the header the links of the application for nobody at %s',
    (path, links) => {
      // Act
      renderAt(path)

      // Assert
      expect(linksOfTheHeader()).toEqual(links)
    },
  )

  it('should move within the application when a link of a shared component is pressed, and give the header the links of the address it leads to', async () => {
    // Arrange
    renderAt('/')

    // Act
    await userEvent.click(
      within(screen.getByRole('navigation')).getByRole('link', {
        name: '予約の一覧',
      }),
    )

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: '予約の一覧' }),
    ).toHaveFocus()
    expect(linksOfTheHeader()).toEqual([
      ['サロンを探す', '/', null],
      ['予約の一覧', '/bookings', 'page'],
    ])
  })

  it('should show at the top of the content what a screen says it did', async () => {
    // Arrange
    renderAt('/')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(
      within(screen.getByRole('main')).getByRole('status'),
    ).toHaveTextContent('保存しました。')
  })

  it.each<Environment>(['staging', 'development', 'test', 'localhost'])(
    'should name the %s environment',
    (environment) => {
      // Act
      renderAt('/', environment)

      // Assert
      expect(screen.getByText(environment)).toBeVisible()
    },
  )

  it('should not name the environment in production', () => {
    // Act
    renderAt('/')

    // Assert
    expect(screen.queryByText('production')).not.toBeInTheDocument()
  })

  it('should have no accessibility violations', async () => {
    // Arrange
    renderAt('/', 'staging')

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([])
  })
})
