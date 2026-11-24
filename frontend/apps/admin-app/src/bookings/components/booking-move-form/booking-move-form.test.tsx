import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingMoveFormStories from './booking-move-form.stories'

const stories = composeStories(bookingMoveFormStories)

const STAFF_IDS = {
  misaki: '7c4a9e2b-1f3d-4b8a-9e6c-5d2f8a1b3c70',
  ken: '8d5b0f3c-2a4e-4c9b-8f7d-6e3a9b2c4d81',
}

const moved = (): HTMLElement =>
  screen.getByRole('region', { name: '動かしたあとの明細' })

describe('BookingMoveForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Opened, () =>
    screen.getByLabelText('来店日'),
  )

  it('should open with the member, the day and the time of the booking, and the lines where they are', async () => {
    // Act
    await stories.Opened.run()

    // Assert
    expect(screen.getByRole('combobox', { name: '担当スタッフ' })).toHaveValue(
      STAFF_IDS.misaki,
    )
    expect(screen.getByLabelText('来店日')).toHaveValue('2026-11-20')
    expect(screen.getByLabelText('開始の時刻')).toHaveValue('10:00')
    expect(
      within(moved())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '明細 1 カット10:00〜11:00 担当 田中 美咲',
      '明細 2 カラー11:00〜12:00 担当 未定',
    ])
    expect(
      screen.getByRole('button', { name: '日時と担当を変える' }),
    ).toBeEnabled()
  })

  it('should hand over the member, the day and the time when it is sent', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Opened.run({
      args: {
        ...stories.Opened.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '担当スタッフ' }),
      '佐藤 健',
    )
    fireEvent.change(screen.getByLabelText('開始の時刻'), {
      target: { value: '11:30' },
    })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '日時と担当を変える' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['staffId', STAFF_IDS.ken],
        ['date', '2026-11-20'],
        ['startTime', '11:30'],
      ],
    ])
  })

  it('should tell its caller of every change of a value, with the values', async () => {
    // Arrange
    const seen: string[] = []
    await stories.Opened.run({
      args: {
        ...stories.Opened.args,
        onValuesChange: vi.fn((values: FormData) => {
          seen.push(
            `${values.get('staffId')} ${values.get('date')} ${values.get('startTime')}`,
          )
        }),
      },
    })

    // Act
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '担当スタッフ' }),
      '佐藤 健',
    )
    fireEvent.change(screen.getByLabelText('来店日'), {
      target: { value: '2026-11-21' },
    })

    // Assert
    expect(seen).toEqual([
      `${STAFF_IDS.ken} 2026-11-20 10:00`,
      `${STAFF_IDS.ken} 2026-11-21 10:00`,
    ])
  })

  it('should say how the lines are shown while the values are no move', async () => {
    // Act
    await stories.Unmoved.run()

    // Assert
    expect(moved()).toHaveTextContent(
      '担当スタッフ、来店日、開始の時刻を入れると、動かしたあとの明細を出します。',
    )
    expect(within(moved()).queryByRole('list')).toBeNull()
  })

  it('should say at each control what is wrong with it', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('combobox', { name: '担当スタッフ' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('担当スタッフを選んでください。'),
    )
    expect(screen.getByLabelText('開始の時刻')).toHaveAccessibleDescription(
      expect.stringContaining('開始の時刻を入力してください。'),
    )
  })

  it('should say why the API refused the move, and under each line what was found out', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '担当の時間が、ほかの予約と重なっているため、日時と担当を変えられませんでした。',
    )
    expect(within(moved()).getByText('BK-9QWE-3RTY 09:30〜10:30')).toBeVisible()
  })
})

describe('BookingMoveForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its controls and show the lines after the move, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Opened.run()

    // Assert
    expect(
      screen.getByRole('combobox', { name: 'Staff member' }),
    ).toHaveAccessibleDescription(
      'The staff member of the booking. The lines of the current staff member of the booking go to the new one. Lines of other staff members, and lines without one, keep theirs.',
    )
    expect(screen.getByLabelText('Start time')).toHaveAccessibleDescription(
      'When the first line begins. Every line moves by the same time.',
    )
    expect(
      screen.getByRole('region', { name: 'The lines after the move' }),
    ).toHaveTextContent('Line 1: カット10:00–11:00, staff: 田中 美咲')
    expect(
      screen.getByRole('button', { name: 'Change the date, time and staff' }),
    ).toBeVisible()
  })

  it('should say what the API refused, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Refused.run()

    // Assert
    expect(
      screen.getByText(
        'The date, time and staff could not be changed: the time of a staff member overlaps another booking. Each line was checked, where it would be after the move, for the other bookings it overlaps.',
      ),
    ).toBeVisible()
  })
})
