import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { createRef } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as formRowStories from './form-row.stories'

const stories = composeStories(formRowStories)

describe('FormRow', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name its controls by the row they are in', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const row = screen.getByRole('group', { name: '1 件目の施術' })
    expect(row).toHaveClass('row')
    expect(within(row).getByRole('textbox', { name: '施術' })).toBeVisible()
    expect(within(row).getByLabelText('施術日')).toBeVisible()
    expect(within(row).getByRole('button', { name: '外す' })).toBeVisible()
  })

  it('should stand its rows one below the other in their part', async () => {
    // Act
    await stories.InAPart.run()

    // Assert
    const part = screen.getByRole('group', { name: '過去の施術' })
    expect(
      within(part)
        .getAllByRole('group')
        .map((row) => row.querySelector('legend')?.textContent),
    ).toEqual(['1 件目の施術', '2 件目の施術'])
  })

  it('should hand its fieldset to a form that moves the focus into it', async () => {
    // Arrange
    const ref = createRef<HTMLFieldSetElement>()

    // Act
    await stories.Default.run({ args: { ...stories.Default.args, ref } })

    // Assert
    expect(ref.current).toBe(
      screen.getByRole('group', { name: '1 件目の施術' }),
    )
  })
})

describe('useRepeatedRows', () => {
  const nameOf = (row: string): HTMLElement =>
    within(screen.getByRole('group', { name: row })).getByRole('textbox', {
      name: 'サービス',
    })

  it('should keep the rows the form opens with, each with what it holds', async () => {
    // Act
    await stories.Repeated.run()

    // Assert
    expect(nameOf('1 つ目のサービス')).toHaveValue('カット')
    expect(nameOf('2 つ目のサービス')).toHaveValue('カラー')
    expect(
      within(screen.getByRole('group', { name: '2 つ目のサービス' })).getByRole(
        'textbox',
        { name: 'スタッフ' },
      ),
    ).toBeVisible()
    expect(nameOf('1 つ目のサービス')).toHaveAccessibleDescription(
      'サービスを選んでください。',
    )
  })

  it('should add a row at the end, and move the focus to its first control', async () => {
    // Arrange
    const user = userEvent.setup()
    await stories.Repeated.run()

    // Act
    await user.click(screen.getByRole('button', { name: 'サービスを足す' }))

    // Assert
    expect(nameOf('3 つ目のサービス')).toHaveFocus()
    expect(nameOf('3 つ目のサービス')).toHaveValue('')
  })

  it('should take a row away, keep what the others hold, move the focus to the button that adds one and say nothing of the rows until the next attempt', async () => {
    // Arrange
    const user = userEvent.setup()
    await stories.Repeated.run()
    await user.type(nameOf('2 つ目のサービス'), '・ブロー')

    // Act
    await user.click(
      screen.getByRole('button', { name: '1 つ目のサービスを外す' }),
    )

    // Assert
    expect(screen.getByRole('button', { name: 'サービスを足す' })).toHaveFocus()
    expect(screen.queryByRole('group', { name: '2 つ目のサービス' })).toBeNull()
    expect(nameOf('1 つ目のサービス')).toHaveValue('カラー・ブロー')
    expect(nameOf('1 つ目のサービス')).not.toHaveAccessibleDescription(
      'サービスを選んでください。',
    )
  })

  it('should change what a row holds, and only that row', async () => {
    // Arrange
    const user = userEvent.setup()
    await stories.Repeated.run()

    // Act
    await user.click(
      within(screen.getByRole('group', { name: '1 つ目のサービス' })).getByRole(
        'checkbox',
        { name: 'スタッフを指名する' },
      ),
    )

    // Assert
    expect(screen.getAllByRole('textbox', { name: 'スタッフ' })).toHaveLength(2)
    await user.click(
      within(screen.getByRole('group', { name: '2 つ目のサービス' })).getByRole(
        'checkbox',
        { name: 'スタッフを指名する' },
      ),
    )
    expect(
      within(screen.getByRole('group', { name: '1 つ目のサービス' })).getByRole(
        'textbox',
        { name: 'スタッフ' },
      ),
    ).toBeVisible()
    expect(screen.getAllByRole('textbox', { name: 'スタッフ' })).toHaveLength(1)
  })

  it('should add the rows a choice brings along, and leave the focus on the choice', async () => {
    // Arrange
    const user = userEvent.setup()
    await stories.RepeatedFromNone.run()
    const box = screen.getByRole('checkbox', { name: 'セットのメニューにする' })

    // Act
    await user.click(box)

    // Assert
    expect(nameOf('1 つ目のサービス')).toHaveValue('')
    expect(nameOf('2 つ目のサービス')).toHaveValue('')
    expect(screen.queryByRole('group', { name: '3 つ目のサービス' })).toBeNull()
    expect(box).toHaveFocus()
  })

  it('should give the added rows keys of their own after the rows a choice brought along', async () => {
    // Arrange
    const user = userEvent.setup()
    await stories.RepeatedFromNone.run()
    await user.click(
      screen.getByRole('checkbox', { name: 'セットのメニューにする' }),
    )
    await user.type(nameOf('2 つ目のサービス'), 'カラー')

    // Act
    await user.click(screen.getByRole('button', { name: 'サービスを足す' }))

    // Assert
    expect(nameOf('3 つ目のサービス')).toHaveFocus()
    expect(nameOf('2 つ目のサービス')).toHaveValue('カラー')
    await user.click(
      screen.getByRole('button', { name: '1 つ目のサービスを外す' }),
    )
    expect(nameOf('1 つ目のサービス')).toHaveValue('カラー')
    expect(nameOf('2 つ目のサービス')).toHaveValue('')
  })
})
