import { unreadable } from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import { OWNER } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { fileRemovedMeanwhile } from '../../attachments/__tests__/arrangements'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import { shareLinkEntryHrefOf, shareLinkHrefOf } from '../../navigation'
import { arrangeShareLink, arrangeShareLinks } from '../__tests__/arrangements'
import {
  consentOfTokyo,
  type FileOfSalon,
  linksPart,
  openFileAs,
} from '../__tests__/screens'

/*
 * The share links of a file, when a read fails, and when the file or the
 * role of the account changed meanwhile. The failures are arranged in the
 * database; what goes well is in `share-links.integration.test.tsx`.
 */

const LINKS = '発行した共有リンク'

const LINKS_UNREAD =
  '共有リンクを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** Opens the links of a file of 21 links, and waits for the first twenty. */
const openFileOfManyLinks = async (): Promise<FileOfSalon> => {
  const file = await consentOfTokyo()
  await arrangeShareLinks(file.attachmentId, OWNER, 21)
  await openFileAs(file, OWNER)
  expect(rowsOf(LINKS)).toHaveLength(20)

  return file
}

/** The button below the links that reads those that come next */
const moreButton = (): HTMLElement =>
  within(linksPart()).getByRole('button', { name: 'さらに表示' })

describe('the share links of a file, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the links of a file could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const file = await consentOfTokyo()
    const readable = await unreadable(
      'share_links',
      'updatedAt',
      await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
      }),
    )
    await openFileAs(file, OWNER)
    expect(within(linksPart()).getByText(LINKS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user, { inside: within(linksPart()) })

    // Assert
    await waitFor(() => expect(rowsOf(LINKS)).toHaveLength(1))
  })

  it('should say that the links that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const file = await consentOfTokyo()
    const readable = await unreadable(
      'share_links',
      'updatedAt',
      await arrangeShareLinks(file.attachmentId, OWNER, 21),
    )
    await openFileAs(file, OWNER)
    await user.click(moreButton())
    expect(await within(linksPart()).findByText(REST_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user, { inside: within(linksPart()) })

    // Assert
    await waitFor(() => expect(rowsOf(LINKS)).toHaveLength(21))
  })

  it.each<[string, (file: FileOfSalon) => Promise<unknown>]>([
    [
      'the file was removed',
      ({ attachmentId }) => fileRemovedMeanwhile(attachmentId),
    ],
    ['the account shares files no more', () => madeStaffMeanwhile(OWNER)],
  ])(
    'should keep the links read, and say that those that come next could not be read, when %s meanwhile',
    async (_, change) => {
      // Arrange
      const user = userEvent.setup()
      const file = await openFileOfManyLinks()
      await change(file)

      // Act
      await user.click(moreButton())

      // Assert
      expect(await within(linksPart()).findByText(REST_UNREAD)).toBeVisible()
      expect(rowsOf(LINKS)).toHaveLength(20)
    },
  )

  it('should say at the form that the file could not be read, and offer the form when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const file = await consentOfTokyo()
    const readable = await unreadable(
      'attachments',
      'uploadExpiresAt',
      file.attachmentId,
    )
    await openAs(shareLinkEntryHrefOf(file.salonId, file.attachmentId), OWNER)
    expect(
      await screen.findByText(
        'ファイルを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(
      await screen.findByRole('combobox', { name: '有効期間' }),
    ).toBeVisible()
  })

  it.each<
    [string, string, string, (file: FileOfSalon, shareLinkId: string) => string]
  >([
    [
      'its file',
      'attachments',
      'uploadExpiresAt',
      ({ attachmentId }) => attachmentId,
    ],
    ['the link', 'share_links', 'updatedAt', (_, shareLinkId) => shareLinkId],
  ])(
    'should say at a link that it could not be read when %s could not be, and show it when asked again',
    async (_, table, column, idOf) => {
      // Arrange
      const user = userEvent.setup()
      const file = await consentOfTokyo()
      const shareLinkId = await arrangeShareLink({
        attachmentId: file.attachmentId,
        issuedBy: OWNER,
      })
      const readable = await unreadable(table, column, idOf(file, shareLinkId))
      await openAs(
        shareLinkHrefOf(file.salonId, file.attachmentId, shareLinkId),
        OWNER,
      )
      expect(await screen.findByText(LINKS_UNREAD)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('button', { name: '共有リンクを取り消す' }),
      ).toBeVisible()
    },
  )

  it('should say at a link of a file removed since that the file is not found', async () => {
    // Arrange
    const file = await consentOfTokyo()
    const shareLinkId = await arrangeShareLink({
      attachmentId: file.attachmentId,
      issuedBy: OWNER,
    })
    await fileRemovedMeanwhile(file.attachmentId)

    // Act
    await openAs(
      shareLinkHrefOf(file.salonId, file.attachmentId, shareLinkId),
      OWNER,
    )

    // Assert
    expect(await heading('ファイルが見つかりません')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: '共有リンクを取り消す' }),
    ).toBeNull()
  })
})
