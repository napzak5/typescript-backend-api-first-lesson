import { type RefObject, useLayoutEffect, useState } from 'react'

/**
 * Whether what an element holds is wider than the element, so that it
 * scrolls sideways: measured once it is laid out, and again whenever the
 * element or what it holds changes its size (the window turns, rows come).
 */
export const useScrollsSideways = (
  frame: RefObject<HTMLElement | null>,
): boolean => {
  const [scrolls, setScrolls] = useState(false)

  useLayoutEffect(() => {
    const element = frame.current
    if (element === null) {
      return
    }
    const measure = (): void => {
      setScrolls(element.scrollWidth > element.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of element.children) {
      observer.observe(child)
    }

    return () => observer.disconnect()
  }, [frame])

  return scrolls
}
