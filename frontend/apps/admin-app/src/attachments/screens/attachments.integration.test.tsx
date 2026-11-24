import { languageStore } from '@beauty-salon-frontend/io'
import {
  findAccessibilityViolations,
  PDF_BYTES,
  PNG_BYTES,
} from '@beauty-salon-frontend/testing'
import { refuse, salonIdOf } from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  THERAPIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import {
  attachmentHrefOf,
  attachmentsHrefOf,
  reviewsHrefOf,
} from '../../navigation'
import {
  arrangeFile,
  fileRemovedMeanwhile,
  storedFilesOf,
} from '../__tests__/arrangements'

/*
 * The files of a salon against the API and the object storage of the test
 * server: the list, an upload through a signed URL, a file with the links
 * that open and save it, and its removal. The seed data has no file; the
 * files a test needs are in `__tests__/arrangements.ts`.
 */

/** The files of the salon in Tokyo */
const filesOfTokyo = async (): Promise<string> =>
  attachmentsHrefOf(await salonIdOf(TOKYO))

/** Opens the files of the salon in Tokyo, and waits until they are read. */
const openFilesAs = async (email: string): Promise<void> => {
  await openAs(await filesOfTokyo(), email)
  await heading('ファイル')
  await waitFor(() =>
    expect(screen.queryByText('ファイルを読み込んでいます')).toBeNull(),
  )
}

/** Opens a file of the salon in Tokyo, and waits for the links that open it. */
const openFileAs = async (id: string, email: string): Promise<void> => {
  await openAs(attachmentHrefOf(await salonIdOf(TOKYO), id), email)
  await screen.findByRole('link', { name: '保存する' })
}

const fileControl = (): HTMLElement =>
  screen.getByLabelText('ファイル', { selector: 'input' })

const UPLOAD = 'アップロードする'

