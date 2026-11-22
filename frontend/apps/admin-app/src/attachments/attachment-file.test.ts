import type { ModelsAttachmentContentType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_FILES,
  afterRemoving,
  afterUploading,
  contentTypeNameOf,
  FILE,
  isImage,
  readChosenFile,
  removesAttachment,
  sizeNameOf,
  uploaderNameOf,
} from './attachment-file'
import type { AttachmentRemoval, Uploading } from './attachments-api'
import { ACCOUNT_ID, LEDGER, MISAKI_ACCOUNT_ID } from './components/examples'

const MEGABYTES_10 = 10 * 1024 * 1024

/** A file of a name and a size */
const fileOf = (name: string, size = 16): File =>
  new File([new Uint8Array(size)], name)

describe('readChosenFile', () => {
  it.each<[string, string, string]>([
    ['a JPEG image', 'before.jpg', 'image/jpeg'],
    ['a JPEG image of the longer ending', 'before.jpeg', 'image/jpeg'],
    ['an ending in capitals', 'BEFORE.JPG', 'image/jpeg'],
    ['a PNG image', 'logo.png', 'image/png'],
    ['a WebP image', 'after.webp', 'image/webp'],
    ['a PDF', '同意書.pdf', 'application/pdf'],
    ['a name of more than one dot', 'consent.2026.11.pdf', 'application/pdf'],
  ])('should take %s, of the kind its ending says', (_, name, contentType) => {
    // Arrange
    const file = fileOf(name)

    // Act
    const read = readChosenFile(file)

    // Assert
    expect(read).toEqual({ type: 'valid', file, contentType })
  })

  it.each<[string, File | undefined, string]>([
    ['no file', undefined, 'アップロードするファイルを選んでください。'],
    [
      'a kind the API does not take',
      fileOf('notes.txt'),
      'JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。',
    ],
    [
      'an ending that is not the last',
      fileOf('photo.png.html'),
      'JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。',
    ],
    [
      'a name that is its ending alone',
      fileOf('.png'),
      'JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。',
    ],
    [
      'an empty file',
      fileOf('empty.pdf', 0),
      '中身のないファイルです。ほかのファイルを選んでください。',
    ],
    [
      'a file of more than 10 MB',
      fileOf('scan.pdf', MEGABYTES_10 + 1),
      'ファイルが大きすぎます（10.0 MB）。10 MB までのファイルを選んでください。',
    ],
    [
      'a name of more than 255 characters',
      fileOf(`${'a'.repeat(252)}.pdf`),
      'ファイル名が長すぎます。255 文字までの名前にしてから、選んでください。',
    ],
    [
      'a name with a control character',
      fileOf('before\u0007.jpg'),
      'ファイル名に、使えない文字が入っています。名前を変えてから、選んでください。',
    ],
    [
      'a name with the character of deletion',
      fileOf('before\u007f.jpg'),
      'ファイル名に、使えない文字が入っています。名前を変えてから、選んでください。',
    ],
    [
      'a name with the last control character',
      fileOf('before\u009f.jpg'),
      'ファイル名に、使えない文字が入っています。名前を変えてから、選んでください。',
    ],
    [
      'a name with a slash',
      fileOf('a/before.jpg'),
      'ファイル名に、使えない文字が入っています。名前を変えてから、選んでください。',
    ],
    [
      'a name with a back slash',
      fileOf('a\\before.jpg'),
      'ファイル名に、使えない文字が入っています。名前を変えてから、選んでください。',
    ],
  ])('should refuse %s at the control', (_, file, message) => {
    // Act
    const read = readChosenFile(file)

    // Assert
    expect(read).toEqual({ type: 'invalid', errors: { [FILE]: message } })
  })

  it.each<[string, File]>([
    ['a file of 10 MB', fileOf('scan.pdf', MEGABYTES_10)],
    ['a file of one byte', fileOf('scan.pdf', 1)],
    ['a name of 255 characters', fileOf(`${'a'.repeat(251)}.pdf`)],
    [
      'a name of 255 characters outside the basic plane',
      fileOf(`${'𠮷'.repeat(251)}.pdf`),
    ],
    [
      'a name with the first character after the controls',
      fileOf('before\u00a0.jpg'),
    ],
  ])('should take %s, the limit of the API', (_, file) => {
    expect(readChosenFile(file)).toMatchObject({ type: 'valid' })
  })
})

describe('ACCEPTED_FILES', () => {
  it('should offer the endings and the types of the four kinds', () => {
    expect(ACCEPTED_FILES).toBe(
      '.jpg,.jpeg,image/jpeg,.png,image/png,.webp,image/webp,.pdf,application/pdf',
    )
  })
})

