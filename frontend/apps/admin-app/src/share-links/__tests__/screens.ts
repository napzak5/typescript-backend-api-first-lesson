import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import { OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { arrangeFile } from '../../attachments/__tests__/arrangements'
import { attachmentHrefOf, shareLinkEntryHrefOf } from '../../navigation'

/*
 * What the screen tests of the share links put into the database first,
 * open and wait for.
 */

/** The name of the file the tests share */
export const CONSENT = 'カラー同意書_田中様.pdf'

/** A file of a salon, by its ID and that of the salon */
export type FileOfSalon = { salonId: string; attachmentId: string }

/** A form of the salon in Tokyo that the owner uploaded: its ID, and the ID of the salon */
export const consentOfTokyo = async (): Promise<FileOfSalon> => {
  const salonId = await salonIdOf(TOKYO)
  const attachmentId = await arrangeFile({
    salonId,
    filename: CONSENT,
    uploadedBy: OWNER,
  })

  return { salonId, attachmentId }
}

/** The part of the screen of the file that holds its links */
export const linksPart = (): HTMLElement =>
  screen.getByRole('region', { name: '共有リンク' })

/** Opens the screen of a file, and waits for its links to be read. */
export const openFileAs = async (
  file: FileOfSalon,
  email: string,
): Promise<void> => {
  await openAs(attachmentHrefOf(file.salonId, file.attachmentId), email)
  await heading(CONSENT)
  await waitFor(() =>
    expect(
      within(linksPart()).queryByText('共有リンクを読み込んでいます'),
    ).toBeNull(),
  )
}

/** Opens the form of a link of a file, and waits until the file is read. */
export const openFormAs = async (
  file: FileOfSalon,
  email: string,
): Promise<void> => {
  await openAs(shareLinkEntryHrefOf(file.salonId, file.attachmentId), email)
  await screen.findByRole('combobox', { name: '有効期間' })
}