/** Each term of the record of the file with its description */
const detailsOf = (): string[][] => {
  const record = screen.getByRole('region', { name: 'ファイル' })
  const descriptions = within(record).getAllByRole('definition')

  return within(record)
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

const MOMENT = /^\d{4}年\d+月\d+日（.） \d{2}:\d{2}$/

describe('the files of a salon', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead a manager to the files, upload an image to the storage, list it and open it where the storage answers with it', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(reviewsHrefOf(salonId), MANAGER)
    await heading('レビュー')

    // Act
    await user.click(screen.getByRole('link', { name: 'ファイル' }))

    // Assert
    await heading('ファイル')
    expect(await screen.findByText('ファイルはありません')).toBeVisible()

    // Act
    await user.upload(
      fileControl(),
      new File([PNG_BYTES], '施術前.png', { type: 'image/png' }),
    )
    await user.click(screen.getByRole('button', { name: UPLOAD }))

    // Assert
    expect(
      await screen.findByText('「施術前.png」をアップロードしました。'),
    ).toBeVisible()
    await screen.findByRole('table', { name: 'ファイル' })
    expect(rowsOf('ファイル')).toEqual([
      [
        '施術前.png',
        'PNG 画像',
        '24 バイト',
        'あなた',
        expect.stringMatching(MOMENT),
      ],
    ])
    expect(await storedFilesOf(salonId)).toEqual([
      {
        filename: '施術前.png',
        contentType: 'image/png',
        size: 24,
        status: 'uploaded',
        uploadedBy: MANAGER,
        removed: false,
      },
    ])
    // The form is empty for the next file, and its heading has the focus
    expect(
      screen.getByRole('heading', { name: 'ファイルをアップロードする' }),
    ).toHaveFocus()
    expect(fileControl()).toHaveProperty('files.length', 0)

    // Act
    await user.click(screen.getByRole('link', { name: '施術前.png' }))

    // Assert
    await heading('施術前.png')
    const save = await screen.findByRole('link', { name: '保存する' })
    const open = screen.getByRole('link', { name: '新しいタブで開く' })
    expect(screen.getByRole('img', { name: '施術前.png' })).toHaveAttribute(
      'src',
      open.getAttribute('href'),
    )
    expect(detailsOf()).toEqual([
      ['ファイル名', '施術前.png'],
      ['種類', 'PNG 画像'],
      ['サイズ', '24 バイト（24 バイト）'],
      ['アップロードした人', 'あなた'],
      ['アップロード日時', expect.stringMatching(MOMENT)],
    ])
    const saved = await fetch(save.getAttribute('href') ?? '')
    expect(saved.status).toBe(200)
    expect(new Uint8Array(await saved.arrayBuffer())).toEqual(PNG_BYTES)
    expect(saved.headers.get('content-type')).toBe('image/png')
    expect(saved.headers.get('content-disposition')).toMatch(/^attachment;/)
    const opened = await fetch(open.getAttribute('href') ?? '')
    expect(opened.headers.get('content-disposition')).toMatch(/^inline/)
  })

  it('should upload a PDF, and show it without an image', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openFilesAs(STYLIST)

    // Act
    await user.upload(
      fileControl(),
      new File([PDF_BYTES], 'カラー同意書.pdf', { type: 'application/pdf' }),
    )
    await user.click(screen.getByRole('button', { name: UPLOAD }))
    await user.click(
      await screen.findByRole('link', { name: 'カラー同意書.pdf' }),
    )

    // Assert
    await heading('カラー同意書.pdf')
    await screen.findByRole('link', { name: '保存する' })
    expect(screen.queryByRole('img')).toBeNull()
    expect(await storedFilesOf(salonId)).toMatchObject([
      {
        filename: 'カラー同意書.pdf',
        size: PDF_BYTES.length,
        status: 'uploaded',
      },
    ])
  })

  it.each<[string, File | undefined, string]>([
    ['no file', undefined, 'アップロードするファイルを選んでください。'],
    [
      'a kind the API does not take',
      new File(['memo'], 'memo.txt', { type: 'text/plain' }),
      'JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。',
    ],
    [
      'an empty file',
      new File([], 'empty.pdf', { type: 'application/pdf' }),
      '中身のないファイルです。ほかのファイルを選んでください。',
    ],
    [
      'a file of more than 10 MB',
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'scan.pdf', {
        type: 'application/pdf',
      }),
      'ファイルが大きすぎます（10.0 MB）。10 MB までのファイルを選んでください。',
    ],
  ])(
    'should send nothing for %s, and say so at the control',
    async (_, file, error) => {
      // Arrange
      // As a person who asks the dialog of the browser for every file
      const user = userEvent.setup({ applyAccept: false })
      await openFilesAs(OWNER)
      if (file !== undefined) {
        await user.upload(fileControl(), file)
      }

      // Act
      await user.click(screen.getByRole('button', { name: UPLOAD }))

      // Assert
      await waitFor(() =>
        expect(fileControl()).toHaveAccessibleDescription(
          expect.stringContaining(error),
        ),
      )
      expect(fileControl()).toHaveAttribute('aria-invalid', 'true')
      expect(await storedFilesOf(await salonIdOf(TOKYO))).toEqual([])
    },
  )

  it('should say at the control that a file is not what the ending of its name says, which the API takes back', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openFilesAs(OWNER)
    await user.upload(
      fileControl(),
      new File([PNG_BYTES], '同意書.pdf', { type: 'application/pdf' }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: UPLOAD }))

    // Assert
    await waitFor(() =>
      expect(fileControl()).toHaveAccessibleDescription(
        expect.stringContaining(
          'ファイルの中身が、名前の拡張子の種類と合いませんでした。中身と拡張子の合うファイルを選んでください。',
        ),
      ),
    )
    expect(await storedFilesOf(salonId)).toMatchObject([
      { filename: '同意書.pdf', removed: true },
    ])
    expect(screen.getByText('ファイルはありません')).toBeVisible()
  })

  it('should say that a file could not be uploaded when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    await openFilesAs(OWNER)
    await refuse('insert', 'attachments')
    await user.upload(
      fileControl(),
      new File([PNG_BYTES], 'logo.png', { type: 'image/png' }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: UPLOAD }))

    // Assert
    expect(
      await screen.findByText(
        'ファイルをアップロードできませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    expect(fileControl()).toHaveProperty('files.length', 1)
  })

  it('should list the files the latest first, and name to the owner who uploaded each by the staff ledger', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: STYLIST,
      minutesAgo: 30,
    })
    await arrangeFile({
      salonId,
      filename: '後.pdf',
      uploadedBy: MANAGER,
      minutesAgo: 20,
    })
    await arrangeFile({
      salonId,
      filename: 'logo.pdf',
      uploadedBy: OPERATOR,
      minutesAgo: 10,
    })
    await arrangeFile({
      salonId: await salonIdOf(OSAKA),
      filename: '大阪.pdf',
      uploadedBy: THERAPIST,
    })

    // Act
    await openFilesAs(OWNER)

    // Assert
    await waitFor(() =>
      expect(
        rowsOf('ファイル').map(([name, , , uploader]) => [name, uploader]),
      ).toEqual([
        ['logo.pdf', 'ほかのアカウント'],
        ['後.pdf', 'Kenji Sato'],
        ['前.pdf', 'Hiroshi Tanaka'],
      ]),
    )
    expect(screen.getByText('3 件')).toBeVisible()
  })

  it('should name only the account itself to a member who does not keep the staff ledger', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: STYLIST,
      minutesAgo: 30,
    })
    await arrangeFile({
      salonId,
      filename: '後.pdf',
      uploadedBy: OWNER,
      minutesAgo: 20,
    })

    // Act
    await openFilesAs(STYLIST)

    // Assert
    expect(
      rowsOf('ファイル').map(([name, , , uploader]) => [name, uploader]),
    ).toEqual([
      ['後.pdf', 'ほかのアカウント'],
      ['前.pdf', 'あなた'],
    ])
  })

  it('should let a stylist remove a file they uploaded, and read the list anew', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await arrangeFile({
      salonId,
      filename: '後.pdf',
      uploadedBy: OWNER,
      minutesAgo: 20,
    })
    await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: STYLIST,
      minutesAgo: 10,
    })
    await openFilesAs(STYLIST)
    await user.click(screen.getByRole('link', { name: '前.pdf' }))
    await screen.findByRole('link', { name: '保存する' })

    // Act
    await user.click(screen.getByRole('button', { name: 'ファイルを削除する' }))
    const dialog = screen.getByRole('dialog', {
      name: 'ファイルを削除しますか？',
    })
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await screen.findByText('「前.pdf」を削除しました。')).toBeVisible()
    await heading('ファイル')
    // The list that was read before is not shown, but read anew: the
    // notice names the file, and no row does
    expect(firstSight()[1]).toContain('ファイルを読み込んでいます')
    expect(firstSight()[1]).not.toContain('前.pdfPDF')
    await waitFor(() =>
      expect(rowsOf('ファイル').map(([name]) => name)).toEqual(['後.pdf']),
    )
    expect(await storedFilesOf(salonId)).toMatchObject([
      { filename: '後.pdf', removed: false },
      { filename: '前.pdf', removed: true },
    ])
  })

  it('should not offer a stylist the removal of a file of another, and say who removes it', async () => {
    // Arrange
    const id = await arrangeFile({
      salonId: await salonIdOf(TOKYO),
      filename: '後.pdf',
      uploadedBy: MANAGER,
    })

    // Act
    await openFileAs(id, STYLIST)

    // Assert
    expect(
      screen.queryByRole('button', { name: 'ファイルを削除する' }),
    ).toBeNull()
    expect(
      screen.getByText(
        'このファイルを削除できるのは、アップロードした人と、サロンのオーナー、マネージャー、管理者です。',
      ),
    ).toBeVisible()
  })

  it.each<[string, string]>([
    ['the owner', OWNER],
    ['a manager', MANAGER],
    ['an administrator', OPERATOR],
  ])('should let %s remove a file a stylist uploaded', async (_, email) => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const id = await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: STYLIST,
    })
    await openFileAs(id, email)

    // Act
    await user.click(screen.getByRole('button', { name: 'ファイルを削除する' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '削除する',
      }),
    )

    // Assert
    expect(await screen.findByText('「前.pdf」を削除しました。')).toBeVisible()
    expect(await storedFilesOf(salonId)).toMatchObject([{ removed: true }])
  })

  it('should say that a file removed meanwhile is gone, when it is to be removed', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrangeFile({
      salonId: await salonIdOf(TOKYO),
      filename: '前.pdf',
      uploadedBy: OWNER,
    })
    await openFileAs(id, OWNER)
    await fileRemovedMeanwhile(id)

    // Act
    await user.click(screen.getByRole('button', { name: 'ファイルを削除する' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '削除する',
      }),
    )

    // Assert
    expect(await heading('ファイルが見つかりません')).toBeVisible()
  })

  it('should say in the dialog that a file could not be removed when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrangeFile({
      salonId: await salonIdOf(TOKYO),
      filename: '前.pdf',
      uploadedBy: OWNER,
    })
    await openFileAs(id, OWNER)
    await refuse('update', 'attachments')

    // Act
    await user.click(screen.getByRole('button', { name: 'ファイルを削除する' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await within(dialog).findByText(
        'ファイルを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
  })

  it('should tell a member of another salon that its files are not theirs to see, without the form', async () => {
    // Act
    await openAs(await filesOfTokyo(), THERAPIST)

    // Assert
    expect(
      await screen.findByText(
        'このサロンのファイルは、見られません。ファイルを見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeVisible()
    expect(
      screen.queryByLabelText('ファイル', { selector: 'input' }),
    ).toBeNull()
  })

  it.each<[string, () => Promise<string>, string]>([
    [
      'a file that is none',
      async () =>
        attachmentHrefOf(
          await salonIdOf(TOKYO),
          '00000000-0000-4000-8000-000000000000',
        ),
      OPERATOR,
    ],
    [
      'a file of the salon at the address of another, to an administrator',
      async () =>
        attachmentHrefOf(
          await salonIdOf(OSAKA),
          await arrangeFile({
            salonId: await salonIdOf(TOKYO),
            filename: '前.pdf',
            uploadedBy: OWNER,
          }),
        ),
      OPERATOR,
    ],
    [
      'a file of another salon, to a member of it',
      async () =>
        attachmentHrefOf(
          await salonIdOf(OSAKA),
          await arrangeFile({
            salonId: await salonIdOf(OSAKA),
            filename: '大阪.pdf',
            uploadedBy: THERAPIST,
          }),
        ),
      STYLIST,
    ],
    [
      'a file that was removed',
      async () => {
        const salonId = await salonIdOf(TOKYO)
        const id = await arrangeFile({
          salonId,
          filename: '前.pdf',
          uploadedBy: OWNER,
        })
        await fileRemovedMeanwhile(id)

        return attachmentHrefOf(salonId, id)
      },
      OWNER,
    ],
  ])('should say that %s is not found', async (_, addressOf, email) => {
    // Arrange
    await openAs(await addressOf(), email)

    // Assert
    expect(await heading('ファイルが見つかりません')).toBeVisible()
  })

  it.each<[string, () => Promise<string>, () => Promise<unknown>]>([
    [
      'the files',
      async () => {
        await arrangeFile({
          salonId: await salonIdOf(TOKYO),
          filename: '前.pdf',
          uploadedBy: OWNER,
        })
        return filesOfTokyo()
      },
      () => screen.findByRole('table', { name: 'ファイル' }),
    ],
    [
      'a file with its dialog closed',
      async () =>
        attachmentHrefOf(
          await salonIdOf(TOKYO),
          await arrangeFile({
            salonId: await salonIdOf(TOKYO),
            filename: '前.png',
            contentType: 'image/png',
            uploadedBy: OWNER,
          }),
        ),
      () => screen.findByRole('link', { name: '保存する' }),
    ],
  ])('should show %s accessibly', async (_, pathOf, opened) => {
    // Arrange
    await openAs(await pathOf(), OWNER)
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})

describe('the files of a salon on a page in English', () => {
  /** A moment as a page in English writes it */
  const MOMENT_IN_ENGLISH =
    /^[A-Z][a-z]{2}, [A-Z][a-z]+ \d+, \d{4} at \d{2}:\d{2}$/

  const englishFileControl = (): HTMLElement =>
    screen.getByLabelText('File', { selector: 'input' })

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should upload an image and list it, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(await filesOfTokyo(), MANAGER, 'en')
    await heading('Files')
    expect(await screen.findByText('No files')).toBeVisible()
    await user.upload(
      englishFileControl(),
      new File([PNG_BYTES], '施術前.png', { type: 'image/png' }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    // Assert
    expect(await screen.findByText('Uploaded “施術前.png”.')).toBeVisible()
    await screen.findByRole('table', { name: 'Files' })
    expect(rowsOf('Files')).toEqual([
      [
        '施術前.png',
        'PNG image',
        '24 bytes',
        'You',
        expect.stringMatching(MOMENT_IN_ENGLISH),
      ],
    ])
  })

  it('should say in English at the control that a file is not what the ending of its name says', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(await filesOfTokyo(), OWNER, 'en')
    await heading('Files')
    await user.upload(
      await waitFor(englishFileControl),
      new File([PNG_BYTES], '同意書.pdf', { type: 'application/pdf' }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    // Assert
    await waitFor(() =>
      expect(englishFileControl()).toHaveAccessibleDescription(
        expect.stringContaining(
          'The content of the file does not match the type of its extension.',
        ),
      ),
    )
  })

  it('should show a file and remove it after the dialog asks, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const id = await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: STYLIST,
    })
    await openAs(attachmentHrefOf(salonId, id), STYLIST, 'en')
    await screen.findByRole('link', { name: 'Save' })
    expect(
      within(screen.getByRole('region', { name: 'File' }))
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['File name', 'Type', 'Size', 'Uploaded by', 'Uploaded'])

    // Act
    await user.click(screen.getByRole('button', { name: 'Delete the file' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete the file?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    // Assert
    expect(await screen.findByText('Deleted “前.pdf”.')).toBeVisible()
    await heading('Files')
    expect(await storedFilesOf(salonId)).toMatchObject([
      { filename: '前.pdf', removed: true },
    ])
  })

  it('should tell a member of another salon in English that its files are not theirs to see', async () => {
    // Act
    await openAs(await filesOfTokyo(), THERAPIST, 'en')

    // Assert
    expect(
      await screen.findByText(
        /^You cannot see the files of this salon\. Only .+ can\.$/,
      ),
    ).toBeVisible()
    expect(screen.queryByLabelText('File', { selector: 'input' })).toBeNull()
  })

  it('should say in English that a file at the address is none', async () => {
    // Act
    await openAs(
      attachmentHrefOf(
        await salonIdOf(TOKYO),
        '00000000-0000-4000-8000-000000000000',
      ),
      OPERATOR,
      'en',
    )

    // Assert
    expect(await heading('File not found')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Back to the files' }),
    ).toBeVisible()
  })
})
