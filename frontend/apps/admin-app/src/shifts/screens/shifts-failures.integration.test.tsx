import {
  giveBack,
  refuse,
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
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import { scheduleHrefOf, shiftsHrefOf } from '../../navigation'
import {
  arrangeInactive,
  everyMemberRemoved,
  removedMeanwhile,
  staffIdOf,
  TANAKA,
  WATANABE,
} from '../../staff/__tests__/arrangements'
import { firstMemberOf, storedScheduleOf } from '../__tests__/arrangements'
import {
  group,
  openChange,
  SCHEDULE_UNREAD,
  SHIFTS_UNREAD,
  writeTime,
} from '../__tests__/screens'

/*
 * The shifts of a week, the schedule of a member and its form, when a read
 * fails, when the salon has nobody on the shifts, and when the ledger or
 * the account changes between two requests of the screen. The failures
 * are arranged in the database; what goes well is in
 * `shifts.integration.test.tsx`.
 */

/** Makes a read fail, and gives back what lets it be read again */
type Failure = () => Promise<() => Promise<void>>

/** The profiles of the members are read no more: a profile reads every column of the ledger */
const profilesUnreadable: Failure = async () => {
  await takeAway('staff', 'bio')

  return () => giveBack('staff', 'bio')
}

/** No schedule is read any more */
const schedulesUnreadable: Failure = async () => {
  await takeAway('staff_schedules')

  return () => giveBack('staff_schedules')
}

/** The table of the shifts of the week shown, once the schedules were read */
const weekTable = (): Promise<HTMLElement> =>
  screen.findByRole('table', { name: /のシフト$/ })

describe('the shifts, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each<[string, Failure]>([
    ['the members', profilesUnreadable],
    ['their schedules', schedulesUnreadable],
  ])(
    'should say that the shifts could not be read when %s could not, and show them when asked again',
    async (_, fail) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await fail()
      await openAs(shiftsHrefOf(await salonIdOf(TOKYO)), MANAGER)
      expect(await screen.findByText(SHIFTS_UNREAD)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(rowsOf(await weekTable()).map(([name]) => name)).toContain(
        'Hiroshi Tanaka',
      )
    },
  )

  it('should leave out of the week a member removed as their schedule was read', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    const tanaka = await staffIdOf(TANAKA)
    whenAskedFor(`GET /salons/${tokyo}/staff/${tanaka}/schedules`, () =>
      removedMeanwhile(tanaka),
    )

    // Act
    await openAs(shiftsHrefOf(tokyo), MANAGER)

    // Assert
    const names = rowsOf(await weekTable()).map(([name]) => name)
    expect(names).toContain('Mika Suzuki')
    expect(names).not.toContain('Hiroshi Tanaka')
  })

  it('should say that nobody is on the shifts of a salon without members, and who registers them', async () => {
    // Arrange
    await everyMemberRemoved()

    // Act
    await openAs(shiftsHrefOf(await salonIdOf(TOKYO)), OPERATOR)

    // Assert
    expect(
      await screen.findByText('シフトに出るスタッフはいません'),
    ).toBeVisible()
    expect(
      screen.getByText(
        '有効なスタッフが、シフトに出ます。スタッフは、オーナーがスタッフ台帳に登録します。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should tell a member of the staff whose member is inactive that they are not on the shifts', async () => {
    // Arrange
    await arrangeInactive(TANAKA)

    // Act
    await openAs(shiftsHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    expect(
      await screen.findByText('シフトに出るスタッフはいません'),
    ).toBeVisible()
    expect(
      screen.getByText(
        'このアカウントに結びついたスタッフは、このサロンの有効なスタッフにいません。',
      ),
    ).toBeInTheDocument()
  })

  it.each<[string, string, Failure]>([
    [
      'the member, read in the ledger',
      OWNER,
      async () => unreadable('staff', 'createdAt', await staffIdOf(TANAKA)),
    ],
    ['the member, read in their profile', MANAGER, profilesUnreadable],
    ['the schedule', MANAGER, schedulesUnreadable],
  ])(
    'should say that the schedule could not be read when %s could not, and show it when asked again',
    async (_, email, fail) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await fail()
      await openAs(
        scheduleHrefOf(await salonIdOf(TOKYO), await staffIdOf(TANAKA)),
        email,
      )
      expect(await screen.findByText(SCHEDULE_UNREAD)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(await screen.findByText('Hiroshi Tanaka さん')).toBeVisible()
    },
  )

  it('should say that a member of another salon is not found among the schedules of this one', async () => {
    // Act
    await openAs(
      scheduleHrefOf(await salonIdOf(TOKYO), await firstMemberOf(OSAKA)),
      MANAGER,
    )

    // Assert
    await heading('スタッフが見つかりません')
    expect(screen.getByRole('link', { name: 'シフトへ' })).toHaveAttribute(
      'href',
      shiftsHrefOf(await salonIdOf(TOKYO)),
    )
  })

  it.each<[string, () => Promise<unknown>, string]>([
    [
      'could not be written',
      () => refuse('insert', 'staff_schedules'),
      '勤務スケジュールを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      'was refused to an account that plans the shifts no more',
      () => madeStaffMeanwhile(MANAGER),
      'このアカウントでは、勤務スケジュールを直せません。勤務スケジュールを直せるのは、サロンのオーナー、マネージャーと、管理者です。',
    ],
  ])(
    'should say above the form that the schedule %s, and save nothing',
    async (_, fail, said) => {
      // Arrange
      const user = userEvent.setup()
      await openChange(WATANABE)
      const monday = within(group('月曜日'))
      await user.click(monday.getByRole('radio', { name: '勤務する' }))
      await writeTime(user, monday.getByLabelText('始まり'), '10:00')
      await writeTime(user, monday.getByLabelText('終わり'), '19:00')
      await fail()

      // Act
      await user.click(screen.getByRole('button', { name: '保存する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(said)
      expect(await storedScheduleOf(WATANABE)).toEqual([])
    },
  )
})
