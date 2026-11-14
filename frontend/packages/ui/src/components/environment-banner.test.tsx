// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  EnvironmentBanner,
  type EnvironmentBannerProps,
} from './environment-banner'

const render = (element: ReactElement): Element | null => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(element)

  return container.firstElementChild
}

const classNamesOf = (element: Element | null | undefined): string[] =>
  Array.from(element?.classList ?? [])

describe('EnvironmentBanner', () => {
  it('should render nothing in production', () => {
    // Act
    const markup = renderToStaticMarkup(
      <EnvironmentBanner environment='production' />,
    )

    // Assert
    expect(markup).toBe('')
  })

  it.each<{
    environment: NonNullable<EnvironmentBannerProps['environment']>
    color: string
  }>([
    { environment: 'development', color: 'bg-blue-600' },
    { environment: 'staging', color: 'bg-orange-600' },
    { environment: 'test', color: 'bg-purple-600' },
    { environment: 'localhost', color: 'bg-green-600' },
  ])(
    'should label the $environment environment on a $color ribbon',
    ({ environment, color }) => {
      // Act
      const banner = render(<EnvironmentBanner environment={environment} />)
      const ribbon = banner?.firstElementChild

      // Assert
      expect(ribbon?.textContent).toBe(environment)
      expect(classNamesOf(ribbon)).toContain(color)
    },
  )

  it('should fall back to the development ribbon when no environment is given', () => {
    // Act
    const banner = render(<EnvironmentBanner />)
    const ribbon = banner?.firstElementChild

    // Assert
    expect(ribbon?.textContent).toBe('development')
    expect(classNamesOf(ribbon)).toContain('bg-blue-600')
  })

  it('should stay fixed above the page without capturing pointer events', () => {
    // Act
    const banner = render(<EnvironmentBanner environment='staging' />)

    // Assert
    expect(classNamesOf(banner)).toEqual(
      expect.arrayContaining([
        'fixed',
        'top-0',
        'left-0',
        'pointer-events-none',
      ]),
    )
  })

  it('should add a custom class to the wrapper', () => {
    // Act
    const banner = render(
      <EnvironmentBanner environment='staging' className='print:hidden' />,
    )

    // Assert
    expect(classNamesOf(banner)).toEqual(
      expect.arrayContaining(['print:hidden', 'fixed']),
    )
  })
})
