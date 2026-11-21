import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { answeredReview } from '../examples'
import * as responseFormStories from './response-form.stories'

const stories = composeStories(responseFormStories)

const answer = (): HTMLElement => screen.getByRole('textbox', { name: '返信' })

describe('ResponseForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show what the customer wrote above an empty answer', async () => {
    // Act
    await stories.FirstAnswer.run()

    // Assert
    expect(
      screen.getByRole('heading', { name: 'お客様のレビュー' }),
    ).toBeVisible()
    expect(screen.getByRole('img', { name: '5 段階中 4.0' })).toBeVisible()
    expect(screen.getByText('ヘッドスパが気持ちよかった')).toBeVisible()
    expect(screen.getByText('コメントなし')).toBeVisible()
    expect(answer()).toHaveValue('')
    expect(answer()).toBeRequired()
    expect(answer()).toHaveAccessibleDescription(
      'サロンからの返信として、レビューの下に載ります。お客様と、レビューを読むすべての人が読みます。',
    )
    expect(screen.getByRole('button', { name: '返信する' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'やめる' })).toBeVisible()
  })

  it('should start with the answer the review holds', async () => {
    // Act
    await stories.Change.run()

    // Assert
    expect(answer()).toHaveValue(answeredReview.ownerResponse)
    expect(screen.getByRole('button', { name: '返信を直す' })).toBeVisible()
  })

  it('should hand over the answer as it was written', async () => {
    // Arrange
    await stories.FirstAnswer.run()
    const onSubmit = vi.mocked(
      stories.FirstAnswer.args.onSubmit ?? (() => undefined),
    )

    // Act
    await userEvent.type(
      answer(),
      'ありがとうございました。{Enter}またお待ちしております。',
    )
    await userEvent.click(screen.getByRole('button', { name: '返信する' }))

    // Assert
    const [values] = onSubmit.mock.lastCall ?? []
    expect(values?.get('ownerResponse')).toBe(
      'ありがとうございました。\nまたお待ちしております。',
    )
  })

  it('should say what is wrong with the answer at its control, and move the focus there', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(answer()).toBeInvalid()
    expect(answer()).toHaveAccessibleDescription(/返信を入力してください。/)
    expect(answer()).toHaveFocus()
  })

  it('should say above the form what went wrong with the attempt', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })
})
