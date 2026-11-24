import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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

describe('LineCheckNote on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it.each<[keyof typeof stories, string]>([
    ['Free', 'Free'],
    [
      'FreeBeside',
      'Free (bookings overlap, within the number taken at once)BK-4F7H-2KQM 10:00–11:00',
    ],
    ['Taken', 'Overlapping bookingsBK-4F7H-2KQM 10:30–11:30'],
    ['Unassigned', 'A line without a staff member takes nobody’s time.'],
    ['Unchecked', 'Could not check'],
  ])('should say in %s, in English: %s', async (story, said) => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories[story].run()

    // Assert
    expect(document.body).toHaveTextContent(said)
  })
})
