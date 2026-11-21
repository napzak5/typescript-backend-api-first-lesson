import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { type ReactNode, useLayoutEffect } from 'react'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { bookableStaff, DAY, TODAY, times } from '../examples'
import * as bookingFormStories from './booking-form.stories'

const stories = composeStories(bookingFormStories)

type WhereTheFocusIs = (focused: Element | null) => void

type InCommitProps = {
  seen: WhereTheFocusIs
  children: ReactNode
}

/**
 * Hands over where the focus is in the commit that shows what it holds: the
 * layout effect of a component runs after those of what it holds, and before
 * the browser paints.
 */
const InCommit = ({ seen, children }: InCommitProps) => {
  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  return children
}

const [HIROSHI, MIKA] = bookableStaff.map((member) => member.id)

const staffControl = () => screen.getByRole('combobox', { name: 'スタッフ' })
const dateControl = () => screen.getByLabelText('日付')
const timeControls = () => screen.getByRole('radiogroup', { name: '開始時刻' })
const time = (label: string) => screen.getByRole('radio', { name: label })
const requestControl = () => screen.getByRole('textbox', { name: 'ご要望' })
const sendButton = () =>
  screen.getByRole('button', { name: 'この内容で予約する' })

/** The stories in which there is no time to choose */
const WITHOUT_A_CHOICE: [string, { run: () => Promise<void> }][] = [
  ['the times are being read', stories.ReadingTimes],
  ['the day has no time', stories.WithoutTimes],
  ['the times were not read', stories.TimesUnread],
]

