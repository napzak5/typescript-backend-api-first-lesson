import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as bookingLineFormStories from './booking-line-form.stories'

const stories = composeStories(bookingLineFormStories)

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

describe('BookingLineForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Empty, () =>
    screen.getByLabelText('開始の時刻'),
  )

  it('should offer the services and the members, the member of the booking at first, and name the day of the time', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(
      within(combobox('メニュー'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['選んでください', 'カット（60 分）', 'カラー（60 分）'])
    expect(
      within(combobox('担当'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['予約の担当と同じ', '田中 美咲', '佐藤 健', '決めない'])
    expect(combobox('担当')).toHaveValue('same')
    expect(screen.getByLabelText('開始の時刻')).toHaveAccessibleDescription(
      '来店日（2026年11月20日（金））の、サロンの時計の時刻です。',
    )
  })

  it('should hand over the line under the names the API gives its values', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Empty.run({
      args: {
        ...stories.Empty.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.selectOptions(combobox('メニュー'), 'カラー（60 分）')
    await userEvent.selectOptions(combobox('担当'), '決めない')
    fireEvent.change(screen.getByLabelText('開始の時刻'), {
      target: { value: '11:00' },
    })
    await userEvent.type(screen.getByLabelText('メモ'), '根元だけ')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '施術明細を追加する' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['serviceId', 'af7d2b5e-4c6a-4ebd-8b9f-8a5c1d4e6fa3'],
        ['staffId', 'none'],
        ['startTime', '11:00'],
        ['notes', '根元だけ'],
      ],
    ])
  })

  it('should tell its caller when a value changed', async () => {
    // Arrange
    const onValuesChange = vi.fn()
    await stories.Empty.run({ args: { ...stories.Empty.args, onValuesChange } })

    // Act
    await userEvent.selectOptions(combobox('担当'), '佐藤 健')

    // Assert
    expect(onValuesChange).toHaveBeenCalledTimes(1)
  })

  it('should say at each control what is wrong with it', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(combobox('メニュー')).toHaveAccessibleDescription(
      'メニューを選んでください。',
    )
    expect(screen.getByLabelText('開始の時刻')).toHaveAccessibleDescription(
      expect.stringContaining('開始の時刻を入力してください。'),
    )
  })

  it('should say why the API refused the line, and what overlaps it', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '担当の時間が、ほかの予約と重なっているため、施術明細を足せませんでした。',
    )
    expect(screen.getByText('BK-9QWE-3RTY 11:00〜12:00')).toBeVisible()
  })
})
