import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as lineRemovalStories from './line-removal.stories'

const stories = composeStories(lineRemovalStories)

const dialog = (): HTMLElement =>
  screen.getByRole('dialog', { name: '施術明細を外しますか？' })

describe('LineRemoval', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say how a line is changed, and offer to take it away', async () => {
    // Act
    await stories.Offered.run()

    // Assert
    expect(
      screen.getByText(
        '明細の担当や開始の時刻は、変えられません。新しい明細を足してから、この明細を外してください。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'この明細を外す' }),
    )

    // Assert
    expect(stories.Offered.args.onOpen).toHaveBeenCalledTimes(1)
  })

  it('should say what is taken away and that the booking is summed up again, and take it away when it is confirmed', async () => {
    // Act
    await stories.Confirming.run()

    // Assert
    expect(dialog()).toHaveAccessibleDescription(
      'カット（10:00〜11:00）を、予約から外します。予約の時刻と金額は、残る明細から算出し直します。外した明細は、元に戻せません。',
    )
    expect(
      within(dialog())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['戻る', '外す'])

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '外す' }),
    )

    // Assert
    expect(stories.Confirming.args.onRemove).toHaveBeenCalledTimes(1)
  })

  it('should show that the removal is on its way, and not send it a second time', async () => {
    // Act
    await stories.Removing.run()
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '外す' }),
    )

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '外す' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(stories.Removing.args.onRemove).not.toHaveBeenCalled()
  })

  it('should say in the dialog why the removal did not come through', async () => {
    // Act
    await stories.Unremoved.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '施術明細を外せませんでした。',
    )
  })

  it('should say why a line stays, and offer no removal', async () => {
    // Act
    await stories.Last.run()

    // Assert
    expect(
      screen.getByText(
        '予約に残る最後の明細は、外せません。行われない来店は、予約をキャンセルしてください。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('should open from its button and close from the button that changes nothing', async () => {
    // Arrange
    await stories.OpenedByButton.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'この明細を外す' }),
    )

    // Assert
    expect(dialog()).toBeVisible()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('LineRemoval on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should ask before the line is taken off, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unremoved.run()

    // Assert
    expect(
      screen.getByText(
        'The staff member and the start time of a line cannot be changed. Add a new line, then take this one off.',
      ),
    ).toBeVisible()
    const asking = screen.getByRole('dialog', { name: 'Take the line off?' })
    expect(asking).toHaveAccessibleDescription(
      'カット (10:00–11:00) will be taken off the booking. The time and the amounts of the booking are worked out again from the lines that stay. A line taken off cannot be put back.',
    )
    expect(
      within(asking).getByText(
        'The line could not be taken off. Check your connection and try again.',
      ),
    ).toBeVisible()
    expect(within(asking).getByRole('button', { name: 'Back' })).toBeVisible()
    expect(
      within(asking).getByRole('button', { name: 'Take off' }),
    ).toBeVisible()
  })

  it('should say why the last line stays, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Last.run()

    // Assert
    expect(
      screen.getByText(
        'The last line of a booking cannot be taken off. Cancel the booking of a visit that will not take place.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
