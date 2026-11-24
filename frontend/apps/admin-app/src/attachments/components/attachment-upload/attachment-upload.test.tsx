import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('AttachmentUpload on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say in English what files it takes and who sees them', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByRole('heading', { name: 'Upload a file' })).toBeVisible()
    expect(screen.getByLabelText('File')).toHaveAccessibleDescription(
      'An image in JPEG, PNG or WebP, or a PDF file, one at a time, up to 10 MB. Every member of the staff of this salon can see the files uploaded.',
    )
    expect(screen.getByRole('button', { name: 'Upload' })).toBeVisible()
  })

  it('should say in English what is wrong with the file at its control', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithError.run()

    // Assert
    expect(screen.getByLabelText('File')).toHaveAccessibleDescription(
      expect.stringContaining(
        'Choose an image in JPEG, PNG or WebP, or a PDF file.',
      ),
    )
  })

  it('should say in English that the file could not be sent', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NotSent.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not send the file. Check your connection and upload it again.',
    )
  })
})
