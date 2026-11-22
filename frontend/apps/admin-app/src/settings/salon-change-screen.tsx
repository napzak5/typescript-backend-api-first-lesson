import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsSalonUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  readSalon,
  type SalonRead,
  salonKeyOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { settingsHrefOf } from '../navigation'
import { SalonForm } from './components/salon-form/salon-form'
import { SettingsForbidden, useKeepsSalon } from './keeps-salon'
import { afterSalonChange, readSalonChange } from './salon-form'
import { changeSalon } from './settings-api'

const TITLE = 'サロンの情報を直す'

type SalonChangeProps = { salon: ModelsSalonResponse }

/**
 * The form of the information of the salon, opened with what the salon
 * has now. It sends what was changed and nothing else, so a value somebody
 * else changed meanwhile stays as they left it, and a form sent as it was
 * opened asks the API for nothing.
 */
const SalonChange = ({ salon }: SalonChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const key = salonKeyOf(salon.id)
  const settings = settingsHrefOf(salon.id)
  const change = useMutation({
    mutationFn: (request: ModelsSalonUpdateRequest) =>
      changeSalon(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ salon: changed }) => {
          const read: SalonRead = { type: 'found', salon: changed }
          queryClient.setQueryData(key, read)
          notify({ tone: 'success', message: 'サロンの情報を直しました。' })
          void navigate(settings)
        })
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
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
          (refused) => setSaid(afterSalonChange(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readSalonChange(values, salon))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(settings)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        change.mutate(value)
      })
      .exhaustive()

  return (
    <SalonForm
      subject={{ type: 'existing', salon }}
      submitLabel='変更を保存する'
      message={said.message}
      errors={said.errors}
      pending={change.isPending}
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
        <SalonChange salon={salon} />
      ) : (
        <LoadingIndicator label='サロンを読み込んでいます' />
      )}
    </>
  )
}

/** Changes the information of the salon of the address, for the owner, a manager and an administrator. */
export const SalonChangeScreen = () => {
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
