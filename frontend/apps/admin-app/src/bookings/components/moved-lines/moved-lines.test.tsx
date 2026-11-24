import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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

  it('should say that the service and the member of a line are gone', async () => {
    // Act
    await stories.OfWhatIsGone.run()

    // Assert
    expect(linesSaid()).toEqual([
      '明細 1 削除されたメニュー11:00〜12:00 担当 一覧にないスタッフ',
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

describe('MovedLines on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say of each line its service, its hours and who does it, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Moved.run()

    // Assert
    expect(
      screen
        .getAllByRole('listitem')
        .filter((item) => item.parentElement?.tagName === 'OL')
        .map((item) => item.textContent),
    ).toEqual([
      'Line 1: カット11:00–12:00, staff: 佐藤 健',
      'Line 2: カラー12:00–13:00, staff: Unassigned',
    ])
  })
})
