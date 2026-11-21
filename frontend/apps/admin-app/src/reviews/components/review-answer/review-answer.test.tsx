import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { answeredReview, unansweredReview } from '../examples'
import * as reviewAnswerStories from './review-answer.stories'

const stories = composeStories(reviewAnswerStories)

describe('ReviewAnswer', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the salon answered and when, and lead to its change before its withdrawal', async () => {
    // Act
    await stories.Answered.run()

    // Assert
    expect(
      screen.getByRole('heading', { name: 'サロンからの返信' }),
    ).toBeVisible()
    expect(screen.getByText(answeredReview.ownerResponse ?? '')).toBeVisible()
    expect(
      screen.getByText('返信日時 2026年11月19日（木） 12:00'),
    ).toBeVisible()
    const change = screen.getByRole('link', { name: '返信を直す' })
    expect(change).toHaveAttribute(
      'href',
      `/salons/${salon.id}/reviews/${answeredReview.id}/response`,
    )
    const withdrawal = screen.getByRole('button', { name: '返信を取り下げる' })
    expect(
      change.compareDocumentPosition(withdrawal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should say that the salon did not answer, lead to the answer, and offer no withdrawal', async () => {
    // Act
    await stories.Unanswered.run()

    // Assert
    expect(screen.getByText('まだ返信していません。')).toBeVisible()
    expect(screen.getByRole('link', { name: '返信を書く' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/reviews/${unansweredReview.id}/response`,
    )
    expect(
      screen.queryByRole('button', { name: '返信を取り下げる' }),
    ).toBeNull()
  })

  it('should offer an administrator the withdrawal alone, and say who writes the answers', async () => {
    // Act
    await stories.ForAdministrator.run()

    // Assert
    expect(screen.queryByRole('link', { name: '返信を直す' })).toBeNull()
    expect(
      screen.getByRole('button', { name: '返信を取り下げる' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        '管理者は、規約に反する返信を取り下げられます。返信を書くことと、運営への通報は、サロンのオーナーとマネージャーがします。',
      ),
    ).toBeVisible()
  })

  it('should offer a member of the staff nothing, and say who may', async () => {
    // Act
    await stories.ForStaff.run()

    // Assert
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(
      screen.getByText(
        '返信を書くことと、運営への通報ができるのは、サロンのオーナーとマネージャーです。',
      ),
    ).toBeVisible()
  })

  it('should open the dialog when the withdrawal is pressed', async () => {
    // Arrange
    await stories.Answered.run()
    const onAsk = vi.mocked(stories.Answered.args.onAsk ?? (() => undefined))

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '返信を取り下げる' }),
    )

    // Assert
    expect(onAsk).toHaveBeenCalledOnce()
  })

  it('should ask before the answer is withdrawn, and withdraw it or change nothing', async () => {
    // Arrange
    await stories.Asking.run()
    const { onClose, onWithdraw } = stories.Asking.args
    const dialog = screen.getByRole('dialog', {
      name: '返信を取り下げますか？',
    })
    expect(dialog).toHaveAccessibleDescription(
      'サロンからの返信を、このレビューから消します。消した返信は元に戻せません。返信は、あとからもう一度書けます。',
    )

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))
    await userEvent.click(
      within(dialog).getByRole('button', { name: '取り下げる' }),
    )

    // Assert
    expect(vi.mocked(onClose ?? (() => undefined))).toHaveBeenCalled()
    expect(vi.mocked(onWithdraw ?? (() => undefined))).toHaveBeenCalledOnce()
  })

  it('should say in the dialog what went wrong with the withdrawal', async () => {
    // Act
    await stories.WithdrawalFailed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('alert'),
    ).toHaveTextContent(
      '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })
})
