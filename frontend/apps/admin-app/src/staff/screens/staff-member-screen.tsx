import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSignedInUser } from '@beauty-salon-frontend/session'
import {
  Actions,
  Alert,
  Button,
  ButtonLink,
  Dialog,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  scheduleHrefOf,
  staffAccountHrefOf,
  staffChangeHrefOf,
  staffLedgerHrefOf,
} from '../../navigation'
import { removeStaffMember, STAFF_LISTS, staffKeyOf } from '../api/staff-api'
import { StaffRecord } from '../components/staff-record/staff-record'
import { afterStaffRemoval, isOwnStaffRecord } from '../utils/staff-format'
import { WithStaffMember } from './with-staff-member'

const { member: MEMBER, removal: REMOVAL, titles } = adminStaffMessages

type MemberPartProps = {
  salon: ModelsSalonResponse
  member: ModelsStaffResponse
}

/**
 * A member of the ledger, with the way to change them and to remove them
 * after a dialog has asked, and the way to their schedule, which an
 * inactive member keeps as well. The member the account is linked to is not
 * offered for removal: the account would lock itself out of the salon. A
 * removed member is gone from the ledger they were found in.
 */
const MemberPart = ({ salon, member }: MemberPartProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const say = useSay()
  const userId = useSignedInUser()?.id
  const [removing, setRemoving] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
  /** What the API refused: said above the member */
  const [refusal, setRefusal] = useState<LocalizedText>()
  const own = isOwnStaffRecord(member, userId)
  const key = staffKeyOf(member.id)

  const removal = useMutation({
    mutationFn: () => removeStaffMember(salon.id, member.id),
    onSuccess: (outcome) =>
      match(afterStaffRemoval(outcome, member.displayName))
        .with({ type: 'done' }, ({ message: done }) => {
          queryClient.removeQueries({ queryKey: STAFF_LISTS })
          queryClient.setQueryData(key, NOT_FOUND)
          notify({ tone: 'success', message: done })
          void navigate(staffLedgerHrefOf(salon.id))
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setRemoving(false)
          setRefusal(refused)
        })
        .with({ type: 'gone' }, () => {
          setRemoving(false)
          queryClient.removeQueries({ queryKey: STAFF_LISTS })
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .exhaustive(),
  })

  const close = (): void => {
    setRemoving(false)
    setMessage(undefined)
  }

  return (
    <>
      {own && <p>{say(MEMBER.own)}</p>}
      {refusal !== undefined && <Alert tone='danger'>{say(refusal)}</Alert>}
      <StaffRecord
        member={member}
        timezone={salon.timezone}
        currency={salon.currency}
        actions={
          <>
            <ButtonLink href={staffChangeHrefOf(salon.id, member.id)}>
              {say(MEMBER.change)}
            </ButtonLink>
            {!own && (
              <Button
                variant='danger'
                onClick={() => {
                  setRefusal(undefined)
                  setRemoving(true)
                }}
              >
                {say(REMOVAL.remove)}
              </Button>
            )}
          </>
        }
      />
      <Actions>
        <ButtonLink href={scheduleHrefOf(salon.id, member.id)}>
          {say(MEMBER.schedule)}
        </ButtonLink>
        <ButtonLink href={staffAccountHrefOf(salon.id, member.id)}>
          {say(MEMBER.account)}
        </ButtonLink>
      </Actions>
      {!own && (
        <Dialog
          open={removing}
          onClose={close}
          title={say(REMOVAL.title(member.displayName))}
          description={say(REMOVAL.description)}
          actions={
            <>
              <Button onClick={close}>{say(REMOVAL.back)}</Button>
              <Button
                variant='danger'
                pending={removal.isPending}
                onClick={() => {
                  setMessage(undefined)
                  removal.mutate()
                }}
              >
                {say(REMOVAL.submit)}
              </Button>
            </>
          }
        >
          {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
        </Dialog>
      )}
    </>
  )
}

/** A member of the staff ledger of the salon of the address. */
export const StaffMemberScreen = () => {
  const { salonId = '', staffId = '' } = useParams()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.member)}>
      {(salon) => (
        <WithStaffMember
          key={staffId}
          salon={salon}
          title={say(titles.member)}
          fresh={false}
        >
          {(member) => <MemberPart salon={salon} member={member} />}
        </WithStaffMember>
      )}
    </WithSalon>
  )
}
