import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as staffProfilesStories from './staff-profiles.stories'

const stories = composeStories(staffProfilesStories)

const personNamed = (name: string): HTMLElement => {
  const item = screen
    .getAllByRole('listitem')
    .find((candidate) =>
      within(candidate).queryByRole('heading', { level: 3, name }),
    )
  if (item === undefined) {
    throw new Error(`Nobody is named ${name}`)
  }

  return item
}

const wordsOf = (person: HTMLElement, name: string): (string | null)[] =>
  within(within(person).getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('StaffProfiles', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the people in the order it is given, each under the name the salon shows', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['田中 ひろし', '鈴木 みか', '伊藤 たけし'])
    // As many side by side as the width holds
    expect(
      screen.getAllByRole('heading', { level: 3 }).at(0)?.closest('ul'),
    ).toHaveClass('tiles')
  })

  it('should say what a person does, is good at and is qualified for', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const person = personNamed('田中 ひろし')
    expect(within(person).getByText('店長・シニア・経験 12 年')).toBeVisible()
    expect(
      within(person).getByText(
        '髪質を見きわめたカットで、朝の手入れが楽になる髪型をつくります。',
      ),
    ).toBeVisible()
    expect(wordsOf(person, '田中 ひろしの得意な施術')).toEqual([
      'カット',
      'パーマ',
    ])
    expect(wordsOf(person, '田中 ひろしの資格')).toEqual([
      '美容師免許',
      '管理美容師',
    ])
    expect(within(person).queryByText('予約の受け付けなし')).toBeNull()
  })

  it('should leave out what a person did not write', async () => {
    // Act
    await stories.Default.run()

    // Assert: no position, no years, no text, no qualification
    const person = personNamed('鈴木 みか')
    expect(within(person).getByText('エキスパート')).toBeVisible()
    expect(
      within(person)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['得意な施術'])
  })

  it('should say of a person who takes no bookings that they take none', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const person = personNamed('伊藤 たけし')
    expect(
      within(person).getByText('アシスタント・ジュニア・経験 1 年'),
    ).toBeVisible()
    expect(within(person).getByText('予約の受け付けなし')).toBeVisible()
    expect(within(person).queryByRole('term')).toBeNull()
  })

  it('should say nothing of how the people were rated while that is not known', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText('レビューは、まだありません')).toBeNull()
  })

  it('should show below the name of a person how the reviews that rate them add up', async () => {
    // Act
    await stories.WithRatings.run()
    const person = personNamed('田中 ひろし')

    // Assert
    expect(within(person).getByRole('img')).toHaveAccessibleName(
      '5 段階中 4.6（23 件）',
    )
    expect(
      Array.from(person.children, (part) => part.textContent).slice(0, 3),
    ).toEqual(['田中 ひろし', '店長・シニア・経験 12 年', '4.6（23 件）'])
    expect(within(person).queryByText('レビューは、まだありません')).toBeNull()
  })

  it('should say of a person nobody rated that there is no review yet, and nothing of a person the ratings do not name', async () => {
    // Act
    await stories.WithRatings.run()

    // Assert
    expect(
      within(personNamed('鈴木 みか')).getByText('レビューは、まだありません'),
    ).toBeVisible()
    expect(within(personNamed('鈴木 みか')).queryByRole('img')).toBeNull()
    expect(within(personNamed('伊藤 たけし')).queryByRole('img')).toBeNull()
    expect(
      within(personNamed('伊藤 たけし')).queryByText(
        'レビューは、まだありません',
      ),
    ).toBeNull()
  })

  it('should show one person alone', async () => {
    // Act
    await stories.OnePerson.run()

    // Assert
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
  })
})
