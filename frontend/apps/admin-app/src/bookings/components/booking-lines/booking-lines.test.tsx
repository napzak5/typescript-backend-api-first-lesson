import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as bookingLinesStories from './booking-lines.stories'

const stories = composeStories(bookingLinesStories)

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const addButton = (): HTMLElement =>
  screen.getByRole('button', { name: '明細を追加する' })

describe('BookingLines', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open with one line, its controls named by its number, the member of the booking at first, and no way to take it away', async () => {
    // Act
    await stories.OneLine.run()

    // Assert
    expect(optionsOf(combobox('明細 1 のメニュー'))).toEqual([
      '選んでください',
      'カット（60 分）',
      'カラー（60 分）',
      '縮毛矯正（180 分）（受付停止中）',
    ])
    expect(optionsOf(combobox('明細 1 の担当'))).toEqual([
      '予約の担当と同じ',
      '田中 美咲',
      '佐藤 健',
      '決めない',
    ])
    expect(combobox('明細 1 の担当')).toHaveValue('same')
    expect(combobox('明細 1 のメニュー')).toHaveAttribute(
      'name',
      'services.0.serviceId',
    )
    expect(screen.getByLabelText('明細 1 の開始')).toHaveAttribute(
      'type',
      'time',
    )
    expect(screen.getByLabelText('明細 1 のメモ')).toHaveAttribute(
      'name',
      'services.0.notes',
    )
    expect(screen.queryByRole('button', { name: /を外す$/ })).toBeNull()
  })

  it('should add a line and focus its first control, and take one away with what was typed into it', async () => {
    // Arrange
    await stories.OneLine.run()
    await userEvent.type(screen.getByLabelText('明細 1 のメモ'), '一行目')

    // Act
    await userEvent.click(addButton())

    // Assert
    expect(combobox('明細 2 のメニュー')).toHaveFocus()
    expect(combobox('明細 2 の担当')).toHaveAttribute(
      'name',
      'services.1.staffId',
    )
    expect(stories.OneLine.args.onRowsChange).toHaveBeenCalledTimes(1)

    // Act
    await userEvent.type(screen.getByLabelText('明細 2 のメモ'), '二行目')
    await userEvent.click(screen.getByRole('button', { name: '明細 1 を外す' }))

    // Assert: the line that is left is the first, and kept what it had
    expect(addButton()).toHaveFocus()
    expect(screen.getByLabelText('明細 1 のメモ')).toHaveValue('二行目')
    expect(screen.queryByLabelText('明細 2 のメモ')).toBeNull()
    expect(stories.OneLine.args.onRowsChange).toHaveBeenCalledTimes(2)
  })

  it('should show the errors of an attempt at their controls until a line is taken away', async () => {
    // Arrange
    await stories.WithErrors.run()
    expect(combobox('明細 1 のメニュー')).toHaveAccessibleDescription(
      'メニューを選んでください。',
    )
    expect(screen.getByLabelText('明細 1 の開始')).toHaveAccessibleDescription(
      '開始の時刻を入力してください。',
    )
    await userEvent.click(addButton())

    // Act
    await userEvent.click(screen.getByRole('button', { name: '明細 2 を外す' }))

    // Assert: the numbers they named may be those of other lines now
    expect(combobox('明細 1 のメニュー')).not.toHaveAccessibleDescription(
      'メニューを選んでください。',
    )
    expect(
      screen.getByLabelText('明細 1 の開始'),
    ).not.toHaveAccessibleDescription('開始の時刻を入力してください。')
  })

  it('should offer no more than twenty lines, and say so', async () => {
    // Arrange
    await stories.OneLine.run()

    // Act
    for (const _ of Array.from({ length: 19 })) {
      await userEvent.click(addButton())
    }

    // Assert
    expect(combobox('明細 20 のメニュー')).toBeVisible()
    expect(screen.queryByRole('button', { name: '明細を追加する' })).toBeNull()
    expect(screen.getByText('明細は 20 までです。')).toBeVisible()
  })

  it('should say that the member is taken, with the bookings that overlap the line on the clock of the salon', async () => {
    // Act
    await stories.Taken.run()

    // Assert
    expect(screen.getByText('重なる予約があります')).toBeVisible()
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toContain('BK-4F7H-2KQM 10:30〜11:30')
  })

  it('should say that the member is free beside the bookings they take at once', async () => {
    // Act
    await stories.FreeBeside.run()

    // Assert
    expect(screen.getByText('空いています')).toBeVisible()
    expect(
      screen.getByText('（同時に受けられる数の内で、重なる予約があります）', {
        exact: false,
      }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toContain('BK-4F7H-2KQM 10:00〜11:00')
  })

  it.each<[keyof typeof stories, string]>([
    ['Free', '空いています'],
    ['Unassigned', '担当を決めない明細は、誰の時間も占有しません。'],
    ['Unchecked', '空きを確かめられませんでした'],
  ])('should say what was found out of a line (%s)', async (name, said) => {
    // Act
    await stories[name].run()

    // Assert
    expect(screen.getByText(said)).toBeVisible()
    expect(screen.queryByText('重なる予約があります')).toBeNull()
  })
})

describe('BookingLines on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the controls of a line and the way to add one, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(combobox('Service of line 1')).toHaveAccessibleDescription(
      'Choose a service.',
    )
    expect(optionsOf(combobox('Staff of line 1'))).toEqual([
      'Same as the booking',
      '田中 美咲',
      '佐藤 健',
      'Not decided',
    ])
    expect(
      screen.getByLabelText('Start of line 1'),
    ).toHaveAccessibleDescription('Enter the start time.')
    expect(screen.getByLabelText('Notes of line 1')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add a line' })).toBeVisible()
  })
})
