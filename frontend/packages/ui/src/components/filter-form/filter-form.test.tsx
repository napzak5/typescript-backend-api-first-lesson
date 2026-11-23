import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { act, useState } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as filterFormStories from './filter-form.stories'

const stories = composeStories(filterFormStories)

const keyword = () => screen.getByRole('searchbox', { name: 'キーワード' })
const sheet = () => screen.getByRole('dialog', { name: 'お客様を探す' })
const sheetButton = () => screen.getByRole('button', { name: /^条件/ })

/**
 * A screen whose address changes under its filter: the user went back to
 * the conditions of before
 */
const GoingBack = () => {
  const [search, setSearch] = useState<string | undefined>('山田')

  return (
    <>
      <button type='button' onClick={() => setSearch(undefined)}>
        戻る
      </button>
      <stories.Default shown={{ search, status: 'suspended' }} />
    </>
  )
}

/** The values a form handed over, under their names */
const entriesOf = (values: FormData | undefined): [string, string][] =>
  [...(values?.entries() ?? [])].map(([name, value]) => [name, String(value)])

describe('FilterForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it('should show every condition on a wide screen, and send them under their names', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Narrowed.run({
      args: { ...stories.Narrowed.args, onSubmit },
    })

    // Act
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert: testing-library does not know the role of `search`
    expect(keyword().closest('search')).toHaveAttribute(
      'aria-label',
      'お客様を探す',
    )
    expect(screen.getByRole('combobox', { name: 'ステータス' })).toHaveValue(
      'active',
    )
    expect(screen.queryByRole('button', { name: /^条件/ })).toBeNull()
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '?',
    )
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toEqual([
      ['search', '山田'],
      ['from', '2026-04-01'],
      ['to', ''],
      ['status', 'active'],
    ])
  })

  it('should keep what was typed while the address stays, and show the conditions of another address when it changes', async () => {
    // Arrange
    const Back = composeStory(
      { ...filterFormStories.Default, render: () => <GoingBack /> },
      filterFormStories.default,
    )
    await Back.run()
    await userEvent.type(keyword(), ' 花子')
    const typed = keyword().getAttribute('value')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '戻る' }))

    // Assert
    expect(typed).toBe('山田 花子')
    expect(keyword()).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'ステータス' })).toHaveValue(
      'suspended',
    )
  })

  it('should keep what was typed in one control while another is changed', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Narrowed.run({
      args: { ...stories.Narrowed.args, onSubmit },
    })
    await userEvent.type(keyword(), ' 花子')

    // Act
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'ステータス' }),
      '休止中',
    )
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(keyword()).toHaveValue('山田 花子')
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toEqual([
      ['search', '山田 花子'],
      ['from', '2026-04-01'],
      ['to', ''],
      ['status', 'suspended'],
    ])
  })

  it('should send what was typed with the Enter key', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Default.run({ args: { ...stories.Default.args, onSubmit } })

    // Act
    await userEvent.type(keyword(), '佐藤{Enter}')

    // Assert
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toContainEqual([
      'search',
      '佐藤',
    ])
  })

  it('should keep the keyword in sight on a narrow screen, and the other conditions behind a button that counts them', async () => {
    // Act
    await stories.OnANarrowScreen.run()

    // Assert
    expect(keyword()).toHaveValue('山田')
    expect(screen.queryByRole('combobox', { name: 'ステータス' })).toBeNull()
    expect(sheetButton()).toHaveAccessibleName('条件（2）')
    expect(sheetButton()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.getByRole('button', { name: '探す' })).toBeVisible()
    expect(screen.getByRole('link', { name: '条件を外す' })).toBeVisible()
  })

  it('should not count on the button when no condition of the sheet narrows the list', async () => {
    // Arrange
    const Unnarrowed = composeStory(
      { ...filterFormStories.OnANarrowScreen, args: { shown: {} } },
      filterFormStories.default,
    )

    // Act
    await Unnarrowed.run()

    // Assert
    expect(sheetButton()).toHaveAccessibleName('条件')
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should open the other conditions as a sheet, and close it once they are sent with the keyword', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.OnANarrowScreen.run({
      args: { ...stories.OnANarrowScreen.args, onSubmit },
    })
    await userEvent.click(sheetButton())
    await userEvent.selectOptions(
      within(sheet()).getByRole('combobox', { name: 'ステータス' }),
      '休止中',
    )

    // Act
    await userEvent.click(within(sheet()).getByRole('button', { name: '探す' }))

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toEqual([
      ['search', '山田'],
      ['from', '2026-04-01'],
      ['to', ''],
      ['status', 'suspended'],
    ])
  })

  it('should keep what was chosen in the sheet when it is closed, and send it with the button in sight', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.OnANarrowScreen.run({
      args: { ...stories.OnANarrowScreen.args, onSubmit },
    })
    await userEvent.click(sheetButton())
    await userEvent.selectOptions(
      within(sheet()).getByRole('combobox', { name: 'ステータス' }),
      '休止中',
    )
    await userEvent.click(
      within(sheet()).getByRole('button', { name: '閉じる' }),
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toContainEqual([
      'status',
      'suspended',
    ])
  })

  it('should open the sheet again when the answer names an error of a control in it, with the focus on that control', async () => {
    // Arrange
    await stories.RefusedOnANarrowScreen.run()
    await userEvent.click(sheetButton())

    // Act
    await userEvent.click(within(sheet()).getByRole('button', { name: '探す' }))

    // Assert
    const to = within(sheet()).getByLabelText('登録日（まで）')
    expect(to).toHaveFocus()
    expect(to).toHaveAccessibleDescription(
      '「登録日（から）」より後の日を入力してください。',
    )
  })

  it('should open the sheet again when the button in sight sends a condition of it that is refused', async () => {
    // Arrange
    await stories.RefusedOnANarrowScreen.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(within(sheet()).getByLabelText('登録日（まで）')).toHaveFocus()
  })

  it('should leave the sheet closed when the error is that of the keyword in sight', async () => {
    // Arrange
    const Refused = composeStory(
      {
        ...filterFormStories.OnANarrowScreen,
        args: {
          ...filterFormStories.OnANarrowScreen.args,
          errors: { search: '100 文字以内で入力してください。' },
        },
      },
      filterFormStories.default,
    )

    // Act
    await Refused.run()

    // Assert
    expect(keyword()).toHaveFocus()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should move the focus to the control with the error on a wide screen, where every condition is in sight', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(screen.getByLabelText('登録日（まで）')).toHaveFocus()
  })

  it('should send nothing when the sheet is closed with its button', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.OnANarrowScreen.run({
      args: { ...stories.OnANarrowScreen.args, onSubmit },
    })
    await userEvent.click(sheetButton())

    // Act
    await userEvent.click(
      within(sheet()).getByRole('button', { name: '閉じる' }),
    )

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should put the conditions of an open sheet in sight when the window is made wide, and keep the sheet closed when it is made narrow again', async () => {
    // Arrange
    await stories.OnANarrowScreen.run()
    await userEvent.click(sheetButton())

    // Act
    act(() => setWindowWidth(1024))
    const wide = screen.getByRole('combobox', { name: 'ステータス' })
    act(() => setWindowWidth(390))

    // Assert
    expect(wide).toHaveValue('active')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sheetButton()).toBeVisible()
  })

  it('should give a filter of choices only the button of the sheet on a narrow screen, and the button that shows the list in the sheet', async () => {
    // Arrange
    await stories.ChoicesOnlyOnANarrowScreen.run()
    const inSight = screen.queryByRole('button', { name: '表示する' })

    // Act
    await userEvent.click(sheetButton())

    // Assert
    expect(inSight).toBeNull()
    expect(
      within(screen.getByRole('dialog', { name: '予約を絞り込む' })).getByRole(
        'button',
        { name: '表示する' },
      ),
    ).toBeVisible()
  })

  it('should count over the days that are sent, with how they are cut', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Counting.run({
      args: {
        ...stories.Counting.args,
        shown: { from: '2026-04-01', to: '2026-04-30' },
        onSubmit,
      },
    })

    // Act
    await userEvent.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    expect(
      screen.getByLabelText('集計する期間（から）').closest('search'),
    ).toHaveAttribute('aria-label', '集計する期間')
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toEqual([
      ['from', '2026-04-01'],
      ['to', '2026-04-30'],
      ['unit', 'daily'],
    ])
  })

  it('should keep a search by one keyword without a sheet on a narrow screen', async () => {
    // Arrange: the story chooses no viewport, and keeps the width of the test
    setWindowWidth(390)

    // Act
    await stories.KeywordOnly.run()

    // Assert
    expect(screen.getByRole('button', { name: '探す' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^条件/ })).toBeNull()
  })

  it.each([
    { story: stories.Default, name: 'Search' },
    { story: stories.ChoicesOnly, name: 'Show' },
    { story: stories.Counting, name: 'Calculate' },
  ])(
    'should name the button that sends it in English on a page in English: $name',
    async ({ story, name }) => {
      // Arrange
      languageStore.choose('en')

      // Act
      await story.run()

      // Assert
      expect(
        screen
          .getAllByRole('button')
          .filter((button) => button.getAttribute('type') === 'submit')
          .map(({ textContent }) => textContent),
      ).toEqual([name])
    },
  )

  it('should offer in English to clear the conditions that narrow the list', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('link', { name: 'Clear filters' })).toBeVisible()
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should count the conditions behind the button of the sheet in English on a narrow screen', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.OnANarrowScreen.run()

    // Assert
    expect(screen.getByRole('button', { name: 'Filters (2)' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
    expect(screen.getByRole('link', { name: 'Clear filters' })).toBeVisible()
  })

  it('should name the button of the sheet in English without a count when nothing of the sheet narrows the list', async () => {
    // Arrange
    languageStore.choose('en')
    const Unnarrowed = composeStory(
      { ...filterFormStories.OnANarrowScreen, args: { shown: {} } },
      filterFormStories.default,
    )

    // Act
    await Unnarrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })

  it('should name the buttons of the sheet in English: the one that sends, and the one that closes', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.SheetOnANarrowScreen.run()

    // Assert
    expect(
      within(sheet())
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(expect.arrayContaining(['Close', 'Search']))
    expect(within(sheet()).queryByRole('button', { name: '閉じる' })).toBeNull()
  })
})
