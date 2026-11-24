import type {
  ModelsSalonResponse,
  ModelsStaffCreateRequest,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { staffLedgerHrefOf, staffMemberHrefOf } from '../../navigation'
import {
  attemptStaffEntry,
  STAFF_LISTS,
  type StaffRead,
  staffKeyOf,
} from '../api/staff-api'
import { StaffForm } from '../components/staff-form/staff-form'
import { afterStaffWrite, readStaffEntry } from '../utils/staff-form'
import { StaffLedgerForbidden, useKeepsStaffLedger } from './with-staff-member'

const { entry: ENTRY, titles, words } = adminStaffMessages

type StaffEntryProps = { salon: ModelsSalonResponse }

/**
 * The form of a new member of the ledger. The member the API answers with
 * is what their page shows at once; the lists of the ledger that were read
 * are dropped, since the new member belongs in them.
 */
const StaffEntry = ({ salon }: StaffEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const say = useSay()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const entry = useMutation({
    mutationFn: (request: ModelsStaffCreateRequest) =>
      attemptStaffEntry(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ member }) => {
          const read: StaffRead = { type: 'found', member }
          queryClient.setQueryData(staffKeyOf(member.id), read)
          queryClient.removeQueries({ queryKey: STAFF_LISTS })
          notify({
            tone: 'success',
            message: ENTRY.done(member.displayName),
          })
          void navigate(staffMemberHrefOf(salon.id, member.id))
        })
        .with(
          {
            type: P.union(
              'invalid',
              'duplicate',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterStaffWrite(refused, 'entry')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readStaffEntry(values))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <StaffForm
      member={null}
      submitLabel={say(ENTRY.submit)}
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={staffLedgerHrefOf(salon.id)} variant='quiet'>
          {say(words.cancel)}
        </ButtonLink>
      }
    />
  )
}

/**
 * Registers a member in the staff ledger: one who joins the salon, before
 * their first day as well.
 */
export const StaffEntryScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsStaffLedger()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.entry)}>
      {(salon) => (
        <>
          <PageHeader title={say(titles.entry)} description={salon.name} />
          {keeps ? (
            <StaffEntry key={salon.id} salon={salon} />
          ) : (
            <StaffLedgerForbidden />
          )}
        </>
      )}
    </WithSalon>
  )
}
