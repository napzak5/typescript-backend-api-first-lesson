import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { fullReview } from '../examples'
import * as reviewContentStories from './review-content.stories'

const stories = composeStories(reviewContentStories)

const said = (): (string | null)[] =>
  screen.getAllByRole('paragraph').map((paragraph) => paragraph.textContent)

describe('ReviewContent', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show everything a review holds: the day at the salon, the ratings in detail, the answer of the salon', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(said()).toEqual([
      '5.02026年11月10日来店確認済み',
      '思ったとおりの色になりました',
      '写真を見せて相談したら、髪の状態に合わせた染め方を提案してくれました。色もちもよいです。',
      'サービス 5・スタッフ 5・雰囲気 4・清潔さ 5・価格 4',
      '12 人が「参考になった」と答えています',
      'サロンからの返信（2026年11月12日）',
      'ご来店ありがとうございました。またのお越しをお待ちしています。',
    ])
    expect(screen.getByRole('img')).toHaveAccessibleName('5 段階中 5.0')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('should leave out what a review does not hold', async () => {
    // Act
    await stories.RatingAlone.run()

    // Assert
    expect(said()).toEqual(['5.02026年11月10日'])
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('should date a review by the day it was at the salon, and give the moment to a machine', async () => {
    // Act: 23:30 in Tokyo is 14:30 of the same day in UTC, and the next day in Auckland
    await stories.Complete.run({
      args: {
        review: { ...fullReview, createdAt: '2026-11-10T14:30:00.000Z' },
        timezone: 'Pacific/Auckland',
      },
    })

    // Assert
    expect(screen.getByText('2026年11月11日')).toHaveAttribute(
      'datetime',
      '2026-11-10T14:30:00.000Z',
    )
  })

  it('should show a picture as a link to the address the customer gave, which a search engine does not follow', async () => {
    // Act
    await stories.WithPictures.run()

    // Assert
    const pictures = within(
      screen.getByRole('list', { name: '写真' }),
    ).getAllByRole('link')
    expect(
      pictures.map((picture) => [
        picture.textContent,
        picture.getAttribute('href'),
        picture.getAttribute('rel'),
      ]),
    ).toEqual(
      stories.WithPictures.args.review?.imageUrls.map((address) => [
        address,
        address,
        'noreferrer nofollow ugc',
      ]),
    )
    expect(pictures).toHaveLength(2)
    expect(screen.queryByRole('img', { name: /jpg/ })).not.toBeInTheDocument()
  })

  it('should show an address that is none of the web as text, not as a link', async () => {
    // Act
    await stories.WithPictures.run({
      args: {
        ...stories.WithPictures.args,
        review: { ...fullReview, imageUrls: ['javascript:alert(1)'] },
      },
    })

    // Assert
    expect(screen.getByRole('list', { name: '写真' })).toHaveTextContent(
      'javascript:alert(1)',
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('should keep the line breaks of what was written', async () => {
    // Act
    await stories.LongText.run()

    // Assert: the style that keeps them hangs on this class
    expect(screen.getByText(/写真を見せて相談しました。/)).toHaveClass('text')
  })
})
