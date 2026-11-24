import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as roleFormStories from './role-form.stories'

const stories = composeStories(roleFormStories)

/** The names of the roles offered, in their order. */
const roles = (label = 'ロール'): string[] =>
  within(screen.getByRole('radiogroup', { name: label }))
    .getAllByRole('radio')
    .map((radio) => radio.closest('label')?.textContent ?? '')

describe('RoleForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer an owner the roles of a manager and of the staff alone, none chosen, and say who gives that of an owner', async () => {
    // Act
    await stories.Invitation.run()

    // Assert
    expect(roles()).toEqual(['マネージャー', 'スタッフ'])
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(
      screen.getByRole('radiogroup', { name: 'ロール' }),
    ).toHaveAccessibleDescription(
      /オーナーのロールを与えられるのは、管理者です。/,
    )
    expect(screen.getByText(/台帳のメールアドレス/)).toBeVisible()
  })

  it('should offer an administrator every role, with the one the account has chosen', async () => {
    // Act
    await stories.RoleOfAnAccount.run()

    // Assert
    expect(roles()).toEqual(['オーナー', 'マネージャー', 'スタッフ'])
    expect(screen.getByRole('radio', { name: 'マネージャー' })).toBeChecked()
    expect(
      screen.getByRole('radiogroup', { name: 'ロール' }),
    ).not.toHaveAccessibleDescription(/与えられるのは、管理者です/)
  })

  it('should send the role chosen', async () => {
    // Arrange
    const received: FormData[] = []
    await stories.Invitation.run({
      args: {
        ...stories.Invitation.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(values)
        }),
      },
    })

    // Act
    await userEvent.click(screen.getByRole('radio', { name: 'スタッフ' }))
    await userEvent.click(
      screen.getByRole('button', { name: '招待メールを送る' }),
    )

    // Assert
    expect(received.map((values) => values.get('role'))).toEqual(['staff'])
  })

  it('should say at the choice that no role was chosen', async () => {
    // Act
    await stories.WithoutARole.run()

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'ロール' }),
    ).toHaveAccessibleDescription(/ロールを選んでください。/)
  })

  it('should say above the choice why no invitation was mailed', async () => {
    // Act
    await stories.MailedMomentsAgo.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '1 分以内に招待メールを送ったばかりです',
    )
  })
})

describe('RoleForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer the roles and say what they do, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Invitation.run()

    // Assert
    expect(roles('Role')).toEqual(['Manager', 'Staff'])
    expect(
      screen.getByRole('radiogroup', { name: 'Role' }),
    ).toHaveAccessibleDescription(
      /Only an administrator can give the role of an owner\.$/,
    )
  })

  it('should say in English at the choice that no role was chosen', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithoutARole.run()

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'Role' }),
    ).toHaveAccessibleDescription(/Choose a role\./)
  })

  it('should say in English above the choice why no invitation was mailed', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.MailedMomentsAgo.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^An invitation email was sent to 田中 美咲 less than a minute ago/,
    )
  })
})
