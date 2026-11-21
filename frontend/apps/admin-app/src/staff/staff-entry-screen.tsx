import type {
  ModelsSalonResponse,
  ModelsStaffCreateRequest,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
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
import { staffLedgerHrefOf, staffMemberHrefOf } from '../navigation'
import { StaffForm } from './components/staff-form/staff-form'
import {
  attemptStaffEntry,
  STAFF_LISTS,
  type StaffRead,
  staffKeyOf,
} from './staff-api'
import { afterStaffWrite, readStaffEntry } from './staff-form'
import { staffCalled } from './staff-format'
import { StaffLedgerForbidden, useKeepsStaffLedger } from './with-staff-member'

const TITLE = 'スタッフを登録する'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

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
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
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
            message: `${staffCalled(member)}を、スタッフ台帳に登録しました。`,
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
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        entry.mutate(request)
      })
      .exhaustive()

  return (
    <StaffForm
      member={null}
      submitLabel='登録する'
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={staffLedgerHrefOf(salon.id)} variant='quiet'>
          やめる
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

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
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
