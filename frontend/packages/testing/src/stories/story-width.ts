import { MINIMAL_VIEWPORTS } from 'storybook/viewport'
import * as z from 'zod'
import { setWindowWidth } from '../setup/window-width'

/** The viewport a story chooses: `globals: { viewport: { value: 'mobile1', isRotated: false } }` */
const viewportSchema = z.object({
  viewport: z.object({ value: z.string(), isRotated: z.boolean() }),
})

/** The viewports of the catalogue, in pixels */
const viewports = new Map(
  Object.entries(MINIMAL_VIEWPORTS).map(([name, { styles }]) => [
    name,
    {
      width: Number.parseInt(styles.width, 10),
      height: Number.parseInt(styles.height, 10),
    },
  ]),
)

/**
 * Draws a story that the catalogue shows at the width of a phone at that
 * width in a test too: a component that asks how wide the window is (the
 * header of `AppShell`) draws what the catalogue shows. Turned, the window
 * is as wide as the viewport is high. A story that chooses no viewport is
 * drawn as wide as every test starts.
 *
 * Give it to `setProjectAnnotations`, after the preview of the package.
 */
export const atTheWidthOfTheStory = {
  beforeEach: ({ globals }: { globals: unknown }): void => {
    const chosen = viewportSchema.safeParse(globals)
    const viewport = chosen.success
      ? viewports.get(chosen.data.viewport.value)
      : undefined
    if (chosen.success && viewport !== undefined) {
      setWindowWidth(
        chosen.data.viewport.isRotated ? viewport.height : viewport.width,
      )
    }
  },
}
