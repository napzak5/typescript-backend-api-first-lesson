import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { CUSTOMER_VIEW } from '../examples'
import * as profileRecordStories from './profile-record.stories'

const stories = composeStories(profileRecordStories)

/** What the record of the title says, term by term. */
const terms = (title = 'お客様に見せるプロフィール'): [string, string][] =>
  within(screen.getByRole('region', { name: title }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('ProfileRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show what the customers are shown, what the salon decides first', async () => {
    // Act
    await stories.Introduced.run()

    // Assert
    expect(terms()).toEqual([
      ['表示名', 'Misaki'],
      ['レベル', 'シニア'],
      ['役職', '店長'],
      ['予約', '受ける'],
      ['専門', 'カットカラー'],
      ['資格', '美容師免許'],
      ['経験年数', '8 年'],
      [
        '紹介文',
        'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
      ],
      ['写真の URL', 'https://photos.example.com/staff/misaki.jpg'],
    ])
    expect(
      screen.getByText(/サロンがスタッフ台帳で決めます/),
    ).toHaveTextContent(
      '表示名、レベル、役職、予約の受け方は、サロンがスタッフ台帳で決めます。変えたいときは、サロンのオーナーに伝えてください。',
    )
  })

  it('should lead to the page of the salon the customers read', async () => {
    // Act
    await stories.Introduced.run()

    // Assert
    expect(
      screen.getByRole('link', {
        name: 'お客様からの見え方を、サロンのページで見る',
      }),
    ).toHaveAttribute('href', CUSTOMER_VIEW)
  })

  it('should say what is not written yet', async () => {
    // Act
    await stories.NotIntroducedYet.run()

    // Assert
    expect(terms().slice(2)).toEqual([
      ['役職', '記録なし'],
      ['予約', '受けない'],
      ['専門', 'なし'],
      ['資格', 'なし'],
      ['経験年数', '記録なし'],
      ['紹介文', '記録なし'],
      ['写真の URL', '記録なし'],
    ])
  })
})

describe('ProfileRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show what the customers are shown, and lead to where they read it, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Introduced.run()

    // Assert
    expect(terms('Profile shown to customers')).toEqual([
      ['Display name', 'Misaki'],
      ['Level', 'Senior'],
      ['Position', '店長'],
      ['Online bookings', 'Accepted'],
      ['Specialties', 'カットカラー'],
      ['Certifications', '美容師免許'],
      ['Years of experience', '8 years'],
      [
        'Bio',
        'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
      ],
      ['Photo URL', 'https://photos.example.com/staff/misaki.jpg'],
    ])
    expect(
      screen.getByText(
        'The salon decides the display name, the level, the position and whether bookings are taken, in the staff ledger. To change them, ask the owner of the salon.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', {
        name: 'See it as customers do, on the page of the salon',
      }),
    ).toHaveAttribute('href', CUSTOMER_VIEW)
  })
})
