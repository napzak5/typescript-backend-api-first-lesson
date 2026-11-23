import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as timeSlotFieldsStories from './time-slot-fields.stories'

const stories = composeStories(timeSlotFieldsStories)

/** The rows as a form would send them: the name and the value of every time, in the order of the page. */
const times = (): [string | null, string][] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    (control) => [control.getAttribute('name'), control.value],
  )

const OVERLAPPING =
  'ほかの時間帯と重なっています。重ならない時刻にしてください。'

describe('TimeSlotFields', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open with a row for every time slot, each time named by the number of its row', async () => {
    // Act
    await stories.WithSlots.run()

    // Assert
    expect(times()).toEqual([
      ['preferredTimeSlots.0.startTime', '10:00'],
      ['preferredTimeSlots.0.endTime', '12:00'],
      ['preferredTimeSlots.1.startTime', '18:00'],
      ['preferredTimeSlots.1.endTime', '20:30'],
    ])
    expect(screen.getByLabelText('時間帯 2 の開始')).toHaveValue('18:00')
    expect(screen.getByLabelText('時間帯 2 の終了')).toHaveValue('20:30')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('should show no row and no list when there is no time slot, and the button that adds one', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(times()).toEqual([])
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['時間帯を追加する'])
  })

  it('should add an empty row below the others, and move the focus to the time it begins at', async () => {
    // Arrange
    await stories.WithSlots.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    )

    // Assert
    expect(times()).toEqual([
      ['preferredTimeSlots.0.startTime', '10:00'],
      ['preferredTimeSlots.0.endTime', '12:00'],
      ['preferredTimeSlots.1.startTime', '18:00'],
      ['preferredTimeSlots.1.endTime', '20:30'],
      ['preferredTimeSlots.2.startTime', ''],
      ['preferredTimeSlots.2.endTime', ''],
    ])
    expect(screen.getByLabelText('時間帯 3 の開始')).toHaveFocus()
  })

  it('should add the first row with the keyboard alone', async () => {
    // Arrange
    await stories.Empty.run()

    // Act
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('09:30')
    await userEvent.tab()
    await userEvent.keyboard('11:00')

    // Assert
    expect(times()).toEqual([
      ['preferredTimeSlots.0.startTime', '09:30'],
      ['preferredTimeSlots.0.endTime', '11:00'],
    ])
  })

  it('should take a row away with what was typed into it, keep what the others hold, and number them anew', async () => {
    // Arrange
    await stories.WithSlots.run()
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    )
    await userEvent.type(screen.getByLabelText('時間帯 3 の開始'), '21:00')
    await userEvent.type(screen.getByLabelText('時間帯 3 の終了'), '22:15')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 2 を削除する' }),
    )

    // Assert
    expect(times()).toEqual([
      ['preferredTimeSlots.0.startTime', '10:00'],
      ['preferredTimeSlots.0.endTime', '12:00'],
      ['preferredTimeSlots.1.startTime', '21:00'],
      ['preferredTimeSlots.1.endTime', '22:15'],
    ])
    expect(
      screen.queryByRole('button', { name: '時間帯 3 を削除する' }),
    ).not.toBeInTheDocument()
  })

  it('should take away one row alone of two that were added: each has a key of its own', async () => {
    // Arrange
    await stories.Empty.run()
    const add = screen.getByRole('button', { name: '時間帯を追加する' })
    await userEvent.click(add)
    await userEvent.type(screen.getByLabelText('時間帯 1 の開始'), '09:00')
    await userEvent.click(add)
    await userEvent.type(screen.getByLabelText('時間帯 2 の開始'), '13:00')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 1 を削除する' }),
    )

    // Assert
    expect(times()).toEqual([
      ['preferredTimeSlots.0.startTime', '13:00'],
      ['preferredTimeSlots.0.endTime', ''],
    ])
  })

  it('should move the focus to the button that adds a row when a row is taken away', async () => {
    // Arrange
    await stories.WithSlots.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 1 を削除する' }),
    )

    // Assert
    expect(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    ).toHaveFocus()
  })

  it('should open a row that is added after one was taken away empty, not with what the other held', async () => {
    // Arrange
    await stories.WithSlots.run()
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 2 を削除する' }),
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    )

    // Assert
    expect(times()).toEqual([
      ['preferredTimeSlots.0.startTime', '10:00'],
      ['preferredTimeSlots.0.endTime', '12:00'],
      ['preferredTimeSlots.1.startTime', ''],
      ['preferredTimeSlots.1.endTime', ''],
    ])
  })

  it('should say what is wrong with a time at its control', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(screen.getByLabelText('時間帯 1 の終了')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(
      screen.getByLabelText('時間帯 1 の終了'),
    ).toHaveAccessibleDescription('終了は、開始より後の時刻にしてください。')
    expect(
      screen.getByLabelText('時間帯 2 の開始'),
    ).toHaveAccessibleDescription(OVERLAPPING)
    expect(screen.getByLabelText('時間帯 1 の開始')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('should keep the errors of an attempt when a row is added', async () => {
    // Arrange
    await stories.WithErrors.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    )

    // Assert
    expect(
      screen.getByLabelText('時間帯 2 の開始'),
    ).toHaveAccessibleDescription(OVERLAPPING)
  })

  it('should say nothing of the rows any more once a row was taken away: the numbers of the errors are those of the rows before', async () => {
    // Arrange
    await stories.Attempted.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 1 を削除する' }),
    )

    // Assert
    expect(screen.getByLabelText('時間帯 1 の開始')).not.toHaveAttribute(
      'aria-invalid',
    )
    expect(screen.getByLabelText('時間帯 1 の終了')).not.toHaveAttribute(
      'aria-invalid',
    )
    expect(screen.queryByText(OVERLAPPING)).not.toBeInTheDocument()
  })

  it('should show the errors of the next attempt, also after a row was taken away', async () => {
    // Arrange
    await stories.Attempted.run()
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 3 を削除する' }),
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度送信する' }),
    )

    // Assert
    expect(screen.getByLabelText('時間帯 1 の終了')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(
      screen.getByLabelText('時間帯 2 の開始'),
    ).toHaveAccessibleDescription(OVERLAPPING)
  })
})

describe('TimeSlotFields on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the times of every row and its buttons in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithSlots.run()

    // Assert
    expect(screen.getByLabelText('Start of time 2')).toHaveValue('18:00')
    expect(screen.getByLabelText('End of time 2')).toHaveValue('20:30')
    expect(screen.getByRole('button', { name: 'Remove time 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add a time' })).toBeVisible()
  })

  it('should say in English what is wrong with a time', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(screen.getByLabelText('End of time 1')).toHaveAccessibleDescription(
      'Make the end later than the start.',
    )
    expect(
      screen.getByLabelText('Start of time 2'),
    ).toHaveAccessibleDescription(
      'This overlaps another time. Choose times that do not overlap.',
    )
  })
})
