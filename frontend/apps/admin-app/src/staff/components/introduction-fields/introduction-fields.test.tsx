import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as introductionFieldsStories from './introduction-fields.stories'

const stories = composeStories(introductionFieldsStories)

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** The controls, by their labels */
const LABELS = ['専門', '資格', '経験年数（年）', '紹介文', '写真の URL']

describe('IntroductionFields', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open empty for a member of whom nothing is said', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getAllByRole('textbox')).toHaveLength(LABELS.length)
    for (const label of LABELS) {
      expect(text(label)).toHaveValue('')
    }
  })

  it('should show the lists as texts separated as they are written, and the other values as they are', async () => {
    // Act
    await stories.Filled.run()

    // Assert
    expect(text('専門')).toHaveValue('カット、カラー')
    expect(text('資格')).toHaveValue('美容師免許、管理美容師')
    expect(text('経験年数（年）')).toHaveValue('8')
    expect(text('紹介文')).toHaveValue(
      'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
    )
    expect(text('写真の URL')).toHaveValue(
      'https://photos.example.com/staff/misaki.jpg',
    )
    expect(text('専門')).toHaveAccessibleDescription(
      '得意なメニューや技術を、「、」か「,」で区切って書きます。',
    )
    expect(text('写真の URL')).toHaveAccessibleDescription(
      'http:// か https:// で始まる URL。500 文字まで。',
    )
  })

  it('should say at a control what was refused', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text('経験年数（年）')).toHaveAccessibleDescription(
      expect.stringContaining(
        '経験年数は、0 から 100 までの整数で入力してください。',
      ),
    )
    expect(text('写真の URL')).toHaveAttribute('aria-invalid', 'true')
    expect(text('専門')).not.toHaveAttribute('aria-invalid', 'true')
  })
})
