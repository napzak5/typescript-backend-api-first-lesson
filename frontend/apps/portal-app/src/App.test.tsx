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

describe('Portal App', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    { path: '/', heading: 'Welcome to Beauty Salon Portal' },
    { path: '/services', heading: 'Our Services' },
    { path: '/appointments', heading: 'My Appointments' },
  ])('should render the "$heading" page at $path', ({ path, heading }) => {
    // Act
    const markup = renderAt(path)

    // Assert
    expect(markup).toContain(`>${heading}</h1>`)
  })

  it('should render only the page that matches the current path', () => {
    // Act
    const markup = renderAt('/services')

    // Assert
    expect(markup).not.toContain('>Welcome to Beauty Salon Portal</h1>')
    expect(markup).not.toContain('>My Appointments</h1>')
  })

  it.each([
    { label: 'Home', href: '/' },
    { label: 'Services', href: '/services' },
    { label: 'Appointments', href: '/appointments' },
  ])(
    'should link to $href from the "$label" navigation item',
    ({ label, href }) => {
      // Act
      const markup = renderAt('/')

      // Assert
      expect(markup).toMatch(
        new RegExp(`<a[^>]*href="${href}"[^>]*>${label}</a>`),
      )
    },
  )

  it('should offer booking on the home page', () => {
    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toContain('>Book Appointment</button>')
  })

  it.each([
    'Hair Styling',
    'Nail Care',
    'Facial Treatments',
    'Massage Therapy',
  ])('should list the %s service', (service) => {
    // Act
    const markup = renderAt('/services')

    // Assert
    expect(markup).toContain(`>${service}</div>`)
  })

  it('should show an empty state with a call to action when there are no appointments', () => {
    // Act
    const markup = renderAt('/appointments')

    // Assert
    expect(markup).toContain('No appointments scheduled.')
    expect(markup).toContain('>Schedule New Appointment</button>')
  })

  it('should show the application title from the environment in the header', () => {
    // Arrange
    vi.stubEnv('VITE_APP_TITLE', 'Beauty Salon Portal (QA)')

    // Act
    const markup = renderAt('/')

    // Assert
    expect(markup).toContain('>Beauty Salon Portal (QA)</h1>')
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
