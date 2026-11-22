import type { ModelsSalonCreateRequest } from '@beauty-salon-frontend/api-client'
import {
  SALON_CHOICES,
  type SalonRead,
  salonKeyOf,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { settingsHrefOf } from '../navigation'
import { SalonForm } from './components/salon-form/salon-form'
import { useAddsSalon } from './keeps-salon'
import { afterSalonEntry, readSalonEntry } from './salon-form'
import { addSalon } from './settings-api'

const TITLE = 'サロンを登録する'

/**
 * The form of a salon to be added. The salon added is shown in its
 * settings, where its hours are given next; it takes no bookings online
 * until it is told to.
 */
const SalonEntry = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const addition = useMutation({
    mutationFn: (request: ModelsSalonCreateRequest) => addSalon(request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'added' }, ({ salon }) => {
          const read: SalonRead = { type: 'found', salon }
          queryClient.setQueryData(salonKeyOf(salon.id), read)
          queryClient.removeQueries({ queryKey: SALON_CHOICES })
          notify({
            tone: 'success',
            message: `サロン「${salon.name}」を登録しました。営業時間とメニューを入れてから、オンライン予約を受け付けてください。`,
          })
          void navigate(settingsHrefOf(salon.id))
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
          (refused) => setSaid(afterSalonEntry(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readSalonEntry(values))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        addition.mutate(value)
      })
      .exhaustive()

  return (
    <SalonForm
      subject={{ type: 'new' }}
      submitLabel='サロンを登録する'
      message={said.message}
      errors={said.errors}
      pending={addition.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href='/' variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Adds a salon, for an administrator. */
export const SalonEntryScreen = () => {
  const adds = useAddsSalon()

  return (
    <>
      <PageHeader
        title={TITLE}
        description='営業時間は、登録したあと、サロンの設定から入れます。'
      />
      {adds ? (
        <SalonEntry />
      ) : (
        <>
          <p>
            このアカウントでは、サロンを登録できません。サロンを登録できるのは、管理者です。
          </p>
          <ButtonLink href='/'>トップへ戻る</ButtonLink>
        </>
      )}
    </>
  )
}
