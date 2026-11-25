import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen } from '@testing-library/react'
import { renderAt } from '../../__tests__/screens'
import { customerIdOf } from '../../customers/__tests__/arrangements'
import { allergyChangeHrefOf, chartHrefOf } from '../../navigation'
import { allergyIdOf } from './arrangements'

/*
 * What the screen tests of the charts and the allergies open and wait
 * for, and what their screens say alike.
 */

/**
 * Opens a screen of the chart of a customer in the salon in Tokyo, signed
 * in: the chart itself, or a screen below it (`/new`, `/edit`,
 * `/allergies/new`).
 */
export const openChartOf = async (
  email: string,
  below = '',
  account = OWNER,
): Promise<{ salonId: string; customerId: string }> => {
  const customerId = await customerIdOf(email)
  const salonId = await salonIdOf(TOKYO)
  renderAt(`${chartHrefOf(salonId, customerId)}${below}`)
  await signInAs(account)

  return { salonId, customerId }
}

/** Opens the change of an allergy of a customer in the salon in Tokyo, signed in. */
export const openAllergyChangeOf = async (
  email: string,
  allergenName: string,
  account = OWNER,
): Promise<void> => {
  const customerId = await customerIdOf(email)
  const salonId = await salonIdOf(TOKYO)
  const allergyId = await allergyIdOf(email, allergenName)
  renderAt(allergyChangeHrefOf(salonId, customerId, allergyId))
  await signInAs(account)
}

/** Waits until the form of a chart is shown. */
export const chartForm = (): Promise<HTMLElement> =>
  screen.findByRole('group', { name: '施術の前に確かめること' })

/** The part of the chart with the allergies */
export const allergiesPart = (): HTMLElement =>
  screen.getByRole('region', { name: 'アレルギー' })

/** Waits until the allergies are listed, and gives their table. */
export const allergiesListed = (): Promise<HTMLElement> =>
  screen.findByRole('table', { name: 'アレルギーの一覧' })

/** Waits until the form of an allergy is shown. */
export const allergyForm = (): Promise<HTMLElement> =>
  screen.findByRole('radiogroup', { name: '重篤度' })

/** What the screens say when the chart, or the charts, could not be read */
export const CHARTS_UNREAD =
  'カルテを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What the screens say when the allergies, or an allergy, could not be read */
export const ALLERGIES_UNREAD =
  'アレルギーを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'
