// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'

const render = (element: ReactElement): Element | null => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(element)

  return container.firstElementChild
}

const classNamesOf = (element: Element | null): string[] =>
  Array.from(element?.classList ?? [])

describe('Card', () => {
  it('should render a bordered container with its children', () => {
    // Act
    const card = render(<Card>Cut and color</Card>)

    // Assert
    expect(card?.tagName).toBe('DIV')
    expect(card?.textContent).toBe('Cut and color')
    expect(classNamesOf(card)).toEqual(
      expect.arrayContaining(['rounded-lg', 'border', 'bg-card']),
    )
  })

  it('should pass HTML attributes through', () => {
    // Act
    const card = render(
      <Card id='salon-card' data-salon-id='s_1' aria-label='Salon'>
        Cut and color
      </Card>,
    )

    // Assert
    expect(card?.id).toBe('salon-card')
    expect(card?.getAttribute('data-salon-id')).toBe('s_1')
    expect(card?.getAttribute('aria-label')).toBe('Salon')
  })

  it('should let a custom class override a conflicting default class', () => {
    // Act
    const card = render(<Card className='rounded-none'>Cut and color</Card>)

    // Assert
    expect(classNamesOf(card)).toContain('rounded-none')
    expect(classNamesOf(card)).not.toContain('rounded-lg')
  })
})

describe('Card sections', () => {
  it.each([
    {
      name: 'CardHeader',
      element: <CardHeader>Section</CardHeader>,
      classNames: ['flex', 'flex-col', 'p-6'],
    },
    {
      name: 'CardTitle',
      element: <CardTitle>Section</CardTitle>,
      classNames: ['text-2xl', 'font-semibold'],
    },
    {
      name: 'CardDescription',
      element: <CardDescription>Section</CardDescription>,
      classNames: ['text-sm', 'text-muted-foreground'],
    },
    {
      name: 'CardContent',
      element: <CardContent>Section</CardContent>,
      classNames: ['p-6', 'pt-0'],
    },
    {
      name: 'CardFooter',
      element: <CardFooter>Section</CardFooter>,
      classNames: ['flex', 'items-center', 'p-6', 'pt-0'],
    },
  ])(
    'should render $name with its own layout classes',
    ({ element, classNames }) => {
      // Act
      const section = render(element)

      // Assert
      expect(section?.textContent).toBe('Section')
      expect(classNamesOf(section)).toEqual(expect.arrayContaining(classNames))
    },
  )

  it('should let a custom class replace the default title size', () => {
    // Act
    const title = render(
      <CardTitle className='text-lg'>Hair Styling</CardTitle>,
    )

    // Assert
    expect(classNamesOf(title)).toContain('text-lg')
    expect(classNamesOf(title)).not.toContain('text-2xl')
  })

  it('should keep the header padding when only one side is overridden', () => {
    // Act
    const header = render(<CardHeader className='pb-2'>Revenue</CardHeader>)

    // Assert
    expect(classNamesOf(header)).toEqual(
      expect.arrayContaining(['p-6', 'pb-2']),
    )
  })

  it('should nest the sections in the order they are composed', () => {
    // Act
    const card = render(
      <Card>
        <CardHeader>
          <CardTitle>Hair Styling</CardTitle>
          <CardDescription>Professional cuts</CardDescription>
        </CardHeader>
        <CardContent>60 min</CardContent>
        <CardFooter>¥5,500</CardFooter>
      </Card>,
    )

    // Assert
    expect(
      Array.from(card?.children ?? []).map((child) => child.textContent),
    ).toEqual(['Hair StylingProfessional cuts', '60 min', '¥5,500'])
  })
})
