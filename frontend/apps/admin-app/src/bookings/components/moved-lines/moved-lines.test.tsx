import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as movedLinesStories from './moved-lines.stories'

const stories = composeStories(movedLinesStories)

/** What each line says, in its order. */
const linesSaid = (): string[] =>
  screen
    .getAllByRole('listitem')
    .filter((item) => item.parentElement?.tagName === 'OL')
    .map((item) => item.textContent ?? '')

describe('MovedLines', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say of each line, in its order, its service, its hours on the clock of the salon and who does it', async () => {
    // Act
    await stories.Moved.run()

    // Assert
    expect(linesSaid()).toEqual([
      '明細 1 カット11:00〜12:00 担当 佐藤 健',
      '明細 2 カラー12:00〜13:00 担当 未定',
    ])
  })

  it('should say under each line what was found out about its member', async () => {
    // Act
    await stories.Taken.run()

    // Assert
    const [first, second] = screen
      .getAllByRole('listitem')
      .filter((item) => item.parentElement?.tagName === 'OL')
    expect(
      within(first ?? document.body).getByText('重なる予約があります'),
    ).toBeVisible()
    expect(
      within(first ?? document.body).getByText('BK-9QWE-3RTY 11:30〜12:30'),
    ).toBeVisible()
    expect(second).toHaveTextContent(
      '担当を決めない明細は、誰の時間も占有しません。',
    )
  })
})