describe('contentTypeNameOf and isImage', () => {
  it('should name each kind, and tell the images from a PDF', () => {
    const kinds: ModelsAttachmentContentType[] = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]

    expect(
      kinds.map((type) => [contentTypeNameOf(type), isImage(type)]),
    ).toEqual([
      ['JPEG 画像', true],
      ['PNG 画像', true],
      ['WebP 画像', true],
      ['PDF', false],
    ])
  })
})

describe('sizeNameOf', () => {
  it.each<[number, string]>([
    [1, '1 バイト'],
    [1023, '1023 バイト'],
    [1024, '1 KB'],
    [348_160, '340 KB'],
    [1_048_575, '1024 KB'],
    [1_048_576, '1.0 MB'],
    [1_258_291, '1.2 MB'],
    [MEGABYTES_10, '10.0 MB'],
  ])('should name %i bytes 「%s」', (size, name) => {
    expect(sizeNameOf(size)).toBe(name)
  })
})

describe('afterUploading', () => {
  it.each<
    [
      Exclude<Uploading, { type: 'uploaded' }>,
      string | undefined,
      string | undefined,
    ]
  >([
    [
      { type: 'invalid', values: [{ field: 'salonId', rule: 'not_found' }] },
      undefined,
      'このファイルは、アップロードできませんでした。ファイルの種類、大きさ、名前を確かめてください。',
    ],
    [
      { type: 'unreadable' },
      undefined,
      'ファイルを読めませんでした。選んだあとで、ファイルが移されたか、変えられたのかもしれません。もう一度選んでください。',
    ],
    [
      { type: 'notAsDeclared' },
      undefined,
      'ファイルの中身が、名前の拡張子の種類と合いませんでした。中身と拡張子の合うファイルを選んでください。',
    ],
    [
      { type: 'notSent' },
      'ファイルを送れませんでした。通信の状態を確かめて、もう一度アップロードしてください。',
      undefined,
    ],
    [
      { type: 'forbidden' },
      'このアカウントでは、このサロンにファイルを置けません。置けるのは、このサロンのスタッフと、管理者です。',
      undefined,
    ],
    [
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      undefined,
    ],
    [
      { type: 'failed' },
      'ファイルをアップロードできませんでした。通信の状態を確かめて、もう一度お試しください。',
      undefined,
    ],
  ])(
    'should say what became of %o, above the form or at the control',
    (outcome, message, error) => {
      // Act
      const said = afterUploading(outcome)

      // Assert
      expect(said.message).toBe(message)
      expect(said.errors[FILE]).toBe(error)
    },
  )
})

describe('removesAttachment', () => {
  it.each<[string, string, string, boolean]>([
    ['the owner', 'owner', MISAKI_ACCOUNT_ID, true],
    ['a manager', 'manager', MISAKI_ACCOUNT_ID, true],
    ['an administrator', 'admin', MISAKI_ACCOUNT_ID, true],
    ['a stylist, a file of their own', 'staff', ACCOUNT_ID, true],
    ['a stylist, a file of somebody else', 'staff', MISAKI_ACCOUNT_ID, false],
  ])(
    'should tell whether %s removes the file',
    (_, role, uploadedBy, removes) => {
      expect(removesAttachment({ id: ACCOUNT_ID, role }, { uploadedBy })).toBe(
        removes,
      )
    },
  )
})

describe('afterRemoving', () => {
  it.each<
    [Exclude<AttachmentRemoval, { type: 'removed' | 'notFound' }>, string]
  >([
    [
      { type: 'forbidden' },
      'このファイルを削除できるのは、アップロードした人と、サロンのオーナー、マネージャー、管理者です。',
    ],
    [
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'ファイルを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say in the dialog what became of %o', (outcome, message) => {
    expect(afterRemoving(outcome)).toBe(message)
  })
})

describe('uploaderNameOf', () => {
  it.each<
    [
      string,
      string,
      readonly { userId: string | null; displayName: string }[],
      string,
    ]
  >([
    ['the account itself', ACCOUNT_ID, LEDGER, 'あなた'],
    ['a member of the ledger', MISAKI_ACCOUNT_ID, LEDGER, '佐藤 美咲'],
    [
      'an account the ledger does not have',
      'another',
      LEDGER,
      'ほかのアカウント',
    ],
    [
      'a member, when the ledger is not read',
      MISAKI_ACCOUNT_ID,
      [],
      'ほかのアカウント',
    ],
  ])('should name %s', (_, uploadedBy, ledger, name) => {
    expect(uploaderNameOf(uploadedBy, ACCOUNT_ID, ledger)).toBe(name)
  })
})
