import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import { TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { attachmentHrefOf, attachmentsHrefOf } from '../../navigation'

/*
 * What the screen tests of the files open and wait for, and what their
 * screens say alike.
 */

/** The files of the salon in Tokyo */
export const filesOfTokyo = async (): Promise<string> =>
  attachmentsHrefOf(await salonIdOf(TOKYO))

/** Opens the files of the salon in Tokyo, and waits until they are read. */
export const openFilesAs = async (email: string): Promise<void> => {
  await openAs(await filesOfTokyo(), email)
  await heading('ファイル')
  await waitFor(() =>
    expect(screen.queryByText('ファイルを読み込んでいます')).toBeNull(),
  )
}

/** Opens a file of the salon in Tokyo, and waits for the links that open it. */
export const openFileAs = async (id: string, email: string): Promise<void> => {
  await openAs(attachmentHrefOf(await salonIdOf(TOKYO), id), email)
  await screen.findByRole('link', { name: '保存する' })
}

/** What the screens say when the files, or a file, could not be read */
export const FILES_UNREAD =
  'ファイルを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What a file says when the addresses that open it could not be read */
export const LINKS_UNREAD =
  'ファイルを開くアドレスを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'
