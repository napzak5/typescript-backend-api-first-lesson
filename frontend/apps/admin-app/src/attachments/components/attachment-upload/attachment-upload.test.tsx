import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as attachmentUploadStories from './attachment-upload.stories'

const stories = composeStories(attachmentUploadStories)

describe('AttachmentUpload', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer the kinds of file the API takes, and say what they are and who sees them', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    const control = screen.getByLabelText('ファイル')
    expect(control).toHaveAttribute('type', 'file')
    expect(control).toHaveAttribute(
      'accept',
      '.jpg,.jpeg,image/jpeg,.png,image/png,.webp,image/webp,.pdf,application/pdf',
    )
    expect(control).toBeRequired()
    expect(control).toHaveAccessibleDescription(
      'JPEG、PNG、WebP の画像か、PDF のファイルを、1 つずつ。10 MB まで。アップロードしたファイルは、このサロンのスタッフのだれもが見られます。',
    )
  })

  it('should tell the file that is chosen, and that the form is sent', async () => {
    // Arrange
    await stories.Empty.run()
    const { onChoose, onSubmit } = stories.Empty.args
    const file = new File(['%PDF-1.7'], '同意書.pdf', {
      type: 'application/pdf',
    })

    // Act
    await userEvent.upload(screen.getByLabelText('ファイル'), file)
    await userEvent.click(
      screen.getByRole('button', { name: 'アップロードする' }),
    )

    // Assert
    expect(
      vi.mocked(onChoose ?? (() => undefined)),
    ).toHaveBeenCalledExactlyOnceWith(file)
    expect(vi.mocked(onSubmit ?? (() => undefined))).toHaveBeenCalledOnce()
  })

  it('should say what is wrong with the file at its control', async () => {
    // Act
    await stories.WithError.run()

    // Assert
    expect(screen.getByLabelText('ファイル')).toHaveAccessibleDescription(
      /JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。/,
    )
  })

  it('should say above the control that the file could not be sent', async () => {
    // Act
    await stories.NotSent.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'ファイルを送れませんでした。',
    )
  })
})
