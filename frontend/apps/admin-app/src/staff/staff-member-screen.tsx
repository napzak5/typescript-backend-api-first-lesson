import type {
  ModelsSalonResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { NOT_FOUND, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  ButtonLink,
  Dialog,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  scheduleHrefOf,
  staffAccountHrefOf,
  staffChangeHrefOf,
  staffLedgerHrefOf,
} from '../navigation'
import { StaffRecord } from './components/staff-record/staff-record'
import { removeStaffMember, STAFF_LISTS, staffKeyOf } from './staff-api'
import {
  afterStaffRemoval,
  isOwnStaffRecord,
  staffCalled,
} from './staff-format'
import styles from './staff-member-screen.module.css'
import { useSignedInUserId, WithStaffMember } from './with-staff-member'

const TITLE = 'スタッフの内容'

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
  const userId = useSignedInUserId()
  const [removing, setRemoving] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  /** What the API refused: said above the member */
  const [refusal, setRefusal] = useState<string>()
  const own = isOwnStaffRecord(member, userId)
  const name = staffCalled(member)
  const key = staffKeyOf(member.id)

  const removal = useMutation({
    mutationFn: () => removeStaffMember(salon.id, member.id),
    onSuccess: (outcome) =>
      match(afterStaffRemoval(outcome, name))
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
      {own && (
        <p>
          ご自身のスタッフ情報です。このアカウントからは、無効にすることも、削除することもできません。
        </p>
      )}
      {refusal !== undefined && <Alert tone='danger'>{refusal}</Alert>}
      <StaffRecord
        member={member}
        timezone={salon.timezone}
        currency={salon.currency}
        actions={
          <>
            <ButtonLink
              href={staffChangeHrefOf(salon.id, member.id)}
              variant='secondary'
            >
              スタッフ情報を直す
            </ButtonLink>
            {!own && (
              <Button
                variant='danger'
                onClick={() => {
                  setRefusal(undefined)
                  setRemoving(true)
                }}
              >
                削除
              </Button>
            )}
          </>
        }
      />
      <p className={styles['ways']}>
        <ButtonLink
          href={scheduleHrefOf(salon.id, member.id)}
          variant='secondary'
        >
          勤務スケジュール
        </ButtonLink>
        <ButtonLink
          href={staffAccountHrefOf(salon.id, member.id)}
          variant='secondary'
        >
          ログインアカウント
        </ButtonLink>
      </p>
      {!own && (
        <Dialog
          open={removing}
          onClose={close}
          title={`${name}を、スタッフ台帳から削除しますか？`}
          description='削除したスタッフは、元に戻せません。担当した予約や施術記録は残ります。紐づいたログインアカウントは、サロンの画面を使えなくなります。スタッフコードは、ほかのスタッフに使えないままです。休職や退職の手続きの間は、削除せずに無効にしてください。'
          actions={
            <>
              <Button onClick={close}>戻る</Button>
              <Button
                variant='danger'
                pending={removal.isPending}
                onClick={() => {
                  setMessage(undefined)
                  removal.mutate()
                }}
              >
                削除する
              </Button>
            </>
          }
        >
          {message !== undefined && <Alert tone='danger'>{message}</Alert>}
        </Dialog>
      )}
    </>
  )
}

/** A member of the staff ledger of the salon of the address. */
export const StaffMemberScreen = () => {
  const { salonId = '', staffId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithStaffMember
          key={staffId}
          salon={salon}
          title={TITLE}
          fresh={false}
        >
          {(member) => <MemberPart salon={salon} member={member} />}
        </WithStaffMember>
      )}
    </WithSalon>
  )
}
