import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
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
  bookingHrefOf,
  customerHrefOf,
  treatmentChangeHrefOf,
  treatmentsHrefOf,
} from '../navigation'
import { NOT_FOUND } from '../reading'
import { dayNameOf } from '../salon-time'
import { WithSalon } from '../salons/with-salon'
import { TreatmentRecord } from './components/treatment-record/treatment-record'
import {
  afterTreatmentRemoval,
  customerCalled,
  mayRemoveTreatments,
} from './treatment-format'
import {
  removeTreatment,
  TREATMENT_LISTS,
  treatmentKeyOf,
} from './treatments-api'
import { type TreatmentContext, WithTreatment } from './with-treatment'

const TITLE = '施術記録の内容'

type RecordPartProps = TreatmentContext & { salon: ModelsSalonResponse }

/**
 * A treatment record, with the way to change it, and, for the owner, a
 * manager and an administrator, its removal after a dialog has asked.
 * A removed record is gone from the list it was found in.
 */
const RecordPart = ({
  salon,
  record,
  booking,
  customer,
  staff,
  services,
  products,
}: RecordPartProps) => {
  const session = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [removing, setRemoving] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  /** What the API refused: said above the record */
  const [refusal, setRefusal] = useState<string>()
  const name = customerCalled(customer)
  const removable =
    session.type === 'signedIn' && mayRemoveTreatments(session.user.role)

  const removal = useMutation({
    mutationFn: () => removeTreatment(record.id),
    onSuccess: (outcome) =>
      match(afterTreatmentRemoval(outcome, name))
        .with({ type: 'done' }, ({ message: done }) => {
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          queryClient.setQueryData(treatmentKeyOf(record.id), NOT_FOUND)
          notify({ tone: 'success', message: done })
          void navigate(treatmentsHrefOf(salon.id))
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setRemoving(false)
          setRefusal(refused)
        })
        .with({ type: 'gone' }, () => {
          setRemoving(false)
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          queryClient.setQueryData(treatmentKeyOf(record.id), NOT_FOUND)
        })
        .exhaustive(),
  })

  const close = (): void => {
    setRemoving(false)
    setMessage(undefined)
  }

  return (
    <>
      {refusal !== undefined && <Alert tone='danger'>{refusal}</Alert>}
      <TreatmentRecord
        record={record}
        timezone={salon.timezone}
        bookingName={`${booking.bookingNumber}（${dayNameOf(booking.bookingDate)}）`}
        bookingHref={bookingHrefOf(salon.id, booking.id)}
        customer={customer}
        customerHref={customerHrefOf(salon.id, record.customerId)}
        staff={staff}
        services={services}
        products={products}
        actions={
          <>
            <ButtonLink
              href={treatmentChangeHrefOf(salon.id, record.id)}
              variant='secondary'
            >
              施術記録を直す
            </ButtonLink>
            {removable && (
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
      {removable && (
        <Dialog
          open={removing}
          onClose={close}
          title={`${name}の施術記録を削除しますか？`}
          description='間違えて書いた施術記録を、使った商材と写真と一緒に削除します。削除した施術記録は、元に戻せません。'
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

/** A treatment record of the salon of the address. */
export const TreatmentScreen = () => {
  const { salonId = '', treatmentId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithTreatment
          key={treatmentId}
          salon={salon}
          treatmentId={treatmentId}
          title={TITLE}
          fresh={false}
        >
          {(context) => <RecordPart salon={salon} {...context} />}
        </WithTreatment>
      )}
    </WithSalon>
  )
}
