import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsSalonUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  readSalon,
  type SalonRead,
  salonKeyOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { settingsHrefOf } from '../navigation'
import { HoursForm } from './components/hours-form/hours-form'
import { attemptHoursChange, type Hours, hoursOf } from './hours-api'
import { afterHoursChange, readHoursChange } from './hours-form'
import { SettingsForbidden, useKeepsSalon } from './keeps-salon'

const TITLE = '営業時間を直す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type HoursChangeProps = { salon: ModelsSalonResponse }

/**
 * The form of the hours of the salon, opened with the hours as the API
 * holds them now. The API replaces the week and the calendar whole, so the
 * form sends whichever was changed whole; a form sent as it was opened
 * asks the API for nothing. Before it is sent, the hours are read again:
 * hours that another account changed meanwhile are not replaced, and the
 * form says so. Sent again, it replaces the hours as they are then.
 */
const HoursChange = ({ salon }: HoursChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  /** The hours the form is sent against: those it opened with, or those another account wrote meanwhile */
  const [opened, setOpened] = useState<Hours>(() => hoursOf(salon))
  const today = dayAt(new Date(), salon.timezone)
  const key = salonKeyOf(salon.id)
  const settings = settingsHrefOf(salon.id)
  const save = useMutation({
    mutationFn: (request: ModelsSalonUpdateRequest) =>
      attemptHoursChange(salon.id, opened, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ salon: changed }) => {
          const read: SalonRead = { type: 'found', salon: changed }
          queryClient.setQueryData(key, read)
          notify({ tone: 'success', message: '営業時間を直しました。' })
          void navigate(settings)
        })
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with({ type: 'changed' }, (changed) => {
          setOpened(changed.hours)
          setSaid(afterHoursChange(changed))
        })
        .with(
          {
            type: P.union(
              'invalid',
              'emailTaken',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterHoursChange(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readHoursChange(values, opened, today))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更はありませんでした。' })
        void navigate(settings)
      })
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        save.mutate(request)
      })
      .exhaustive()

  return (
    <HoursForm
      hours={opened}
      today={today}
      timezone={salon.timezone}
      submitLabel='保存する'
      message={said.message}
      errors={said.errors}
      pending={save.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={settings} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type ChangePartProps = { salon: ModelsSalonResponse }

/** The salon read anew, and the form once it was. */
const ChangePart = ({ salon }: ChangePartProps) => {
  const read = useQuery({
    queryKey: salonKeyOf(salon.id),
    queryFn: () => readSalon(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {read.isFetchedAfterMount ? (
        <HoursChange salon={salon} />
      ) : (
        <LoadingIndicator label='営業時間を読み込んでいます' />
      )}
    </>
  )
}

/** Changes the hours of the salon of the address, for the owner, a manager and an administrator. */
export const HoursChangeScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsSalon()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <ChangePart key={salon.id} salon={salon} />
        ) : (
          <SettingsForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
