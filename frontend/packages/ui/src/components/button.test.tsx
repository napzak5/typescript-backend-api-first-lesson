// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button, type ButtonProps, buttonVariants } from './button'

const render = (element: ReactElement): Element | null => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(element)

  return container.firstElementChild
}

const classNamesOf = (element: Element | null): string[] =>
  Array.from(element?.classList ?? [])

describe('Button', () => {
  it('should render a button element with its children', () => {
    // Act
    const button = render(<Button>Book now</Button>)

    // Assert
    expect(button?.tagName).toBe('BUTTON')
    expect(button?.textContent).toBe('Book now')
  })

  it('should use the default variant and size when none is given', () => {
    // Act
    const button = render(<Button>Book now</Button>)

    // Assert
    expect(classNamesOf(button)).toEqual(
      expect.arrayContaining([
        'bg-primary',
        'text-primary-foreground',
        'h-10',
        'px-4',
      ]),
    )
  })

  it.each<{
    variant: NonNullable<ButtonProps['variant']>
    className: string
  }>([
    { variant: 'destructive', className: 'bg-destructive' },
    { variant: 'outline', className: 'border-input' },
    { variant: 'secondary', className: 'bg-secondary' },
    { variant: 'ghost', className: 'hover:bg-accent' },
    { variant: 'link', className: 'underline-offset-4' },
  ])(
    'should style the $variant variant with $className instead of the default background',
    ({ variant, className }) => {
      // Act
      const button = render(<Button variant={variant}>Book now</Button>)

      // Assert
      expect(classNamesOf(button)).toContain(className)
      expect(classNamesOf(button)).not.toContain('bg-primary')
    },
  )

  it.each<{ size: NonNullable<ButtonProps['size']>; className: string }>([
    { size: 'sm', className: 'h-9' },
    { size: 'lg', className: 'h-11' },
    { size: 'icon', className: 'w-10' },
  ])('should size the $size button with $className', ({ size, className }) => {
    // Act
    const button = render(<Button size={size}>Book now</Button>)

    // Assert
    expect(classNamesOf(button)).toContain(className)
  })

  it('should add a custom class next to the variant classes', () => {
    // Act
    const button = render(<Button className='w-full'>Book now</Button>)

    // Assert
    expect(classNamesOf(button)).toEqual(
      expect.arrayContaining(['w-full', 'bg-primary']),
    )
  })

  it('should let a custom class override a conflicting variant class', () => {
    // Act
    const button = render(<Button className='h-12'>Book now</Button>)

    // Assert
    expect(classNamesOf(button)).toContain('h-12')
    expect(classNamesOf(button)).not.toContain('h-10')
  })

  it('should pass native button attributes through', () => {
    // Act
    const button = render(
      <Button type='submit' disabled aria-label='Confirm booking'>
        Confirm
      </Button>,
    )

    // Assert
    expect(button?.getAttribute('type')).toBe('submit')
    expect(button?.hasAttribute('disabled')).toBe(true)
    expect(button?.getAttribute('aria-label')).toBe('Confirm booking')
  })

  it('should render its child element instead of a button when asChild is set', () => {
    // Act
    const link = render(
      <Button asChild variant='outline'>
        <a href='/salons'>Salons</a>
      </Button>,
    )

    // Assert
    expect(link?.tagName).toBe('A')
    expect(link?.getAttribute('href')).toBe('/salons')
    expect(link?.textContent).toBe('Salons')
    expect(classNamesOf(link)).toContain('border-input')
  })

  it('should merge the classes of the child when asChild is set', () => {
    // Act
    const link = render(
      <Button asChild>
        <a href='/salons' className='underline'>
          Salons
        </a>
      </Button>,
    )

    // Assert
    expect(classNamesOf(link)).toEqual(
      expect.arrayContaining(['underline', 'bg-primary']),
    )
  })
})

describe('buttonVariants', () => {
  it('should return the default variant and size classes without options', () => {
    // Act
    const result = buttonVariants().split(' ')

    // Assert
    expect(result).toEqual(expect.arrayContaining(['bg-primary', 'h-10']))
  })

  it('should return the classes of the requested variant and size', () => {
    // Act
    const result = buttonVariants({ variant: 'outline', size: 'sm' }).split(' ')

    // Assert
    expect(result).toEqual(expect.arrayContaining(['border-input', 'h-9']))
    expect(result).not.toContain('bg-primary')
  })
})
