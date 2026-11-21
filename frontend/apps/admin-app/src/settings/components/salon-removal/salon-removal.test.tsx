import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as salonRemovalStories from './salon-removal.stories'

const stories = composeStories(salonRemovalStories)

describe('SalonRemoval', () => {
  it('should say what the removal does, and ask when the button is pressed', async () => {
    // Arrange
    const onRemove = vi.fn()
    await stories.Offered.run({ args: { ...stories.Offered.args, onRemove } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'サロンを削除する' }),
    )

    // Assert
    expect(
      screen.getByRole('region', { name: 'サロンの削除' }),
    ).toHaveTextContent(
      'サロン「Salon Hikari 表参道店」を削除すると、サロンの一覧とお客様の画面から消え、スタッフはこのサロンの画面を使えなくなります。',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('should lead to the bookings when bookings that are not finished keep the salon', async () => {
    // Act
    await stories.BookingsUnfinished.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。',
    )
    expect(
      screen.getByRole('link', { name: '予約台帳を開く' }),
    ).toHaveAttribute(
      'href',
      '/salons/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01/bookings',
    )
  })

  it('should say a refusal to the account without a way to the bookings', async () => {
    // Act
    await stories.Forbidden.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'このアカウントでは、このサロンを削除できません。',
    )
    expect(
      screen.queryByRole('link', { name: '予約台帳を開く' }),
    ).not.toBeInTheDocument()
  })

  itShouldBeAccessibleInEveryStory(stories)
})
