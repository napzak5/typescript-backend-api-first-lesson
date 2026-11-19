import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as bookingEntryFormStories from './booking-entry-form.stories'

const stories = composeStories(bookingEntryFormStories)

type Sent = [string, FormDataEntryValue][]

/** A callback that keeps what the form handed over. */
const keeping = (received: Sent[]) =>
  vi.fn((values: FormData) => {
    received.push(Array.from(values.entries()))
  })

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

/** Fills the form in: the member, a line, the notes. */
const fillIn = async () => {
  await userEvent.selectOptions(combobox('担当スタッフ'), '佐藤 健')
  await userEvent.selectOptions(
    combobox('明細 1 のメニュー'),
    'カラー（60 分）',
  )
  await userEvent.selectOptions(combobox('明細 1 の担当'), '決めない')
  await userEvent.type(screen.getByLabelText('明細 1 の開始'), '13:30')
  await userEvent.type(screen.getByLabelText('明細 1 のメモ'), '根元から')
  await userEvent.selectOptions(combobox('受付の経路'), '電話')
  await userEvent.type(screen.getByLabelText('予約金'), '2000')
}

describe('BookingEntryForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open on the day it is given, with the member, the lines and the notes in two groups', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByRole('group', { name: '担当と日時' })).toBeVisible()
    expect(screen.getByRole('group', { name: '受付の記録' })).toBeVisible()
    expect(combobox('担当スタッフ')).toHaveValue('')
    expect(combobox('担当スタッフ')).toBeRequired()
    expect(screen.getByLabelText('来店日')).toHaveValue('2026-11-20')
    expect(screen.getByLabelText('来店日')).toHaveAttribute('min', '1900-01-01')
    expect(screen.getByLabelText('来店日')).toHaveAttribute('max', '2999-12-31')
    expect(combobox('明細 1 のメニュー')).toBeVisible()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('should hand the values over when it is sent', async () => {
    // Arrange
    const received: Sent[] = []
    await stories.Empty.run({
      args: { ...stories.Empty.args, onSubmit: keeping(received) },
    })
    await fillIn()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '予約を入れる' }))

    // Assert
    expect(received).toEqual([
      [
        ['staffId', '8d5b0f3c-2a4e-4c9b-8f7d-6e3a9b2c4d81'],
        ['date', '2026-11-20'],
        ['services.0.serviceId', 'af7d2b5e-4c6a-4ebd-8b9f-8a5c1d4e6fa3'],
        ['services.0.staffId', 'none'],
        ['services.0.startTime', '13:30'],
        ['services.0.notes', '根元から'],
        ['source', 'phone'],
        ['depositAmount', '2000'],
        ['customerRequest', ''],
        ['internalNotes', ''],
      ],
    ])
  })

  it('should hand the values over to the check of the members, without sending the form', async () => {
    // Arrange
    const received: Sent[] = []
    await stories.Empty.run({
      args: { ...stories.Empty.args, onCheck: keeping(received) },
    })
    await fillIn()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '担当の空きを確かめる' }),
    )

    // Assert
    expect(received).toHaveLength(1)
    expect(received[0]).toContainEqual(['services.0.startTime', '13:30'])
    expect(stories.Empty.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should say that what was found out is out of date when the member or a line changes, and not when a note does', async () => {
    // Arrange
    const onLinesChange = vi.fn()
    await stories.Empty.run({ args: { ...stories.Empty.args, onLinesChange } })

    // Act
    await userEvent.selectOptions(combobox('担当スタッフ'), '佐藤 健')
    await userEvent.selectOptions(
      combobox('明細 1 のメニュー'),
      'カット（60 分）',
    )
    await userEvent.click(
      screen.getByRole('button', { name: '明細を追加する' }),
    )
    await userEvent.type(screen.getByLabelText('お客様の要望'), '短めに')
    await userEvent.selectOptions(combobox('受付の経路'), '店頭')

    // Assert
    expect(onLinesChange).toHaveBeenCalledTimes(3)
  })

  it('should show that the members are being checked', async () => {
    // Act
    await stories.Checking.run()

    // Assert
    expect(
      screen.getByRole('button', { name: '担当の空きを確かめる' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('should say what the check found in a sentence, and at the line', async () => {
    // Act
    await stories.Checked.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      '明細 1 の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。',
    )
    expect(screen.getByText('重なる予約があります')).toBeVisible()
    expect(screen.getByText('BK-4F7H-2KQM 10:30〜11:30')).toBeVisible()
  })

  it('should say at the controls what the API refused', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByText('入力内容を確かめてください。')).toBeVisible()
    expect(combobox('担当スタッフ')).toHaveAccessibleDescription(
      expect.stringContaining('担当スタッフを選んでください。'),
    )
    expect(combobox('明細 1 のメニュー')).toHaveAccessibleDescription(
      'メニューを選んでください。',
    )
  })

  it('should show that the booking is on its way', async () => {
    // Act
    await stories.Sending.run()

    // Assert
    expect(
      screen.getByRole('button', { name: '予約を入れる' }),
    ).toHaveAttribute('aria-busy', 'true')
  })
})
