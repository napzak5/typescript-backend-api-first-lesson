import type {
  ModelsSalonResponse,
  ModelsStaffResponse,
  ModelsStaffUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { NOT_FOUND, WithSalon } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { staffMemberHrefOf } from '../navigation'
import { StaffForm } from './components/staff-form/staff-form'
import {
  attemptStaffChange,
  STAFF_LISTS,
  type StaffRead,
  staffKeyOf,
} from './staff-api'
import { afterStaffWrite, readStaffChange } from './staff-form'
import { isOwnStaffRecord } from './staff-format'
import { useSignedInUserId, WithStaffMember } from './with-staff-member'

const TITLE = 'スタッフ情報を直す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type StaffChangeProps = {
  salon: ModelsSalonResponse
  member: ModelsStaffResponse
}

/**
 * The form of a member, opened with what the ledger has of them. It sends
 * what was changed and nothing else, and a form sent as it was opened asks
 * the API for nothing: what another owner wrote meanwhile stays, unless the
 * same value was changed here. The member the account is linked to stays
 * active. The member the API answers with is what their page shows at
 * once; the lists that were read are dropped.
 */
const StaffChange = ({ salon, member }: StaffChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const userId = useSignedInUserId()
  const own = isOwnStaffRecord(member, userId)
  const key = staffKeyOf(member.id)
  const back = staffMemberHrefOf(salon.id, member.id)
  const change = useMutation({
    mutationFn: (request: ModelsStaffUpdateRequest) =>
      attemptStaffChange(salon.id, member.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ member: changed }) => {
          const read: StaffRead = { type: 'found', member: changed }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: STAFF_LISTS })
          notify({ tone: 'success', message: 'スタッフ情報を直しました。' })
          void navigate(back)
        })
        // The member was removed from the ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.removeQueries({ queryKey: STAFF_LISTS })
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with(
          {
            type: P.union(
              'invalid',
              'duplicate',
              'ownRecord',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterStaffWrite(refused, 'change')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readStaffChange(values, member, own))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更はありませんでした。' })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        change.mutate(request)
      })
      .exhaustive()

  return (
    <StaffForm
      member={member}
      submitLabel='変更を保存する'
      message={said.message}
      errors={said.errors}
      pending={change.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Changes what the staff ledger keeps of a member, below the salon of the address. */
export const StaffChangeScreen = () => {
  const { salonId = '', staffId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithStaffMember key={staffId} salon={salon} title={TITLE} fresh>
          {(member) => <StaffChange salon={salon} member={member} />}
        </WithStaffMember>
      )}
    </WithSalon>
  )
}
