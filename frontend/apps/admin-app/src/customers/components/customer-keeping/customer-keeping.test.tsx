import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as customerKeepingStories from './customer-keeping.stories'

const stories = composeStories(customerKeepingStories)

const TITLE = '山田 花子 様を台帳から削除しますか？'

const dialog = (): HTMLElement => screen.getByRole('dialog', { name: TITLE })

describe('CustomerKeeping', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should lead to the history and offer the removal to an owner or a manager', async () => {
    // Act
    await stories.Keepable.run()

    // Assert
    expect(screen.getByRole('link', { name: '変更履歴' })).toHaveAttribute(
      'href',
      stories.Keepable.args.historyHref,
    )
    expect(
      screen.getByRole('link', { name: 'ほかのお客様とまとめる' }),
    ).toHaveAttribute('href', stories.Keepable.args.mergeHref)
    expect(screen.queryByRole('dialog')).toBeNull()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '台帳から削除する' }),
    )

    // Assert
    expect(stories.Keepable.args.onOpen).toHaveBeenCalledTimes(1)
  })

  it('should tell a member of the staff who reads the history and removes, and offer neither', async () => {
    // Act
    await stories.ByOthers.run()

    // Assert
    expect(
      screen.getByText(
        '台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('should name the customer, say what follows, and remove when it is confirmed', async () => {
    // Arrange
    await stories.Asking.run()
    expect(dialog()).toHaveAccessibleDescription(
      '顧客台帳と予約で、このお客様を選べなくなります。予約と売上の記録は残ります。削除したあとも、台帳に戻せます。',
    )

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '削除する' }),
    )

    // Assert
    expect(stories.Asking.args.onRemove).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onClose).not.toHaveBeenCalled()
  })

  it('should remove nothing when the button that changes nothing is pressed', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onRemove).not.toHaveBeenCalled()
  })

  it('should say in the dialog what may be tried again, and keep its button busy while the removal is on its way', async () => {
    // Act
    await stories.NotSent.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'お客様を台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await stories.Removing.run()

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '削除する' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('should say beside the buttons why the customer stays', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '終わっていない予約があるため、削除できませんでした。',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
