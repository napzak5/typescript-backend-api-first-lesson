/**
 * jsdom lays nothing out, and has no `ResizeObserver`. One that is never
 * told of a change stands in for it, so that a component that watches its
 * size renders as it does before anything has been laid out: a test that
 * needs a size gives the element one (`vi.spyOn` on its `scrollWidth`).
 */
export const installResizeObserver = (): void => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      observe(): void {
        // Nothing is laid out, so no size changes
      }

      unobserve(): void {
        // Nothing is watched
      }

      disconnect(): void {
        // Nothing is watched
      }
    },
  })
}
