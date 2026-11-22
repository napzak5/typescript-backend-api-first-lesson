/**
 * jsdom has the `dialog` element and its `open` attribute, but not the
 * methods that open and close it. These give it the part a component relies
 * on: `showModal()` opens, `close()` closes and tells whoever listens.
 *
 * What a browser does for a modal dialog beyond that (the focus kept inside,
 * the rest of the page made inert, the Escape key, the focus given back) is
 * not imitated here: it is seen in a real browser.
 */
export const installDialogMethods = (): void => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement): void {
        this.setAttribute('open', '')
      },
    },
    close: {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement): void {
        if (!this.hasAttribute('open')) {
          return
        }
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      },
    },
  })
}
