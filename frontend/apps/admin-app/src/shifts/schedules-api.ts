import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type RefusedValue,
  refusedValuesOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsStaffProfileResponse,
  type ModelsStaffSchedule,
  staffProfileGet,
  staffSchedulesList,
  staffSchedulesUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * The schedules of the members of a salon: when each of them works, as
 * the owner, a manager and an administrator plan it. A member of the staff
 * reads their own.
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The roles that plan the schedules of a salon: a member of the staff reads their own */
const PLANNERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account of the role plans the schedules, and is offered to change them. */
export const mayPlanShifts = (role: string): boolean => PLANNERS.includes(role)

/** The key the schedule of a member is read under. */
export const scheduleKeyOf = (staffId: string): string[] => [
  'staff-schedule',
  staffId,
]

/** The schedule of a member, or why it was not read: the account may not read that of another member. */
export type ScheduleRead =
  | { type: 'found'; rows: ModelsStaffSchedule[] }
  | NotFound
  | Forbidden
  | Unread

/** Every row of the schedule of a member of a salon: the weekly rows from Monday, then the rows of dates. */
export const readSchedule = async (
  salonId: string,
  staffId: string,
): Promise<ScheduleRead> => {
  const answer = await staffSchedulesList(salonId, staffId).catch(() => null)

  return (
    match(answer)
      .returnType<ScheduleRead>()
      .with({ status: 200 }, ({ data }) => ({
        type: 'found',
        rows: data.data,
      }))
      // An ID that is no ID names no member either
      .with({ status: P.union(400, 404) }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      .with(P.union(...UNANSWERED_PARTS), unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** The key the profile of a member is read under. */
export const profileKeyOf = (staffId: string): string[] => [
  'staff-profile',
  staffId,
]

/** The profile of a member, as the customers see it: none for a member who is inactive or was removed. */
export type ProfileRead =
  | { type: 'found'; profile: ModelsStaffProfileResponse }
  | NotFound
  | Unread

/** The profile of a member: what a screen names a member by, for an account that does not keep the staff ledger. */
export const readProfile = async (staffId: string): Promise<ProfileRead> => {
  const answer = await staffProfileGet(staffId).catch(() => null)

  return match(answer)
    .returnType<ProfileRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      profile: data.data,
    }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with(P.union(null, { status: 429 }, { status: 500 }), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of saving a schedule. */
type ScheduleSave =
  | { type: 'saved'; rows: ModelsStaffSchedule[] }
  | { type: 'invalid'; values: RefusedValue[] }
  | NotFound
  | Forbidden
  | Unread

/** Replaces the whole schedule of a member: a row that is not sent is gone. */
const saveSchedule = async (
  salonId: string,
  staffId: string,
  rows: ModelsStaffSchedule[],
): Promise<ScheduleSave> => {
  const answer = await staffSchedulesUpdate(salonId, staffId, rows).catch(
    () => null,
  )

  return match(answer)
    .returnType<ScheduleSave>()
    .with({ status: 200 }, ({ data }) => ({ type: 'saved', rows: data.data }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** The values of a row, in one order whatever the order of its properties. */
const valuesOf = (row: ModelsStaffSchedule): unknown[] => [
  row.dayOfWeek,
  row.date,
  row.startTime,
  row.endTime,
  row.breakStartTime,
  row.breakEndTime,
  row.isRecurring,
  row.isAvailable,
  row.notes,
]

/** Whether two schedules hold the same rows, in the same order: the API lists them in one. */
export const sameSchedule = (
  one: readonly ModelsStaffSchedule[],
  other: readonly ModelsStaffSchedule[],
): boolean =>
  JSON.stringify(one.map(valuesOf)) === JSON.stringify(other.map(valuesOf))

/** What came of an attempt to save a schedule: another account may have changed it since the form opened. */
export type ScheduleAttempt =
  | ScheduleSave
  | {
      type: 'changed'
      /** The schedule as it is now */
      rows: ModelsStaffSchedule[]
    }

/**
 * Saves a schedule unless another account changed it since the form read
 * it (`opened`): the API replaces the whole schedule, and would drop what
 * the other account wrote. A schedule that was changed is not saved, and
 * comes back as it is now: the next attempt is made against it.
 */
export const attemptScheduleSave = async (
  salonId: string,
  staffId: string,
  opened: readonly ModelsStaffSchedule[],
  rows: ModelsStaffSchedule[],
): Promise<ScheduleAttempt> => {
  const now = await readSchedule(salonId, staffId)
  if (now.type !== 'found') {
    return now
  }
  if (!sameSchedule(now.rows, opened)) {
    return { type: 'changed', rows: now.rows }
  }

  return saveSchedule(salonId, staffId, rows)
}