describe('BookingForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.WithTimes, () =>
    screen.getByLabelText('日付'),
  )

  describe('with whom', () => {
    it('should offer nobody in particular, then the members of the staff, and show that nobody is asked for', async () => {
      // Act
      await stories.WithTimes.run()

      // Assert
      expect(
        within(staffControl())
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['指名しない', '田中 ひろし', '鈴木 みか'])
      expect(staffControl()).toHaveValue('')
    })

    it('should show the member of the staff who is asked for', async () => {
      // Act
      await stories.WithStaffChosen.run()

      // Assert
      expect(staffControl()).toHaveDisplayValue('鈴木 みか')
    })

    it('should hand over the member of the staff who is chosen, and the day as it is', async () => {
      // Arrange
      await stories.WithTimes.run()

      // Act
      await userEvent.selectOptions(staffControl(), '田中 ひろし')

      // Assert
      expect(stories.WithTimes.args.onChoose).toHaveBeenCalledExactlyOnceWith({
        staffId: HIROSHI,
        date: DAY,
      })
    })

    it('should hand over no member of the staff when nobody in particular is chosen', async () => {
      // Arrange
      await stories.WithStaffChosen.run()

      // Act
      await userEvent.selectOptions(staffControl(), '指名しない')

      // Assert
      expect(
        stories.WithStaffChosen.args.onChoose,
      ).toHaveBeenCalledExactlyOnceWith({ staffId: undefined, date: DAY })
    })
  })

  describe('on which day', () => {
    it('should show the day that is chosen, and take no day before today', async () => {
      // Act
      await stories.WithTimes.run()

      // Assert
      expect(dateControl()).toHaveValue(DAY)
      expect(dateControl()).toHaveAttribute('min', TODAY)
      expect(dateControl()).toBeRequired()
    })

    it.each([
      ['a later day', '2026-12-01'],
      ['today', TODAY],
    ])(
      'should hand over %s when it is entered, with the member of the staff as they are',
      async (_case, date) => {
        // Arrange
        await stories.WithStaffChosen.run()

        // Act
        fireEvent.change(dateControl(), { target: { value: date } })

        // Assert
        expect(
          stories.WithStaffChosen.args.onChoose,
        ).toHaveBeenCalledExactlyOnceWith({ staffId: MIKA, date })
      },
    )

    it.each([
      ['a control that was emptied', ''],
      ['a day that has passed', '2026-11-18'],
    ])(
      'should choose nothing for %s, and show the day that is chosen',
      async (_case, date) => {
        // Arrange
        await stories.WithTimes.run()

        // Act
        fireEvent.change(dateControl(), { target: { value: date } })

        // Assert
        expect(stories.WithTimes.args.onChoose).not.toHaveBeenCalled()
        expect(dateControl()).toHaveValue(DAY)
      },
    )

    it('should go on to the day after, and back to the day before', async () => {
      // Arrange
      await stories.WithTimes.run()

      // Act
      await userEvent.click(screen.getByRole('button', { name: '次の日' }))
      await userEvent.click(screen.getByRole('button', { name: '前の日' }))

      // Assert
      expect(stories.WithTimes.args.onChoose).toHaveBeenNthCalledWith(1, {
        staffId: undefined,
        date: '2026-11-25',
      })
      expect(stories.WithTimes.args.onChoose).toHaveBeenNthCalledWith(2, {
        staffId: undefined,
        date: '2026-11-23',
      })
    })

    it('should offer no day before today', async () => {
      // Act
      await stories.Today.run()

      // Assert
      expect(screen.getByRole('button', { name: '前の日' })).toBeDisabled()
      expect(screen.getByRole('button', { name: '次の日' })).toBeEnabled()
    })

    it('should not send the form when a day beside the chosen one is asked for', async () => {
      // Arrange
      await stories.WithTimes.run()

      // Act
      await userEvent.click(screen.getByRole('button', { name: '次の日' }))

      // Assert
      expect(stories.WithTimes.args.onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('at which time', () => {
    it('should offer the times of the day as one choice that has to be made, and say which day they are of', async () => {
      // Act
      await stories.WithTimes.run()

      // Assert
      expect(
        within(timeControls())
          .getAllByRole('radio')
          .map((radio) => radio.closest('label')?.textContent),
      ).toEqual(times.map(({ label }) => label))
      expect(timeControls()).toBeRequired()
      expect(timeControls()).toHaveAccessibleDescription(
        '11月24日（火）の、空いている時刻です。時刻は、サロンのある地域の時刻です。',
      )
      expect(time('10:00')).not.toBeChecked()
    })

    it('should lay the times out in columns', async () => {
      // Act
      await stories.WithTimes.run()

      // Assert
      expect(time('10:00').closest('label')?.parentElement).toHaveClass(
        'columns',
      )
    })

    it.each(WITHOUT_A_CHOICE)(
      'should have no time to choose and nothing to send while %s',
      async (_case, story) => {
        // Act
        await story.run()

        // Assert
        expect(screen.queryByRole('radiogroup')).toBeNull()
        expect(
          screen.queryByRole('button', { name: 'この内容で予約する' }),
        ).toBeNull()
        expect(requestControl()).toBeVisible()
      },
    )

    it('should say that the times are being read, to whoever waits', async () => {
      // Act
      await stories.ReadingTimes.run()

      // Assert
      expect(screen.getByText('空いている時刻を読み込んでいます')).toHaveRole(
        'status',
      )
    })

    it('should say that the day has no time, and what to change', async () => {
      // Act
      await stories.WithoutTimes.run()

      // Assert
      expect(
        screen.getByText('この日は、予約できる時刻がありません'),
      ).toBeVisible()
      expect(
        screen.getByText('日付かスタッフを変えて、お探しください。'),
      ).toBeVisible()
    })

    it('should say that the times were not read, and ask for them again when the button is pressed', async () => {
      // Arrange
      await stories.TimesUnread.run()

      // Act
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(
        '空いている時刻を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(stories.TimesUnread.args.onRetry).toHaveBeenCalledTimes(1)
      expect(stories.TimesUnread.args.onSubmit).not.toHaveBeenCalled()
    })

    it('should show that the times are being asked for again', async () => {
      // Act
      await stories.ReadingTimesAgain.run()

      // Assert
      expect(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      ).toHaveAttribute('aria-busy', 'true')
    })

    it('should say that there were too many requests when that is why the times were not read', async () => {
      // Act
      await stories.TooManyRequests.run()

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      )
    })
  })

  describe('sending', () => {
    it('should hand over the time that was chosen and what was written, under their names, and nothing else', async () => {
      // Arrange
      const received: [string, FormDataEntryValue][][] = []
      await stories.WithTimes.run({
        args: {
          ...stories.WithTimes.args,
          onSubmit: vi.fn((values: FormData) => {
            received.push(Array.from(values.entries()))
          }),
        },
      })

      // Act
      await userEvent.click(time('10:30'))
      await userEvent.type(requestControl(), '静かな席を希望します')
      await userEvent.click(sendButton())

      // Assert
      expect(received).toEqual([
        [
          ['startTime', '2026-11-24T01:30:00.000Z'],
          ['customerRequest', '静かな席を希望します'],
        ],
      ])
    })

    it('should hand over no time when none was chosen', async () => {
      // Arrange
      const received: [string, FormDataEntryValue][][] = []
      await stories.WithTimes.run({
        args: {
          ...stories.WithTimes.args,
          onSubmit: vi.fn((values: FormData) => {
            received.push(Array.from(values.entries()))
          }),
        },
      })

      // Act
      await userEvent.click(sendButton())

      // Assert
      expect(received).toEqual([[['customerRequest', '']]])
    })

    it('should move the choice with the arrow keys, as the browser does for the buttons of one name', async () => {
      // Arrange
      await stories.WithTimes.run()
      await userEvent.click(time('10:00'))

      // Act
      await userEvent.keyboard('{ArrowDown}')

      // Assert
      expect(time('10:30')).toBeChecked()
      expect(time('10:00')).not.toBeChecked()
    })

    it('should show that the booking is on its way, and not send it a second time', async () => {
      // Arrange
      await stories.Sending.run()

      // Act
      await userEvent.click(sendButton())

      // Assert
      expect(sendButton()).toHaveAttribute('aria-busy', 'true')
      expect(stories.Sending.args.onSubmit).not.toHaveBeenCalled()
    })

    it('should send the time alone, with the button it is given, when it is given no other control', async () => {
      // Arrange
      const received: [string, FormDataEntryValue][][] = []
      await stories.Moving.run({
        args: {
          ...stories.Moving.args,
          onSubmit: vi.fn((values: FormData) => {
            received.push(Array.from(values.entries()))
          }),
        },
      })

      // Act
      await userEvent.click(time('11:00'))
      await userEvent.click(
        screen.getByRole('button', { name: 'この日時に変更する' }),
      )

      // Assert
      expect(received).toEqual([[['startTime', '2026-11-24T02:00:00.000Z']]])
      expect(screen.queryByRole('textbox', { name: 'ご要望' })).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'この内容で予約する' }),
      ).toBeNull()
    })

    it('should not send it a second time when no button is pressed, either', async () => {
      // Arrange
      await stories.Sending.run()
      const form = sendButton().closest('form')

      // Act: the Enter key in the date, and an extension that sends the
      // form itself, press no button
      form?.requestSubmit()

      // Assert
      expect(form).toBeInstanceOf(HTMLFormElement)
      expect(stories.Sending.args.onSubmit).not.toHaveBeenCalled()
    })

    it('should say what went wrong with the attempt as a whole, at once', async () => {
      // Act
      await stories.Refused.run()

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(
        'この日時では、予約できませんでした。空いている時刻を読み込み直しましたので、選び直してください。',
      )
    })

    it('should say nothing about the attempt when nothing went wrong', async () => {
      // Act
      await stories.WithTimes.run()

      // Assert
      expect(screen.queryByRole('alert')).toBeNull()
      expect(timeControls()).not.toHaveAttribute('aria-invalid')
    })
  })

  describe('a time that was not chosen', () => {
    it('should say at the times that one is to be chosen, and move the focus to the first of them', async () => {
      // Act
      await stories.WithoutTimeChosen.run()

      // Assert
      expect(timeControls()).toHaveAttribute('aria-invalid', 'true')
      expect(timeControls()).toHaveAccessibleDescription(
        expect.stringContaining('開始時刻を選択してください。'),
      )
      expect(time('10:00')).toHaveFocus()
    })

    it('should have moved the focus in the commit that shows the error, before it is painted', async () => {
      // Arrange
      const seen = vi.fn<WhereTheFocusIs>()
      const WithoutTimeChosen = composeStory(
        {
          ...bookingFormStories.WithoutTimeChosen,
          decorators: [
            (Story) => (
              <InCommit seen={seen}>
                <Story />
              </InCommit>
            ),
          ],
        },
        bookingFormStories.default,
      )

      // Act
      await WithoutTimeChosen.run()

      // Assert
      expect(seen).toHaveBeenLastCalledWith(time('10:00'))
    })

    it('should move the focus again for the answer to another attempt, also when it says the same', async () => {
      // Arrange
      await stories.WithoutTimeChosen.run()
      await userEvent.click(requestControl())

      // Act
      await stories.WithoutTimeChosen.run({
        args: {
          ...stories.WithoutTimeChosen.args,
          errors: { ...stories.WithoutTimeChosen.args.errors },
        },
      })

      // Assert
      expect(time('10:00')).toHaveFocus()
    })

    it('should leave the focus where it is when there is no error', async () => {
      // Act
      await stories.WithTimes.run()

      // Assert
      expect(document.body).toHaveFocus()
    })
  })
})
