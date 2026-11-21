import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { DayChoice, type DayChoiceProps } from './day-choice'
import * as dayChoiceStories from './day-choice.stories'

const stories = composeStories(dayChoiceStories)

const field = (): HTMLElement => screen.getByLabelText('日付')

/** The form on a screen whose address changes under it: the day before was opened. */
const UnderAnAddress = (props: DayChoiceProps) => {
  const [day, setDay] = useState(props.day)

  return (
    <>
      <DayChoice {...props} day={day} />
      <button type='button' onClick={() => setDay('2026-11-20')}>
        前の日へ
      </button>
    </>
  )
}

describe('DayChoice', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the day of the address, and say how the days are counted', async () => {
    // Act
    await stories.Chosen.run()

    // Assert
    expect(screen.getByRole('form', { name: '売上を見る日' })).toBeVisible()
    expect(field()).toHaveValue('2026-11-21')
    expect(field()).toHaveAttribute('min', '1900-01-01')
    expect(field()).toHaveAttribute('max', '2999-12-31')
    expect(field()).toHaveAccessibleDescription(
      '会計した日（サロンの日付）で数えます。',
    )
  })

  it('should hand over the day filled in, from the keyboard too', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Chosen.run({
      args: {
        ...stories.Chosen.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push([...values])
        }),
      },
    })
    await userEvent.clear(field())
    await userEvent.type(field(), '2026-11-19')

    // Act
    await userEvent.keyboard('{Enter}')

    // Assert
    expect(received).toEqual([[['date', '2026-11-19']]])
  })

  it('should say what is wrong at the field, and take the focus there', async () => {
    // Act
    await stories.Wrong.run()

    // Assert
    expect(field()).toHaveFocus()
    expect(field()).toHaveAccessibleDescription(
      '会計した日（サロンの日付）で数えます。 日付を入力してください。',
    )
  })

  it('should show the day of another address when the address changes under it', async () => {
    // Arrange
    const Moving = composeStory(
      {
        ...dayChoiceStories.Chosen,
        render: (args) => <UnderAnAddress {...args} />,
      },
      dayChoiceStories.default,
    )
    await Moving.run()
    await userEvent.clear(field())

    // Act
    await userEvent.click(screen.getByRole('button', { name: '前の日へ' }))

    // Assert
    expect(field()).toHaveValue('2026-11-20')
  })
})
