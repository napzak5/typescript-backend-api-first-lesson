import {
  giveBack,
  salonIdOf,
  takeAway,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { staffMovedMeanwhile } from '../../customers/__tests__/arrangements'
import { attachmentHrefOf } from '../../navigation'
import {
  arrangeAwaitedFile,
  arrangeFile,
  arrangeFiles,
  fileRemovedMeanwhile,
} from '../__tests__/arrangements'
import {
  FILES_UNREAD,
  filesOfTokyo,
  LINKS_UNREAD,
  openFilesAs,
} from '../__tests__/screens'

/*
 * The files of a salon and a file, when a read fails, when there are more
 * than a page, and when the file or the account changes between two
 * requests of the screen. The failures are arranged in the database; what
 * goes well is in `attachments.integration.test.tsx`.
 */

/** The names of the files the table lists */
const namesListed = (): (string | undefined)[] =>
  rowsOf('ファイル').map(([name]) => name)

/** The record of the file, where it is opened and saved */
const fileRecord = (): HTMLElement =>
  screen.getByRole('region', { name: 'ファイル' })

describe('the files of a salon, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the files could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeFile({
      salonId: await salonIdOf(TOKYO),
      filename: '前.pdf',
      uploadedBy: OWNER,
    })
    await takeAway('attachments', 'filename')
    await openAs(await filesOfTokyo(), OWNER)
    expect(await screen.findByText(FILES_UNREAD)).toBeVisible()
    await giveBack('attachments', 'filename')

    // Act
    await readAgain(user)

    // Assert
    await screen.findByRole('table', { name: 'ファイル' })
    expect(namesListed()).toEqual(['前.pdf'])
  })

  it('should list the files that come next, twenty at a time', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeFiles(await salonIdOf(TOKYO), 21)
    await openFilesAs(OWNER)
    expect(namesListed()).toHaveLength(20)

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText('書類21.pdf')).toBeVisible()
    expect(namesListed()).toHaveLength(21)
    expect(screen.getByText('21 件')).toBeVisible()
  })

  it('should say that the files that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const ids = await arrangeFiles(await salonIdOf(TOKYO), 21)
    // The list is by the moment of the upload, which stays: the oldest file is on the second page
    const readable = await unreadable(
      'attachments',
      'uploadExpiresAt',
      `${ids[20]}`,
    )
    await openFilesAs(OWNER)
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(namesListed()).toHaveLength(20)
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await screen.findByText('書類21.pdf')).toBeVisible()
    expect(screen.queryByText(REST_UNREAD)).toBeNull()
  })

  it('should end the list where the account moved to another salon meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeFiles(await salonIdOf(TOKYO), 21)
    await openFilesAs(STYLIST)
    await staffMovedMeanwhile('Hiroshi Tanaka', OSAKA)

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(namesListed()).toHaveLength(20)
  })

  it('should say that a file could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const id = await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: OWNER,
    })
    const readable = await unreadable('attachments', 'uploadExpiresAt', id)
    await openAs(attachmentHrefOf(salonId, id), OWNER)
    expect(await screen.findByText(FILES_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await heading('前.pdf')
    expect(await screen.findByRole('link', { name: '保存する' })).toBeVisible()
  })

  it('should say that the addresses that open a file could not be read, and give them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const id = await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: OWNER,
    })
    whenAskedFor(`GET /attachments/${id}/download-url`, () =>
      takeAway('attachments', 'filename'),
    )
    await openAs(attachmentHrefOf(salonId, id), OWNER)
    expect(await screen.findByText(LINKS_UNREAD)).toBeVisible()
    expect(within(fileRecord()).getByText(LINKS_UNREAD)).toBeVisible()
    await giveBack('attachments', 'filename')

    // Act
    await readAgain(user, { inside: within(fileRecord()) })

    // Assert
    expect(
      await screen.findByRole('link', { name: '新しいタブで開く' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: '保存する' })).toBeVisible()
  })

  it('should say that a file removed as the addresses that open it were read is not found', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const id = await arrangeFile({
      salonId,
      filename: '前.pdf',
      uploadedBy: OWNER,
    })
    whenAskedFor(`GET /attachments/${id}/download-url`, () =>
      fileRemovedMeanwhile(id),
    )

    // Act
    await openAs(attachmentHrefOf(salonId, id), OWNER)

    // Assert
    expect(await heading('ファイルが見つかりません')).toBeVisible()
  })

  it('should say that a file whose upload is awaited is not found, as the list does not have it', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const id = await arrangeAwaitedFile({
      salonId,
      filename: '途中.pdf',
      uploadedBy: OWNER,
    })

    // Act
    await openAs(attachmentHrefOf(salonId, id), OWNER)

    // Assert
    expect(await heading('ファイルが見つかりません')).toBeVisible()
  })
})
