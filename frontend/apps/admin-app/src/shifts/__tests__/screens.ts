import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { MANAGER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { renderAt } from '../../__tests__/screens'
import { scheduleChangeHrefOf } from '../../navigation'
import { staffIdOf } from '../../staff/__tests__/arrangements'

/*
 * What the screen tests of the shifts open, fill in and wait for, and what
 * their screens say alike.
 */

/** A day of the week, or a row of a date, of the form */
export const group = (name: string): HTMLElement =>
  screen.getByRole('group', { name })

/** Writes a time into a control that holds one. */
export const writeTime = async (
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
  time: string,
): Promise<void> => {
  await user.clear(control)
  await user.type(control, time)
}

/** Opens the form of the schedule of a member as the manager, and waits for it. */
export const openChange = async (staffCode: string): Promise<string> => {
  const salonId = await salonIdOf(TOKYO)
  renderAt(scheduleChangeHrefOf(salonId, await staffIdOf(staffCode)))
  await signInAs(MANAGER)
  await screen.findByRole('group', { name: '月曜日' })

  return salonId
}

/** What the shifts of a week say when the members or their schedules could not be read */
export const SHIFTS_UNREAD =
  'シフトを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What a screen of a schedule says when the member or their schedule could not be read */
export const SCHEDULE_UNREAD =
  '勤務スケジュールを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'
