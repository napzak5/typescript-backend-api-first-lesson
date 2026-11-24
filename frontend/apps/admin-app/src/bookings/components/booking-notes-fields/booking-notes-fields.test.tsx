import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as bookingNotesFieldsStories from './booking-notes-fields.stories'

const stories = composeStories(bookingNotesFieldsStories)

describe('BookingNotesFields', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open empty, with the ways a salon takes a booking and a way of recording none', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(optionsOf('受付の経路')).toEqual([
      '記録しない',
      '電話',
      '店頭',
      'メール',
      'その他',
    ])
    expect(screen.getByRole('combobox', { name: '受付の経路' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: '予約金' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: '予約金' })).toHaveAttribute(
      'inputmode',
      'numeric',
    )
    expect(
      screen.getByRole('textbox', { name: 'サロン内のメモ' }),
    ).toHaveAccessibleDescription('お客様には見えません。')
  })

  it('should open with what a booking has, and keep a way the form does not offer', async () => {
    // Act
    await stories.Stored.run()

    // Assert
    expect(optionsOf('受付の経路')).toEqual([
      '記録しない',
      '電話',
      '店頭',
      'メール',
      'その他',
      'オンライン',
    ])
    expect(
      screen.getByRole('combobox', { name: '受付の経路' }),
    ).toHaveDisplayValue('オンライン')
    expect(screen.getByRole('textbox', { name: '予約金' })).toHaveValue('3000')
    expect(screen.getByRole('textbox', { name: 'お客様の要望' })).toHaveValue(
      '前髪は、眉が隠れるくらいの長さにしたいです。',
    )
    expect(screen.getByRole('textbox', { name: 'サロン内のメモ' })).toHaveValue(
      '前回より 1 トーン明るく。',
    )
  })

  it('should say at a control what is wrong with it', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(screen.getByRole('textbox', { name: '予約金' })).toBeInvalid()
    expect(
      screen.getByRole('textbox', { name: '予約金' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('予約金は、0 以上の円の整数で入力してください。'),
    )
  })
})

describe('BookingNotesFields on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the controls and the ways a booking comes, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      optionsOf(screen.getByRole('combobox', { name: 'How it was booked' })),
    ).toEqual(['Not recorded', 'Phone', 'Walk-in', 'Email', 'Other'])
    expect(screen.getByLabelText('Deposit')).toHaveAccessibleDescription(
      'The amount in yen taken in advance. Leave it empty if none was. Enter the deposit as a whole number of yen, 0 or more.',
    )
    expect(screen.getByLabelText('Customer’s requests')).toBeVisible()
    expect(
      screen.getByLabelText('Notes for the salon'),
    ).toHaveAccessibleDescription('Customers do not see it.')
  })
})
