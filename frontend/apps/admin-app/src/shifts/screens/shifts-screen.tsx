import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAfter,
  dayAt,
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  EmptyState,
  LoadingIndicator,
  PageHeader,
  PeriodSwitch,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { scheduleHrefOf, shiftsHrefOf, shiftWeekHrefOf } from '../../navigation'
import {
  readStaffProfiles,
  staffProfilesKeyOf,
} from '../../salons/api/salons-api'
import {
  readSchedule,
  type ScheduleRead,
  scheduleKeyOf,
} from '../api/schedules-api'
import {
  type ShiftMember,
  ShiftTable,
} from '../components/shift-table/shift-table'
import { weekIn } from '../utils/shift-week'

const { loading, names, titles, week: WEEK } = adminShiftMessages

/** What the table of a week shows: the members and their schedules, or why they are not shown */
type WeekShown =
  | { type: 'found'; members: ShiftMember[] }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/**
 * The members of a week and their schedules, once every schedule was
 * read: none while one is still read. A member removed meanwhile, whose
 * schedule is not found, is left out.
 */
const weekShownOf = (
  profiles: readonly ModelsStaffProfileResponse[],
  schedules: readonly (ScheduleRead | undefined)[],
): WeekShown | undefined => {
  if (schedules.some((read) => read?.type === 'forbidden')) {
    return { type: 'forbidden' }
  }
  const unread = schedules.find(
    (read) => read?.type === 'tooManyRequests' || read?.type === 'failed',
  )
  if (unread?.type === 'tooManyRequests' || unread?.type === 'failed') {
    return unread
  }
  if (schedules.some((read) => read === undefined)) {
    return undefined
  }

  return {
    type: 'found',
    members: profiles.flatMap((profile, index): ShiftMember[] => {
      const read = schedules[index]

      return read?.type === 'found'
        ? [{ id: profile.id, name: profile.displayName, rows: read.rows }]
        : []
    }),
  }
}

type ShiftsProps = { salon: ModelsSalonResponse }

/**
 * The shifts of a salon in a week: who works when, from Monday to Sunday.
 * The week is in the query of the address (`week`, a day of it), so that
 * the way back leads to the week before; without one it is the week of
 * today at the salon. The members are those the customers see, in the
 * order they were registered in, and the schedule of each is read once
 * for the seven days. A member of the staff sees their own row.
 */
const Shifts = ({ salon }: ShiftsProps) => {
  const say = useSay()
  const [query] = useSearchParams()
  const session = useSession()
  const monday = weekIn(query, dayAt(new Date(), salon.timezone))
  const own =
    session.type === 'signedIn' && session.user.role === 'staff'
      ? session.user.staffId
      : undefined
  const profiles = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })
  const members =
    profiles.data?.type === 'found'
      ? profiles.data.items.filter(({ id }) => own === undefined || id === own)
      : []
  const schedules = useQueries({
    queries: members.map(({ id }) => ({
      queryKey: scheduleKeyOf(id),
      queryFn: () => readSchedule(salon.id, id),
      // Another account may plan a member meanwhile: the schedules are read whenever they are shown
      staleTime: 0,
    })),
  })
  const readAgain = (): void => {
    if (profiles.data?.type !== 'found') {
      void profiles.refetch()
    }
    for (const schedule of schedules) {
      if (schedule.data?.type !== 'found') {
        void schedule.refetch()
      }
    }
  }
  const retrying =
    profiles.isFetching || schedules.some((schedule) => schedule.isFetching)

  return (
    <>
      <PageHeader title={say(titles.shifts)} description={salon.name} />
      <PeriodSwitch
        label={say(WEEK.label)}
        unit='week'
        beforeHref={shiftWeekHrefOf(salon.id, dayAfter(monday, -7))}
        currentHref={shiftsHrefOf(salon.id)}
        afterHref={shiftWeekHrefOf(salon.id, dayAfter(monday, 7))}
      />
      {match(profiles.data)
        .with(undefined, () => <LoadingIndicator label={say(loading.shifts)} />)
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.shifts, reason))}
            onRetry={readAgain}
            pending={retrying}
          />
        ))
        .with({ type: 'found' }, () =>
          members.length === 0 ? (
            <EmptyState
              title={say(WEEK.nobody)}
              description={say(
                own === undefined ? WEEK.nobodyDescription : WEEK.notOnShifts,
              )}
            />
          ) : (
            match(
              weekShownOf(
                members,
                schedules.map(({ data }) => data),
              ),
            )
              .with(undefined, () => (
                <LoadingIndicator label={say(loading.shifts)} />
              ))
              .with({ type: 'forbidden' }, () => (
                <OtherSalonNotice what={names.shifts} />
              ))
              .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
                <UnreadNotice
                  message={say(unreadMessageOf(names.shifts, reason))}
                  onRetry={readAgain}
                  pending={retrying}
                />
              ))
              .with({ type: 'found' }, ({ members: shown }) => (
                <ShiftTable
                  monday={monday}
                  members={shown}
                  scheduleHref={(staffId) => scheduleHrefOf(salon.id, staffId)}
                />
              ))
              .exhaustive()
          ),
        )
        .exhaustive()}
    </>
  )
}

/** The shifts of the salon of the address, for everyone who works at it. */
export const ShiftsScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.shifts)}>
      {(salon) => <Shifts key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
