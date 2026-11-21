import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as shareBarStories from './share-bar.stories'

const stories = composeStories(shareBarStories)

/** The bar drawn under an amount */
const barUnder = (amount: string): Element | null | undefined =>
  screen.getByText(amount).nextElementSibling?.firstElementChild

describe('ShareBar', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each<[string, () => Promise<void>, string, string]>([
    ['half', () => stories.Half.run(), '￥12,100', '50%'],
    ['the whole', () => stories.Whole.run(), '￥23,100', '100%'],
    ['nothing', () => stories.Nothing.run(), '￥0', '0%'],
  ])(
    'should draw %s of its length under the amount',
    async (_case, run, amount, length) => {
      // Act
      await run()

      // Assert
      expect(barUnder(amount)).toHaveStyle({ inlineSize: length })
    },
  )

  it('should hold no text but the amount', async () => {
    // Act
    await stories.Half.run()

    // Assert
    expect(screen.getByText('￥12,100').parentElement).toHaveTextContent(
      /^￥12,100$/,
    )
  })
})
