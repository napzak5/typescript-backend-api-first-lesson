import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const renderAt = (path: string): string =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

const activeLinksOf = (markup: string): string[] =>
  markup.match(/<a[^>]*aria-current="page"[^>]*>.*?<\/a>/g) ?? []

describe('Dashboard App', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it.each([
    { path: '/', heading: 'Business Overview' },
    { path: '/analytics', heading: 'Analytics &amp; Insights' },
    { path: '/reports', heading: 'Reports' },
    { path: '/settings', heading: 'Dashboard Settings' },
  ])('should render the "$heading" page at $path', ({ path, heading }) => {
    // Act
    const markup = renderAt(path)

    // Assert
    expect(markup).toContain(`>${heading}</h1>`)
  })

  it.each([
    { path: '/', label: 'Overview' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/reports', label: 'Reports' },
    { path: '/settings', label: 'Settings' },
  ])(
    'should highlight only the "$label" navigation item at $path',
    ({ path, label }) => {
      // Act
      const activeLinks = activeLinksOf(renderAt(path))

      // Assert
      expect(activeLinks).toEqual([
        expect.stringContaining(`<span>${label}</span>`),
      ])
      expect(activeLinks).toEqual([expect.stringContaining('bg-primary')])
    },
  )

  it.each([
    { label: 'Overview', href: '/' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Reports', href: '/reports' },
    { label: 'Settings', href: '/settings' },
  ])(
    'should link to $href from the "$label" navigation item',
    ({ label, href }) => {
      // Act
      const markup = renderAt('/')

      // Assert
      expect(markup).toMatch(
        new RegExp(`<a[^>]*href="${href}"[^>]*><span>${label}</span></a>`),
      )
    },
  )

  it('should show the Sunday to Saturday week that contains today', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2024, 5, 12, 12))

    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toContain('Week of Jun 9 - Jun 15, 2024')
  })

  it('should show the year of the last day when the week spans two years', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2024, 11, 31, 12))

    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toContain('Week of Dec 29 - Jan 4, 2025')
  })

  it('should list every staff member in the performance table', () => {
    // Act
    const markup = renderAt('/analytics')

    // Assert
    expect(markup.match(/<td class="py-3 text-sm">[^<]+<\/td>/g)).toEqual([
      '<td class="py-3 text-sm">Sarah J.</td>',
      '<td class="py-3 text-sm">Mike C.</td>',
      '<td class="py-3 text-sm">Emma W.</td>',
      '<td class="py-3 text-sm">Lisa T.</td>',
      '<td class="py-3 text-sm">John D.</td>',
    ])
  })

  it('should offer a generate action for each of the six reports', () => {
    // Act
    const markup = renderAt('/reports')

    // Assert
    expect(markup.match(/>Generate Report<\/button>/g)).toHaveLength(6)
  })

  it('should show the application title from the environment in the header', () => {
    // Arrange
    vi.stubEnv('VITE_APP_TITLE', 'Beauty Salon Dashboard (QA)')

    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toContain('>Beauty Salon Dashboard (QA)</h1>')
  })

  it('should show the environment banner outside production', () => {
    // Arrange
    vi.stubEnv('VITE_MODE', 'staging')

    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toMatch(
      /<div class="[^"]*bg-orange-600[^"]*">staging<\/div>/,
    )
    expect(markup).toContain('Environment: staging')
  })

  it('should hide the environment banner in production', () => {
    // Arrange
    vi.stubEnv('VITE_MODE', 'production')

    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).not.toContain('>production</div>')
    expect(markup).toContain('Environment: production')
  })
})
