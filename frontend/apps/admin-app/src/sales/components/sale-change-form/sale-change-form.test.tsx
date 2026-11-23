import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staff } from '../examples'
import * as saleChangeFormStories from './sale-change-form.stories'

const stories = composeStories(saleChangeFormStories)

const cashier = (): HTMLElement =>
  screen.getByRole('combobox', { name: '会計の担当' })

const chosen = (): string | undefined =>
  screen.getByRole<HTMLOptionElement>('option', { selected: true })
    .textContent ?? undefined

describe('SaleChangeForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Taken, () =>
    screen.getByLabelText('会計日'),
  )

  it('should open with what the sale has, its time on the clock of the salon', async () => {
    // Act
    await stories.Taken.run()

    // Assert
    expect(chosen()).toBe('田中 美咲')
    expect(screen.getByLabelText('会計日')).toHaveValue('2026-11-20')
    expect(screen.getByLabelText('会計の時刻')).toHaveValue('11:02')
    expect(screen.getByRole('textbox', { name: 'メモ' })).toHaveValue(
      '次回はカラーの相談',
    )
    expect(
      screen.queryByRole('option', {
        name: '一覧にないスタッフ（いまの担当）',
      }),
    ).toBeNull()
  })

  it('should choose nobody for a sale that records nobody', async () => {
    // Act
    await stories.NobodyRecorded.run()

    // Assert
    expect(chosen()).toBe('記録しない')
    expect(screen.getByRole('textbox', { name: 'メモ' })).toHaveValue('')
  })

  it('should offer the member of the sale who is among the staff no more, chosen', async () => {
    // Act
    await stories.TakenByUnlisted.run()

    // Assert
    expect(chosen()).toBe('一覧にないスタッフ（いまの担当）')
  })

  it('should hand over what the controls hold', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Taken.run({
      args: {
        ...stories.Taken.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.selectOptions(cashier(), '佐藤 健')
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['staffId', staff[1]?.id],
        ['saleDate', '2026-11-20'],
        ['saleTime', '11:02'],
        ['notes', '次回はカラーの相談'],
      ],
    ])
  })

  it('should say what is wrong at the controls, and take the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(cashier()).toHaveAccessibleDescription(
      expect.stringContaining(
        'このスタッフは、その間に削除されたため、選べません。',
      ),
    )
    expect(screen.getByLabelText('会計の時刻')).toHaveAccessibleDescription(
      expect.stringContaining('会計日時は、いまより前にしてください。'),
    )
    expect(cashier()).toHaveFocus()
  })
})

describe('SaleChangeForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should open with what the sale has, and say what each control records, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Taken.run()

    // Assert
    expect(
      screen.getByRole('combobox', { name: 'Cashier' }),
    ).toHaveAccessibleDescription('The staff member who took the payment.')
    expect(screen.getByLabelText('Date of sale')).toHaveAccessibleDescription(
      'The date on the clock of the salon. The sales ledger finds the sale by this date.',
    )
    expect(
      screen.getByLabelText('Time of the sale'),
    ).toHaveAccessibleDescription(
      'When the payment was taken. It cannot be later than now.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Notes' }),
    ).toHaveAccessibleDescription(
      'A note on this sale for the salon. Customers do not see it. Leave it empty to remove the note.',
    )
    expect(
      screen.getByRole('button', { name: 'Save the changes' }),
    ).toBeVisible()
  })

  it('should offer the member who is among the staff no more, and nobody, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.TakenByUnlisted.run()

    // Assert
    expect(
      optionsOf(screen.getByRole('combobox', { name: 'Cashier' })),
    ).toEqual([
      '田中 美咲',
      '佐藤 健',
      'Staff member not listed (the cashier now)',
      'Not recorded',
    ])
  })

  it('should say what is wrong at the controls in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByLabelText('Time of the sale'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('The time of the sale must be before now.'),
    )
  })
})
