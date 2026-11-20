import { ButtonLink } from '@beauty-salon-frontend/ui'
import { useParams } from 'react-router'
import { scheduleChangeHrefOf, shiftsHrefOf } from '../navigation'
import { dayAt } from '../salon-time'
import { WithSalon } from '../salons/with-salon'
import { ScheduleRecord } from './components/schedule-record/schedule-record'
import { usePlansShifts, WithSchedule } from './with-schedule'

const TITLE = '勤務スケジュール'

/**
 * The schedule of a member of the staff of the salon of the address: the
 * hours of every day of the week, and the rows of dates from today on. An
 * account that plans the schedules is offered to change it.
 */
export const ScheduleScreen = () => {
  const { salonId = '', staffId = '' } = useParams()
  const plans = usePlansShifts()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithSchedule
          key={staffId}
          salon={salon}
          title={TITLE}
          fresh={false}
          actions={(schedule) =>
            plans ? (
              <ButtonLink
                href={scheduleChangeHrefOf(salon.id, schedule.staffId)}
                variant='secondary'
              >
                勤務スケジュールを直す
              </ButtonLink>
            ) : undefined
          }
        >
          {(schedule) => (
            <>
              <ScheduleRecord
                rows={schedule.rows}
                today={dayAt(new Date(), salon.timezone)}
              />
              <p>
                <ButtonLink href={shiftsHrefOf(salon.id)} variant='secondary'>
                  シフトへ
                </ButtonLink>
              </p>
            </>
          )}
        </WithSchedule>
      )}
    </WithSalon>
  )
}
