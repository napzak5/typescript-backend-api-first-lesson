import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as chosenCustomersStories from './chosen-customers.stories'

const stories = composeStories(chosenCustomersStories)

const part = (count: number): HTMLElement =>
  screen.getByRole('region', { name: `${count} 人を選んでいます` })

const buttonsOf = (element: HTMLElement): (string | null)[] =>
  within(element)
    .getAllByRole('button')
    .map((button) => button.textContent)

type Sent = [string, FormDataEntryValue][]

describe('ChosenCustomers', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say how many customers are chosen, and offer to tag them, to remove them and to choose nobody', async () => {
    // Act
    await stories.Chosen.run()

    // Assert
    expect(buttonsOf(part(3))).toEqual([
      'タグを付ける・外す',
      '台帳から削除する',
      '選ぶのをやめる',
    ])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should say what choosing is for before anybody is chosen, with no button and no dialog', async () => {
    // Act
    await stories.NoneChosen.run({
      args: { ...stories.NoneChosen.args, open: 'tag' },
    })

    // Assert
    const region = screen.getByRole('region', {
      name: '選んだお客様はいません',
    })
    expect(region).toHaveTextContent(
      '表でお客様を選ぶと、まとめてタグを付けたり外したり、台帳から削除したりできます。',
    )
    expect(within(region).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should not tell a member of the staff of a removal before anybody is chosen', async () => {
    // Act
    await stories.NoneChosenByStaff.run()

    // Assert
    expect(
      screen.getByRole('region', { name: '選んだお客様はいません' }),
    ).toHaveTextContent(
      '表でお客様を選ぶと、まとめてタグを付けたり外したりできます。',
    )
  })

  it('should not offer a member of the staff to remove the customers', async () => {
    // Act
    await stories.ByStaff.run()

    // Assert
    expect(buttonsOf(part(3))).toEqual(['タグを付ける・外す', '選ぶのをやめる'])
  })

  it('should say that no more than 100 are written at once, and wait until fewer are chosen', async () => {
    // Act
    await stories.TooMany.run()

    // Assert
    expect(
      within(part(101)).getByText(
        '一度に操作できるのは 100 人までです。選ぶお客様を減らしてください。',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'タグを付ける・外す' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '台帳から削除する' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: '選ぶのをやめる' })).toBeEnabled()
  })

  it('should ask for a dialog, or for nobody to be chosen, as its buttons are pressed', async () => {
    // Arrange
    const onOpen = vi.fn()
    const onClear = vi.fn()
    await stories.Chosen.run({
      args: { ...stories.Chosen.args, onOpen, onClear },
    })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'タグを付ける・外す' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '台帳から削除する' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '選ぶのをやめる' }),
    )

    // Assert
    expect(onOpen.mock.calls).toEqual([['tag'], ['removal']])
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('should give the tag by default, and send the way and the tag the dialog holds', async () => {
    // Arrange
    const received: Sent[] = []
    await stories.Tagging.run({
      args: {
        ...stories.Tagging.args,
        onRetag: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    const dialog = screen.getByRole('dialog', { name: '選んだ 3 人のタグ' })

    // Act
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'タグ' }),
      '秋のキャンペーン',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: '反映する' }),
    )
    await userEvent.click(within(dialog).getByRole('radio', { name: '外す' }))
    await userEvent.click(
      within(dialog).getByRole('button', { name: '反映する' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['way', 'add'],
        ['tag', '秋のキャンペーン'],
      ],
      [
        ['way', 'remove'],
        ['tag', '秋のキャンペーン'],
      ],
    ])
    expect(dialog).toHaveAccessibleDescription(
      'タグを付けるか外すかを選び、タグを 1 つ入力します。お客様のほかのタグは、そのまま残ります。',
    )
  })

  it('should say what is wrong with the tag at its control, and put the focus there', async () => {
    // Act
    await stories.TagMissing.run()

    // Assert
    const tag = screen.getByRole('textbox', { name: 'タグ' })
    expect(tag).toBeInvalid()
    expect(tag).toHaveAccessibleDescription(
      expect.stringContaining('タグを入力してください。'),
    )
    expect(tag).toHaveFocus()
  })

  it('should list who are removed, ask before it, and remove them or go back', async () => {
    // Arrange
    const onRemove = vi.fn()
    const onClose = vi.fn()
    await stories.Removing.run({
      args: { ...stories.Removing.args, onRemove, onClose },
    })
    const dialog = screen.getByRole('dialog', {
      name: '3 人のお客様を台帳から削除しますか？',
    })

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))
    await userEvent.click(
      within(dialog).getByRole('button', { name: '削除する' }),
    )

    // Assert
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['山田 花子 様', '鈴木 一郎 様', '山田 花子 様'])
    expect(dialog).toHaveAccessibleDescription(
      '顧客台帳と予約で、これらのお客様を選べなくなります。予約と売上の記録は残ります。',
    )
    expect(onClose).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('should say in the dialog why the removal was refused', async () => {
    // Act
    await stories.RemovalRefused.run()

    // Assert
    expect(
      within(
        screen.getByRole('dialog', {
          name: '3 人のお客様を台帳から削除しますか？',
        }),
      ).getByRole('alert'),
    ).toHaveTextContent('鈴木 一郎 様には、終わっていない予約があります。')
  })

  it('should say why the removal was refused in its own dialog alone, not in the closed one of the tags', async () => {
    // Act
    await stories.RemovalRefused.run()

    // Assert
    expect(
      screen.getAllByText(/^鈴木 一郎 様には、終わっていない予約があります。/),
    ).toHaveLength(1)
  })
})

