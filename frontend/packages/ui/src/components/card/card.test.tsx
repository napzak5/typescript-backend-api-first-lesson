import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as cardStories from './card.stories'

const stories = composeStories(cardStories)

describe('Card', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a region named by its title that holds its content', async () => {
    // Act
    await stories.Default.run()
    const card = screen.getByRole('region', { name: '基本情報' })

    // Assert
    expect(within(card).getByText('山田 花子（ヤマダ ハナコ）')).toBeVisible()
  })

  it('should show its title as a heading of level 2 unless a level is given', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getByRole('heading', { level: 2, name: '基本情報' }),
    ).toBeVisible()
  })

  it('should show its title as a heading of level 3 when asked', async () => {
    // Act
    await stories.HeadingOfLevelThree.run()

    // Assert
    expect(
      screen.getByRole('heading', { level: 3, name: '来店の履歴' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: '来店の履歴' })).toBeVisible()
  })

  it('should show its actions beside its title', async () => {
    // Act
    await stories.WithActions.run()

    // Assert
    expect(
      within(screen.getByRole('region', { name: '基本情報' })).getByRole(
        'button',
        { name: '編集' },
      ),
    ).toBeVisible()
  })

  it('should keep its heading out of the way of the Tab key unless something is to move the focus to it', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getByRole('heading', { name: '基本情報' }),
    ).not.toHaveAttribute('tabindex')
  })

  it.each([
    ['of level 2', stories.WithHeadingThatTakesTheFocus, 2],
    ['of level 3', stories.WithHeadingOfLevelThreeThatTakesTheFocus, 3],
  ])(
    'should let its heading %s take the focus from whoever holds its ref, and never from the Tab key',
    async (_case, story, level) => {
      // Arrange
      await story.run()

      // Act
      await userEvent.click(screen.getByRole('button', { name: '履歴を消す' }))

      // Assert
      const heading = screen.getByRole('heading', { level, name: '来店の履歴' })
      expect(heading).toHaveFocus()
      expect(heading).toHaveAttribute('tabindex', '-1')
    },
  )
})
