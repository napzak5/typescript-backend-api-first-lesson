import { expect, it } from 'vitest'
import { findAccessibilityViolations } from './accessibility'

/** What `composeStories` returns for one story, as far as this file needs it. */
type ComposedStory = {
  run: () => Promise<void>
}

/**
 * Declares one test per story: the story is rendered as Storybook renders it
 * (loaders, decorators, play function) and must then break no rule of
 * WCAG 2.2 AA. Call it inside the `describe` of the component:
 *
 *   const stories = composeStories(buttonStories)
 *
 *   describe('Button', () => {
 *     itShouldBeAccessibleInEveryStory(stories)
 *   })
 *
 * Every story of the catalogue is a state somebody will see, so every story
 * is checked; a state that needs a check gets a story.
 */
export const itShouldBeAccessibleInEveryStory = (
  stories: Record<string, ComposedStory>,
): void => {
  it.each(Object.keys(stories))(
    'should have no accessibility violations in the %s story',
    async (name) => {
      // Act
      await stories[name]?.run()
      const violations = await findAccessibilityViolations()

      // Assert
      expect(violations).toEqual([])
    },
  )
}