describe('ChosenCustomers on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what choosing is for, and how many are chosen, in English', async () => {
    // Arrange
    languageStore.choose('en')
    await stories.Chosen.run({
      args: { ...stories.Chosen.args, customers: [] },
    })

    // Assert
    expect(
      within(
        screen.getByRole('region', { name: 'No customers chosen' }),
      ).getByText(
        'Choose customers in the table to add or remove a tag, or to remove them from the ledger, all at once.',
      ),
    ).toBeVisible()

    // Act
    await stories.Chosen.run()

    // Assert
    expect(
      buttonsOf(screen.getByRole('region', { name: '3 customers chosen' })),
    ).toEqual([
      'Add or remove a tag',
      'Remove from the ledger',
      'Clear the choice',
    ])

    // Act
    await stories.TooMany.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'Up to 100 customers can be handled at once. Choose fewer customers.',
    )
  })

  it('should ask for the tag in English, and say what is wrong with it', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.TagMissing.run()

    // Assert
    const dialog = screen.getByRole('dialog', {
      name: 'Tag of the chosen customers (3)',
    })
    expect(dialog).toHaveAccessibleDescription(
      'Choose whether to add or remove the tag, and enter one tag. The other tags of the customers stay as they are.',
    )
    expect(
      within(within(dialog).getByRole('radiogroup', { name: 'The tag' }))
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Add', 'Remove'])
    expect(
      within(dialog).getByRole('textbox', { name: 'Tag' }),
    ).toHaveAccessibleDescription('For example: Autumn campaign Enter a tag.')
    expect(within(dialog).getByRole('button', { name: 'Apply' })).toBeVisible()
  })

  it('should list who are removed and say why the removal was refused, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.RemovalRefused.run()

    // Assert
    const dialog = screen.getByRole('dialog', {
      name: 'Remove 3 customers from the ledger?',
    })
    expect(dialog).toHaveAccessibleDescription(
      'These customers can no longer be chosen in the customer ledger and in bookings. Their bookings and sales are kept.',
    )
    expect(
      within(within(dialog).getByRole('list', { name: 'Customers to remove' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['山田 花子', '鈴木 一郎', '山田 花子'])
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '鈴木 一郎 has bookings that are not finished. Complete, cancel or delete those bookings, then try again. Nobody was removed.',
    )
    expect(
      buttonsOf(dialog).filter((name) => name === 'Back' || name === 'Remove'),
    ).toEqual(['Back', 'Remove'])
  })
})
