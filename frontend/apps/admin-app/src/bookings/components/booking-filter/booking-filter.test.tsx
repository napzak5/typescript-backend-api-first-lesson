import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import type { DayConditions } from '../../booking-day'
import { DAY, staff } from '../examples'
import { BookingFilter, type BookingFilterProps } from './booking-filter'
import * as bookingFilterStories from './booking-filter.stories'

const stories = composeStories(bookingFilterStories)

const date = (): HTMLElement => screen.getByLabelText('日付')
const status = (): HTMLElement => screen.getByRole('combobox', { name: '状態' })
const member = (): HTMLElement => screen.getByRole('combobox', { name: '担当' })

type UnderAnAddressProps = BookingFilterProps & { other: DayConditions }

/** The filter on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [conditions, setConditions] = useState(props.conditions)

  return (
    <>
      <BookingFilter {...props} conditions={conditions} />
      <button type='button' onClick={() => setConditions(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

describe('BookingFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.WholeDay, () =>
    screen.getByLabelText('日付'),
  )

  it('should show the day, every state and every member', async () => {
    // Act
    await stories.WholeDay.run()

    // Assert
    // The element `search`: the testing library does not know its role yet
    expect(date().closest('search')).toHaveAttribute(
      'aria-label',
      '予約を絞り込む',
    )
    expect(date()).toHaveValue(DAY)
    expect(date()).toHaveAttribute('type', 'date')
    // The days the API takes
    expect(date()).toHaveAttribute('min', '1900-01-01')
    expect(date()).toHaveAttribute('max', '2999-12-31')
    expect(status()).toHaveValue('')
    expect(optionsOf(status())).toEqual([
      'すべて',
      '確定待ち',
      '確定',
      '施術中',
      '完了',
      'キャンセル',
      '無断キャンセル',
      '下書き',
    ])
    expect(optionsOf(member())).toEqual(['すべて', '田中 美咲', '佐藤 健'])
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should show the conditions that narrow the list, and the way to the whole day', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(status()).toHaveValue('confirmed')
    expect(member()).toHaveValue(staff[1]?.id)
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      `?date=${DAY}`,
    )
  })

  it('should hand over what its controls hold, under the names of the conditions', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.WholeDay.run({
      args: {
        ...stories.WholeDay.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.selectOptions(status(), '施術中')
    await userEvent.selectOptions(member(), '佐藤 健')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(received).toEqual([
      [
        ['date', DAY],
        ['status', 'in_progress'],
        ['staffId', staff[1]?.id],
      ],
    ])
  })

  it('should show the conditions of another address when the address changes under it', async () => {
    // Arrange
    const Moving = composeStory(
      {
        ...bookingFilterStories.Narrowed,
        render: (args) => (
          <UnderAnAddress {...args} other={{ date: '2026-11-21' }} />
        ),
      },
      bookingFilterStories.default,
    )
    await Moving.run()
    await userEvent.selectOptions(status(), '完了')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(date()).toHaveValue('2026-11-21')
    expect(status()).toHaveValue('')
    expect(member()).toHaveValue('')
  })

  it('should count on its button the conditions of the sheet that narrow the bookings, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（2）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
