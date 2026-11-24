import {
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  UNREAD_TYPES,
  type Unread,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { shiftsHrefOf } from '../../navigation'
import { readStaffMember, staffKeyOf } from '../../staff/api/staff-api'
import { useKeepsStaffLedger } from '../../staff/screens/with-staff-member'
import {
  mayPlanShifts,
  profileKeyOf,
  readProfile,
  readSchedule,
  type ScheduleRead,
  scheduleKeyOf,
} from '../api/schedules-api'

const { loading, member: MEMBER, names, record } = adminShiftMessages

/** A member of the staff, and their schedule */
export type ScheduleOf = {
  staffId: string
  /** The name the customers see */
  name: string
  /** An inactive member does not work at the salon until they are made active again */
  isActive: boolean
  rows: ModelsStaffSchedule[]
}

/** The member of a schedule: who they are, as far as the account may read */
type MemberRead =
  | { type: 'found'; name: string; isActive: boolean }
  | NotFound
  | Forbidden
  | Unread

/**
 * Whether the signed-in account plans the schedules of a salon: one that
 * does not (a member of the staff) is not offered to change them, and is
 * told so before the API is asked. The owner of another salon is refused
 * by the API.
 */
export const usePlansShifts = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayPlanShifts(session.user.role)
}

/**
 * The member a schedule is of. An account that keeps the staff ledger
 * reads them in it, an inactive member as well; another reads the profile
 * the customers see, which an inactive member does not have.
 */
const useMember = (
  salonId: string,
  staffId: string,
): { read: MemberRead | undefined; again: () => void; reading: boolean } => {
  const keeps = useKeepsStaffLedger()
  const ledger = useQuery({
    queryKey: staffKeyOf(staffId),
    queryFn: () => readStaffMember(salonId, staffId),
    enabled: keeps,
  })
  const profile = useQuery({
    queryKey: profileKeyOf(staffId),
    queryFn: () => readProfile(staffId),
    enabled: !keeps,
  })
  const read = keeps
    ? match(ledger.data)
        .returnType<MemberRead | undefined>()
        .with({ type: 'found' }, ({ member }) => ({
          type: 'found',
          name: member.displayName,
          isActive: member.isActive,
        }))
        .otherwise((other) => other)
    : match(profile.data)
        .returnType<MemberRead | undefined>()
        .with({ type: 'found' }, ({ profile: found }) =>
          // A profile of another salon is no member of this one
          found.salonId === salonId
            ? { type: 'found', name: found.displayName, isActive: true }
            : NOT_FOUND,
        )
        .otherwise((other) => other)
  const used = keeps ? ledger : profile

  return {
    read,
    again: () => void used.refetch(),
    reading: used.isFetching,
  }
}

/** What a screen of a schedule shows: the member and their schedule, or why they are not shown */
type Shown =
  | { type: 'found'; schedule: ScheduleOf }
  | NotFound
  | Forbidden
  | Unread

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/**
 * What the reads of the member and of the schedule show together: that
 * the account may not see them, before that there is none, before that
 * they are still read, before that one could not be read.
 */
const shownOf = (
  member: MemberRead | undefined,
  schedule: ScheduleRead | undefined,
  staffId: string,
): Shown | undefined =>
  match([member, schedule])
    .returnType<Shown | undefined>()
    .with(
      P.union([{ type: 'forbidden' }, P._], [P._, { type: 'forbidden' }]),
      () => FORBIDDEN,
    )
    .with(
      P.union([{ type: 'notFound' }, P._], [P._, { type: 'notFound' }]),
      () => NOT_FOUND,
    )
    .with(P.union([undefined, P._], [P._, undefined]), () => undefined)
    .with([{ type: 'found' }, { type: 'found' }], ([found, read]) => ({
      type: 'found',
      schedule: {
        staffId,
        name: found.name,
        isActive: found.isActive,
        rows: read.rows,
      },
    }))
    .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([unread]) => unread)
    .with([P._, { type: P.union(...UNREAD_TYPES) }], ([, unread]) => unread)
    .exhaustive()

type ScheduleNotFoundProps = { salon: ModelsSalonResponse }

/** What a screen of a schedule says when there is no member to show. */
const ScheduleNotFound = ({ salon }: ScheduleNotFoundProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(MEMBER.notFound)}
        description={say(MEMBER.notFoundDescription)}
      />
      <ButtonLink href={shiftsHrefOf(salon.id)}>
        {say(record.toShifts)}
      </ButtonLink>
    </>
  )
}

/** What an account is told that may not read a schedule. */
const ScheduleForbidden = () => {
  const say = useSay()

  return (
    <>
      <p>{say(MEMBER.forbidden)}</p>
      <ButtonLink href='/'>{say(MEMBER.toStart)}</ButtonLink>
    </>
  )
}

export type WithScheduleProps = {
  salon: ModelsSalonResponse
  /** The title of the screen, in the language of the page */
  title: string
  /**
   * Whether the screen shows the schedule only once it was read anew: a
   * screen that writes it does, so that what it writes on is what the API
   * holds now. A screen that shows it shows what was read before at once,
   * and what is read anew when it comes.
   */
  fresh: boolean
  /** What can be done with the schedule, beside the title */
  actions?: (schedule: ScheduleOf) => ReactNode
  /** The screen, below its heading, for the schedule of the member of the address */
  children: (schedule: ScheduleOf) => ReactNode
}

/**
 * A screen of the schedule of a member, below the salon of the address.
 * The schedule is read whenever the screen opens; that of a member who was
 * removed is not found, as that of one who never was. Below the heading,
 * the member is named as the customers see them.
 */
export const WithSchedule = ({
  salon,
  title,
  fresh,
  actions,
  children,
}: WithScheduleProps) => {
  const say = useSay()
  const { staffId = '' } = useParams()
  const member = useMember(salon.id, staffId)
  const schedule = useQuery({
    queryKey: scheduleKeyOf(staffId),
    queryFn: () => readSchedule(salon.id, staffId),
    // Another account may plan the member meanwhile: the schedule is read whenever the screen opens
    staleTime: 0,
    refetchOnReconnect: !fresh,
  })
  const shown = shownOf(
    member.read,
    !fresh || schedule.isFetchedAfterMount ? schedule.data : undefined,
    staffId,
  )
  const header = <PageHeader title={title} description={salon.name} />

  return match(shown)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label={say(loading.schedule)} />
      </>
    ))
    .with({ type: 'found' }, ({ schedule: found }) => (
      <>
        <PageHeader
          title={title}
          description={salon.name}
          actions={actions?.(found)}
        />
        <p>{say(MEMBER.called(found.name))}</p>
        {!found.isActive && <p>{say(MEMBER.inactive)}</p>}
        {children(found)}
      </>
    ))
    .with({ type: 'notFound' }, () => <ScheduleNotFound salon={salon} />)
    .with({ type: 'forbidden' }, () => (
      <>
        {header}
        <ScheduleForbidden />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={say(unreadMessageOf(names.schedule, reason))}
          onRetry={() => {
            member.again()
            void schedule.refetch()
          }}
          pending={member.reading || schedule.isFetching}
        />
      </>
    ))
    .exhaustive()
}
