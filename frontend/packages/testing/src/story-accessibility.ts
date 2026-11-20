import { expect, it } from 'vitest'
import { findAccessibilityViolations } from './accessibility'

/**
 * How long the check of one story may take. axe walks every node of the
 * story: a form of fifty rows takes a third of a second alone, and many
 * times as long on a runner whose cores the tests of every package share,
 * longer than the five seconds Vitest gives a test.
 */
const STORY_CHECK_TIMEOUT_MS = 30_000

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
    STORY_CHECK_TIMEOUT_MS,
  )
}
