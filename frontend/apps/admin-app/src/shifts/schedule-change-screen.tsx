import type {
  ModelsSalonResponse,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  NOT_FOUND,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { scheduleHrefOf } from '../navigation'
import { ScheduleForm } from './components/schedule-form/schedule-form'
import {
  afterScheduleSave,
  readScheduleChange,
  type ScheduleRequest,
} from './schedule-form'
import {
  attemptScheduleSave,
  type ScheduleRead,
  scheduleKeyOf,
} from './schedules-api'
import { type ScheduleOf, usePlansShifts, WithSchedule } from './with-schedule'

const TITLE = '勤務スケジュールを直す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type ScheduleChangeProps = {
  salon: ModelsSalonResponse
  schedule: ScheduleOf
}

/**
 * The form of the schedule of a member, opened with the schedule as the
 * API holds it now. The API replaces the whole schedule, so the form sends
 * it whole; a form sent as it was opened asks the API for nothing. Before
 * it is sent, the schedule is read again: one that another account changed
 * meanwhile is not replaced, and the form says so. Sent again, it replaces
 * the schedule as it is then. The schedule the API answers with is what
 * the schedule of the member shows at once.
 */
const ScheduleChange = ({ salon, schedule }: ScheduleChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  /** The schedule the form is sent against: the one it opened with, or the one another account wrote meanwhile */
  const [opened, setOpened] = useState<ModelsStaffSchedule[]>(schedule.rows)
  const today = dayAt(new Date(), salon.timezone)
  const key = scheduleKeyOf(schedule.staffId)
  const back = scheduleHrefOf(salon.id, schedule.staffId)
  const save = useMutation({
    mutationFn: (request: ScheduleRequest) =>
      attemptScheduleSave(salon.id, schedule.staffId, opened, request.rows),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'saved' }, ({ rows }) => {
          const read: ScheduleRead = { type: 'found', rows }
          queryClient.setQueryData(key, read)
          notify({
            tone: 'success',
            message: `${schedule.name} さんの勤務スケジュールを保存しました。`,
          })
          void navigate(back)
        })
        // The member was removed from the staff ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with({ type: 'changed' }, (changed) => {
          setOpened(changed.rows)
          setSaid(afterScheduleSave(changed, request))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterScheduleSave(refused, request)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readScheduleChange(values, opened, today))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更はありませんでした。' })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        save.mutate(request)
      })
      .exhaustive()

  return (
    <ScheduleForm
      rows={opened}
      today={today}
      submitLabel='保存する'
      message={said.message}
      errors={said.errors}
      pending={save.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Changes the schedule of a member of the staff of the salon of the address. */
export const ScheduleChangeScreen = () => {
  const { salonId = '', staffId = '' } = useParams()
  const plans = usePlansShifts()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        plans ? (
          <WithSchedule key={staffId} salon={salon} title={TITLE} fresh>
            {(schedule) => <ScheduleChange salon={salon} schedule={schedule} />}
          </WithSchedule>
        ) : (
          <>
            <PageHeader title={TITLE} description={salon.name} />
            <p>
              このアカウントでは、勤務スケジュールを直せません。勤務スケジュールを直せるのは、サロンのオーナー、マネージャーと、管理者です。
            </p>
            <p>
              <ButtonLink href={scheduleHrefOf(salon.id, staffId)}>
                勤務スケジュールへ
              </ButtonLink>
            </p>
          </>
        )
      }
    </WithSalon>
  )
}
