import { describe, expect, it } from 'vitest'
import { fileSizeOf } from '../../formats/numbers'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminAttachmentMessages } from './index'

const { record, removal, upload } = adminAttachmentMessages

const FILE = 'カラー同意書_田中様.pdf'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminAttachmentMessages.upload.done',
    upload.done(FILE),
    {
      en: 'Uploaded “カラー同意書_田中様.pdf”.',
      ja: '「カラー同意書_田中様.pdf」をアップロードしました。',
    },
  ],
  [
    'adminAttachmentMessages.upload.errors.tooLarge',
    upload.errors.tooLarge(fileSizeOf(12 * 1024 * 1024)),
    {
      en: 'The file is too large (12.0 MB). Choose a file of up to 10 MB.',
      ja: 'ファイルが大きすぎます（12.0 MB）。10 MB までのファイルを選んでください。',
    },
  ],
  [
    'adminAttachmentMessages.upload.errors.nameTooLong',
    upload.errors.nameTooLong({ en: '255 characters', ja: '255 文字' }),
    {
      en: 'The file name is too long. Rename the file to up to 255 characters, then choose it.',
      ja: 'ファイル名が長すぎます。255 文字までの名前にしてから、選んでください。',
    },
  ],
  [
    'adminAttachmentMessages.record.sizeOf',
    record.sizeOf(
      { en: '1.2 MB', ja: '1.2 MB' },
      { en: '1,258,291 bytes', ja: '1,258,291 バイト' },
    ),
    {
      en: '1.2 MB (1,258,291 bytes)',
      ja: '1.2 MB（1,258,291 バイト）',
    },
  ],
  [
    'adminAttachmentMessages.removal.description',
    removal.description(FILE),
    {
      en: 'Deletes “カラー同意書_田中様.pdf” from the files of the salon. A deleted file cannot be restored. The share links of this file stop working too.',
      ja: '「カラー同意書_田中様.pdf」を、サロンのファイルから削除します。削除したファイルは元に戻せません。このファイルの共有リンクも、使えなくなります。',
    },
  ],
  [
    'adminAttachmentMessages.removal.done',
    removal.done(FILE),
    {
      en: 'Deleted “カラー同意書_田中様.pdf”.',
      ja: '「カラー同意書_田中様.pdf」を削除しました。',
    },
  ],
]

describe('the messages of the files of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminAttachmentMessages }, '').made.toSorted(),
    )
  })
})
