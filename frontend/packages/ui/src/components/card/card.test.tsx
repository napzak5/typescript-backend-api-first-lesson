import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
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

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-page' },
    })

    // Assert
    expect(screen.getByRole('region', { name: '基本情報' })).toHaveClass(
      'card',
      'in-page',
    )
  })
})
