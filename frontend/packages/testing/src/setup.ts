/**
 * What every test of a component starts with: the matchers for DOM elements
 * (`toBeVisible`, `toHaveAccessibleName` and the others of jest-dom), the
 * methods of the `dialog` element and the `ResizeObserver` that jsdom lacks,
 * the width of the window (`setWindowWidth()`, back to that of a desktop
 * after every test), and the saving of a file a page made (`savedFiles()`).
 *
 * Name it in `setupFiles`, before the setup of the package itself.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { installDialogMethods } from './dialog'
import { installResizeObserver } from './resize-observer'
import { installFileSaving } from './saved-files'
import { installWindowWidth, resetWindowWidth } from './window-width'

installDialogMethods()
installResizeObserver()
installFileSaving()
installWindowWidth()

afterEach(resetWindowWidth)
