import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as lineCheckNoteStories from './line-check-note.stories'

const stories = composeStories(lineCheckNoteStories)

describe('LineCheckNote', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each<[keyof typeof stories, string]>([
    ['Free', '空いています'],
    [
      'FreeBeside',
      '空いています（同時に受けられる数の内で、重なる予約があります）BK-4F7H-2KQM 10:00〜11:00',
    ],
    ['Taken', '重なる予約がありますBK-4F7H-2KQM 10:30〜11:30'],
    ['Unassigned', '担当を決めない明細は、誰の時間も占有しません。'],
    ['Unchecked', '空きを確かめられませんでした'],
  ])('should say in %s: %s', async (story, said) => {
    // Act
    await stories[story].run()

    // Assert
    expect(document.body).toHaveTextContent(said)
  })

  it('should list the overlapping bookings by number and hours, without links', async () => {
    // Act
    await stories.Taken.run()

    // Assert
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['BK-4F7H-2KQM 10:30〜11:30'])
    expect(screen.queryByRole('link')).toBeNull()
  })
})
