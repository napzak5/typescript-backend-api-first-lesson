import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { renderAt } from '../../__tests__/screens'
import {
  treatmentChangeHrefOf,
  treatmentEntryHrefOf,
  treatmentPhotosHrefOf,
} from '../../navigation'
import { treatmentIdOf } from './arrangements'

/*
 * What the screen tests of the treatment records open, fill in and wait
 * for, and what their screens say alike.
 */

/** Waits until the form of a record is shown. */
export const treatmentForm = (): Promise<HTMLElement> =>
  screen.findByRole('group', { name: '提供したサービス' })

/** Opens the writing of the record of a booking, signed in, and waits for the form. */
export const openEntryOf = async (
  bookingId: string,
  account = OWNER,
): Promise<void> => {
  renderAt(treatmentEntryHrefOf(await salonIdOf(TOKYO), bookingId))
  await signInAs(account)
  await treatmentForm()
}

/** Opens the change of the record of a customer of the seed data, signed in, and waits for the form. */
export const openTreatmentChangeOf = async (
  email: string,
  account = OWNER,
): Promise<void> => {
  renderAt(
    treatmentChangeHrefOf(await salonIdOf(TOKYO), await treatmentIdOf(email)),
  )
  await signInAs(account)
  await treatmentForm()
}

/** Waits until a record shows its part of the photos, and gives it. */
export const photosPart = (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: '施術写真' })

/** The row of the photo of a number in the form, counted from 1 */
export const photoRow = (number: number): HTMLElement =>
  screen.getByRole('group', { name: `${number} 枚目の写真` })

/** A photo as a test fills it in */
export type FilledPhoto = {
  photoType: string
  photoUrl: string
  angle?: string
  description?: string
  thumbnailUrl?: string
  consent?: boolean
  outside?: boolean
}

/** Fills in the row of the photo of a number, counted from 1. */
export const fillPhoto = async (
  user: ReturnType<typeof userEvent.setup>,
  number: number,
  filled: FilledPhoto,
): Promise<void> => {
  const row = photoRow(number)
  await user.selectOptions(
    within(row).getByRole('combobox', { name: '区分' }),
    filled.photoType,
  )
  await user.type(
    within(row).getByRole('textbox', { name: '写真の URL' }),
    filled.photoUrl,
  )
  if (filled.thumbnailUrl !== undefined) {
    await user.type(
      within(row).getByRole('textbox', { name: '縮小した写真の URL' }),
      filled.thumbnailUrl,
    )
  }
  if (filled.angle !== undefined) {
    await user.type(
      within(row).getByRole('textbox', { name: '撮った向き' }),
      filled.angle,
    )
  }
  if (filled.description !== undefined) {
    await user.type(
      within(row).getByRole('textbox', { name: '写真の説明' }),
      filled.description,
    )
  }
  if (filled.consent === true) {
    await user.click(
      within(row).getByRole('checkbox', {
        name: 'お客様が、写真の撮影と利用に同意している',
      }),
    )
  }
  if (filled.outside === true) {
    await user.click(
      within(row).getByRole('checkbox', {
        name: 'サロンの外（サロンのページなど）に見せてよい',
      }),
    )
  }
}

/** Opens the screen that adds photos to the record of a customer of the seed data, and waits for the form. */
export const openPhotosOf = async (
  email: string,
  account = OWNER,
): Promise<string> => {
  const treatmentId = await treatmentIdOf(email)
  renderAt(treatmentPhotosHrefOf(await salonIdOf(TOKYO), treatmentId))
  await signInAs(account)
  await screen.findByRole('group', { name: '1 枚目の写真' })

  return treatmentId
}

/** What the screens say when the records, or a record, could not be read */
export const RECORDS_UNREAD =
  '施術記録を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'
