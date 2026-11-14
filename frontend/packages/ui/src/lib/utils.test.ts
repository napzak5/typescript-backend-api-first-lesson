import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('should join class names with a space', () => {
    // Act
    const result = cn('flex', 'items-center')

    // Assert
    expect(result).toBe('flex items-center')
  })

  it('should return an empty string without input', () => {
    // Act
    const result = cn()

    // Assert
    expect(result).toBe('')
  })

  it('should skip falsy values', () => {
    // Act
    const result = cn('flex', false, null, undefined, '', 'gap-2')

    // Assert
    expect(result).toBe('flex gap-2')
  })

  it('should include only the truthy keys of an object', () => {
    // Act
    const result = cn('flex', { hidden: false, 'font-bold': true })

    // Assert
    expect(result).toBe('flex font-bold')
  })

  it('should flatten nested arrays', () => {
    // Act
    const result = cn(['flex', ['items-center', ['gap-2']]])

    // Assert
    expect(result).toBe('flex items-center gap-2')
  })

  it('should let a later class win over a conflicting earlier one', () => {
    // Act
    const result = cn('p-2 text-sm', 'p-4')

    // Assert
    expect(result).toBe('text-sm p-4')
  })

  it('should keep classes that style different sides', () => {
    // Act
    const result = cn('px-2', 'py-4')

    // Assert
    expect(result).toBe('px-2 py-4')
  })

  it('should resolve conflicts separately for each variant', () => {
    // Act
    const result = cn('bg-primary hover:bg-primary/90', 'hover:bg-accent')

    // Assert
    expect(result).toBe('bg-primary hover:bg-accent')
  })
})
