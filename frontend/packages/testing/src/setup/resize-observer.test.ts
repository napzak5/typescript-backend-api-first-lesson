import { describe, expect, it, vi } from 'vitest'
import { installResizeObserver } from './resize-observer'

describe('installResizeObserver', () => {
  it('should give jsdom an observer that watches and stops without telling of a change', () => {
    // Arrange
    installResizeObserver()
    const told = vi.fn()
    const element = document.createElement('div')

    // Act
    const observer = new ResizeObserver(told)
    observer.observe(element)
    observer.unobserve(element)
    observer.disconnect()

    // Assert
    expect(told).not.toHaveBeenCalled()
  })
})
