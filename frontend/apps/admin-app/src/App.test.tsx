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

describe('Admin App', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    { path: '/', heading: 'Dashboard' },
    { path: '/appointments', heading: 'Appointment Management' },
    { path: '/staff', heading: 'Staff Management' },
    { path: '/services', heading: 'Service Management' },
    { path: '/tailwind-test', heading: 'Tailwind CSS Test' },
  ])('should render the "$heading" page at $path', ({ path, heading }) => {
    // Act
    const markup = renderAt(path)

    // Assert
    expect(markup).toContain(`>${heading}</h1>`)
  })

  it('should render only the page that matches the current path', () => {
    // Act
    const markup = renderAt('/staff')

    // Assert
    expect(markup).not.toContain('>Appointment Management</h1>')
    expect(markup).not.toContain('>Service Management</h1>')
  })

  it.each([
    { label: 'Dashboard', href: '/' },
    { label: 'Appointments', href: '/appointments' },
    { label: 'Staff', href: '/staff' },
    { label: 'Services', href: '/services' },
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

  it('should show the application title from the environment in the header', () => {
    // Arrange
    vi.stubEnv('VITE_APP_TITLE', 'Beauty Salon Admin (QA)')

    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toContain('>Beauty Salon Admin (QA)</h1>')
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

  it('should list the weekly key figures on the dashboard', () => {
    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toContain('Total Appointments')
    expect(markup).toContain('Total Revenue')
    expect(markup).toContain('Active Customers')
    expect(markup).toContain('Staff Utilization')
  })
})
