import {
  giveBack,
  refuse,
  salonIdOf,
  takeAway,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  termsOnceThere,
} from '@beauty-salon-frontend/testing/screens'
import {
  OWNER,
  SAKURA,
  STYLIST,
  TOKYO,
  VIP,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { treatmentHrefOf, treatmentStatisticsHrefOf } from '../../navigation'
import {
  arrangeVisit,
  storedPhotosOf,
  treatmentIdOf,
  writtenMeanwhile,
} from '../__tests__/arrangements'
import { fillPhoto, openPhotosOf, photosPart } from '../__tests__/screens'

/*
 * The photos of a record and the statistics of the records, when a write
 * or a removal is refused and when a read fails. The failures are arranged
 * in the database; what goes well is in `photos.integration.test.tsx`.
 */

/** Opens the statistics of the salon in Tokyo over the month up to today. */
const openStatistics = async (): Promise<void> => {
  await openAs(treatmentStatisticsHrefOf(await salonIdOf(TOKYO)), OWNER)
  await heading('施術の統計')
}

/** How many records the statistics count, once they are shown */
const recordsCounted = async (): Promise<string | undefined> =>
  (await termsOnceThere('施術記録の数')).find(
    ([term]) => term === '施術記録',
  )?.[1]

describe('the photos and the statistics of the treatment records, when something fails, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the photos could not be added, and keep what was filled in', async () => {
    // Arrange
    const user = userEvent.setup()
    await refuse('insert', 'treatment_photos')
    const treatmentId = await openPhotosOf(SAKURA.email)
    await fillPhoto(user, 1, {
      photoType: '施術前',
      photoUrl: 'https://photos.example.com/sakura/before.jpg',
    })

    // Act
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '施術写真を足せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('textbox', { name: '写真の URL' })).toHaveValue(
      'https://photos.example.com/sakura/before.jpg',
    )
    expect(await storedPhotosOf(treatmentId)).toEqual([])
  })

  it('should say that the account may not add photos when it no longer belongs to a salon, and add none', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await openPhotosOf(YUKI.email, STYLIST)
    const before = await storedPhotosOf(treatmentId)
    await fillPhoto(user, 1, {
      photoType: '施術前',
      photoUrl: 'https://photos.example.com/yuki/before.jpg',
    })
    await staffRemovedMeanwhile('Hiroshi Tanaka')

    // Act
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このアカウントでは、施術写真を足せません。',
    )
    expect(await storedPhotosOf(treatmentId)).toEqual(before)
  })

  it('should say in the dialog that the photo could not be taken away, and keep it', async () => {
    // Arrange
    const user = userEvent.setup()
    await refuse('delete', 'treatment_photos')
    const treatmentId = await treatmentIdOf(VIP.email)
    await openAs(treatmentHrefOf(await salonIdOf(TOKYO), treatmentId), STYLIST)
    await user.click(
      within(await photosPart()).getByRole('button', {
        name: '1 枚目の写真を外す',
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: '1 枚目：施術前の写真（側面）を外しますか？',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '外す' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '施術写真を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(await storedPhotosOf(treatmentId)).toHaveLength(2)
  })

  it('should say that the statistics could not be read, and count the records when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await takeAway('treatment_records', 'processingTime')
    await openStatistics()
    expect(
      await screen.findByText(
        '施術の統計を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await giveBack('treatment_records', 'processingTime')

    // Act
    await readAgain(user)

    // Assert
    expect(await recordsCounted()).toBe('3 件')
  })

  it('should count the records again when the same days are sent again', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await arrangeVisit()
    await openStatistics()
    expect(await recordsCounted()).toBe('3 件')
    await writtenMeanwhile(bookingId)

    // Act
    await user.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    await waitFor(async () => expect(await recordsCounted()).toBe('4 件'))
  })
})
