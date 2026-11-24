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
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { settingsHrefOf } from '../../navigation'
import { addSalon } from '../api/settings-api'
import { SalonForm } from '../components/salon-form/salon-form'
import { afterSalonEntry, readSalonEntry } from '../utils/salon-form'
import { useAddsSalon } from './keeps-salon'

const { entry, titles, words } = adminSettingsMessages

/**
 * The form of a salon to be added. The salon added is shown in its
 * settings, where its hours are given next; it takes no bookings online
 * until it is told to.
 */
const SalonEntry = () => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const addition = useMutation({
    mutationFn: (request: ModelsSalonCreateRequest) => addSalon(request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'added' }, ({ salon }) => {
          const read: SalonRead = { type: 'found', salon }
          queryClient.setQueryData(salonKeyOf(salon.id), read)
          queryClient.removeQueries({ queryKey: SALON_CHOICES })
          notify({ tone: 'success', message: entry.added(salon.name) })
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
      submitLabel={say(entry.submit)}
      message={said.message}
      errors={said.errors}
      pending={addition.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href='/' variant='quiet'>
          {say(words.cancel)}
        </ButtonLink>
      }
    />
  )
}

/** Adds a salon, for an administrator. */
export const SalonEntryScreen = () => {
  const adds = useAddsSalon()
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(titles.entry)}
        description={say(entry.description)}
      />
      {adds ? (
        <SalonEntry />
      ) : (
        <>
          <p>{say(entry.forbidden)}</p>
          <ButtonLink href='/'>{say(entry.toStart)}</ButtonLink>
        </>
      )}
    </>
  )
}
