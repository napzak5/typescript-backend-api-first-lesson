/**
 * What every test of a component starts with: the matchers for DOM elements
 * (`toBeVisible`, `toHaveAccessibleName` and the others of jest-dom), and the
 * methods of the `dialog` element that jsdom lacks.
 *
 * Name it in `setupFiles`, before the setup of the package itself.
 */
import '@testing-library/jest-dom/vitest'
import { installDialogMethods } from './dialog'

installDialogMethods()
