import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { aTreatment, photos } from '../examples'
import * as treatmentPhotosStories from './treatment-photos.stories'

const stories = composeStories(treatmentPhotosStories)

const part = (): HTMLElement => screen.getByRole('region', { name: '施術写真' })

const dialog = (): HTMLElement => screen.getByRole('dialog')

/** What the list shows of each photo: its caption, its image and the address it opens */
const shown = (): [string, string | null, string | null][] =>
  within(part())
    .getAllByRole('listitem')
    .map((item) => [
      within(item).getByRole('figure').textContent ?? '',
      item.querySelector('img')?.getAttribute('src') ?? null,
      within(item).getByRole('link').getAttribute('href'),
    ])

describe('TreatmentPhotos', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the photos in their order, each with what it shows and how the customer let it be used', async () => {
    // Act
    await stories.Photos.run()

    // Assert
    expect(shown()).toEqual([
      [
        '1 枚目：施術前の写真（側面）毛先の色落ちお客様の同意あり。サロンの中だけで使います。',
        'https://photos.example.com/treatments/before-side.jpg',
        'https://photos.example.com/treatments/before-side.jpg',
      ],
      [
        '2 枚目：施術後の写真（正面）お客様の同意あり。サロンの外にも見せられます。',
        'https://photos.example.com/treatments/after-front-small.jpg',
        'https://photos.example.com/treatments/after-front.jpg',
      ],
      [
        '3 枚目：そのほかの写真お客様の同意なし。サロンの中だけで使います。',
        'https://photos.example.com/treatments/scalp.jpg',
        'https://photos.example.com/treatments/scalp.jpg',
      ],
    ])
    expect(
      within(part())
        .getAllByRole('link', { name: /^\d+ 枚目の写真を開く$/ })
        .map((link) => link.textContent),
    ).toEqual(['写真を開く', '写真を開く', '写真を開く'])
    expect(
      within(part()).getByRole('link', { name: '写真を足す' }),
    ).toHaveAttribute(
      'href',
      `/salons/${salon.id}/treatments/${aTreatment().id}/photos/new`,
    )
  })

  it('should open the dialog for the photo whose button was pressed', async () => {
    // Arrange
    await stories.Photos.run()

    // Act
    await userEvent.click(
      within(part()).getByRole('button', { name: '2 枚目の写真を外す' }),
    )

    // Assert
    expect(stories.Photos.args.onOpen).toHaveBeenCalledExactlyOnceWith(
      photos[1],
    )
  })

  it('should say that a record has no photos, and lead to the screen that adds them', async () => {
    // Act
    await stories.NoPhotos.run()

    // Assert
    expect(part()).toHaveTextContent('施術写真はありません。')
    expect(
      within(part()).getByRole('link', { name: '写真を足す' }),
    ).toBeInTheDocument()
  })

  it('should add no more photos to a record that holds as many as it may, and say how to', async () => {
    // Act
    await stories.Full.run()

    // Assert
    expect(within(part()).getAllByRole('listitem')).toHaveLength(20)
    expect(
      within(part()).queryByRole('link', { name: '写真を足す' }),
    ).toBeNull()
    expect(part()).toHaveTextContent(
      '施術写真は、20 枚まで記録できます。足すときは、写真を外してから足してください。',
    )
  })

  it('should name the photo, say that it is not undone and that its file stays, and take it away when it is confirmed', async () => {
    // Arrange
    await stories.Asking.run()
    expect(dialog()).toHaveAccessibleName(
      '2 枚目：施術後の写真（正面）を外しますか？',
    )
    expect(dialog()).toHaveAccessibleDescription(
      '施術記録から写真を外します。外した写真は、元に戻せません。写真のファイルは、置いてある場所に残ります。',
    )

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '外す' }),
    )

    // Assert
    expect(stories.Asking.args.onRemove).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onClose).not.toHaveBeenCalled()
  })

  it('should take nothing away when the button that changes nothing is pressed', async () => {
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
    await stories.RemovalFailed.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '施術写真を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await stories.Removing.run()

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '外す' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('should say under the heading what changed meanwhile', async () => {
    // Act
    await stories.Gone.run()

    // Assert
    expect(within(part()).getByRole('status')).toHaveTextContent(
      'この写真は、その間に外されていました。',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
