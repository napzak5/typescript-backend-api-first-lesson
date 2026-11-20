import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as photoFormStories from './photo-form.stories'

const stories = composeStories(photoFormStories)

/** The group of controls of the photo of a number, counted from 1 */
const photo = (number: number): HTMLElement =>
  screen.getByRole('group', { name: `${number} 枚目の写真` })

describe('PhotoForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open with one photo, say where its file is kept, and ask when it was taken and where it is', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(screen.getAllByRole('group', { name: /枚目の写真$/ })).toHaveLength(
      1,
    )
    expect(
      screen.getByText(/写真のファイルを預かりません。/),
    ).toBeInTheDocument()
    expect(
      within(photo(1)).getByRole('combobox', { name: '区分' }),
    ).toBeRequired()
    expect(
      within(photo(1))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['選んでください', '施術前', '施術中', '施術後', 'そのほか'])
    expect(within(photo(1)).getByLabelText('写真の URL')).toBeRequired()
    expect(
      within(photo(1)).getByLabelText('縮小した写真の URL'),
    ).not.toBeRequired()
    expect(
      within(photo(1)).getByRole('checkbox', {
        name: 'サロンの外（サロンのページなど）に見せてよい',
      }),
    ).toHaveAccessibleDescription(
      'お客様の同意がある写真だけ、サロンの外に見せられます。',
    )
    expect(within(photo(1)).queryByRole('button', { name: /外す$/ })).toBeNull()
  })

  it('should add a photo at the end and give its first control the focus, and take one away to give the focus back', async () => {
    // Arrange
    await stories.New.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '写真の欄を足す' }),
    )

    // Assert
    expect(
      within(photo(2)).getByRole('combobox', { name: '区分' }),
    ).toHaveFocus()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '1 枚目の写真の欄を外す' }),
    )

    // Assert
    expect(screen.getAllByRole('group', { name: /枚目の写真$/ })).toHaveLength(
      1,
    )
    expect(screen.getByRole('button', { name: '写真の欄を足す' })).toHaveFocus()
  })

  it('should offer no more photos than the record has room for', async () => {
    // Act
    await stories.LastOne.run()

    // Assert
    expect(screen.queryByRole('button', { name: '写真の欄を足す' })).toBeNull()
    expect(
      screen.getByText('この施術記録に足せる写真は、あと 1 枚です。'),
    ).toBeInTheDocument()
  })

  it('should send the photos in the order they are shown, named as the API names them', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.New.run({
      args: {
        ...stories.New.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.selectOptions(
      within(photo(1)).getByRole('combobox', { name: '区分' }),
      '施術後',
    )
    await userEvent.type(within(photo(1)).getByLabelText('撮った向き'), '正面')
    await userEvent.type(
      within(photo(1)).getByLabelText('写真の URL'),
      'https://photos.example.com/a.jpg',
    )
    await userEvent.click(
      within(photo(1)).getByRole('checkbox', {
        name: 'お客様が、写真の撮影と利用に同意している',
      }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '写真の欄を足す' }),
    )
    await userEvent.selectOptions(
      within(photo(2)).getByRole('combobox', { name: '区分' }),
      '施術前',
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    expect(received).toEqual([
      [
        ['photos.0.photoType', 'after'],
        ['photos.0.angle', '正面'],
        ['photos.0.photoUrl', 'https://photos.example.com/a.jpg'],
        ['photos.0.thumbnailUrl', ''],
        ['photos.0.description', ''],
        ['photos.0.customerConsent', 'on'],
        ['photos.1.photoType', 'before'],
        ['photos.1.angle', ''],
        ['photos.1.photoUrl', ''],
        ['photos.1.thumbnailUrl', ''],
        ['photos.1.description', ''],
      ],
    ])
  })

  it('should say what is wrong under the control of the photo it belongs to, until a photo is taken away', async () => {
    // Arrange
    await stories.WithErrors.run()
    expect(
      within(photo(1)).getByLabelText('写真の URL'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('同じ URL の写真があります'),
    )
    expect(
      within(photo(1)).getByRole('checkbox', {
        name: 'サロンの外（サロンのページなど）に見せてよい',
      }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('お客様の同意がない写真は'),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '写真の欄を足す' }),
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '2 枚目の写真の欄を外す' }),
    )

    // Assert
    expect(
      within(photo(1)).getByLabelText('写真の URL'),
    ).not.toHaveAccessibleDescription(
      expect.stringContaining('同じ URL の写真があります'),
    )
  })

  it('should say what went wrong with the attempt', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'この施術記録には、あと 1 枚まで足せます。写真の欄を減らしてください。',
    )
  })
})
