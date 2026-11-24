import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink, useSay } from '@beauty-salon-frontend/ui'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useParams } from 'react-router'
import { scheduleChangeHrefOf, shiftsHrefOf } from '../../navigation'
import { ScheduleRecord } from '../components/schedule-record/schedule-record'
import { usePlansShifts, WithSchedule } from './with-schedule'

const { record, titles } = adminShiftMessages

/**
 * The schedule of a member of the staff of the salon of the address: the
 * hours of every day of the week, and the rows of dates from today on. An
 * account that plans the schedules is offered to change it.
 */
export const ScheduleScreen = () => {
  const say = useSay()
  const { salonId = '', staffId = '' } = useParams()
  const plans = usePlansShifts()
  const title = say(titles.schedule)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithSchedule
          key={staffId}
          salon={salon}
          title={title}
          fresh={false}
          actions={(schedule) =>
            plans ? (
              <ButtonLink
                href={scheduleChangeHrefOf(salon.id, schedule.staffId)}
              >
                {say(record.change)}
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
              <ButtonLink href={shiftsHrefOf(salon.id)}>
                {say(record.toShifts)}
              </ButtonLink>
            </>
          )}
        </WithSchedule>
      )}
    </WithSalon>
  )
}
