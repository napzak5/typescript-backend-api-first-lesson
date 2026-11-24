import { useCallback, useState } from 'react'

/**
 * Whether what an element holds is wider than the element, so that it
 * scrolls sideways: measured once it is laid out, and again whenever the
 * element or what it holds changes its size (the window turns, rows come).
 * The second value is the ref of the element: React hands it the element
 * when it is drawn, and stops the measuring when it is taken away.
 */
export const useScrollsSideways = (): [
  boolean,
  (element: HTMLElement) => () => void,
] => {
  const [scrolls, setScrolls] = useState(false)

  const frame = useCallback((element: HTMLElement) => {
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
  }, [])

  return [scrolls, frame]
}
