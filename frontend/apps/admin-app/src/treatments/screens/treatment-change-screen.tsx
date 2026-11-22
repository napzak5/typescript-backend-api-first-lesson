import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsTreatmentRecordUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { treatmentHrefOf } from '../../navigation'
import {
  TREATMENT_LISTS,
  type TreatmentRead,
  treatmentKeyOf,
  updateTreatment,
} from '../api/treatments-api'
import { TreatmentForm } from '../components/treatment-form/treatment-form'
import {
  afterTreatmentWrite,
  readTreatmentChange,
  treatmentWrittenOf,
} from '../utils/treatment-form'
import { customerCalled } from '../utils/treatment-format'
import { type TreatmentContext, WithTreatment } from './with-treatment'

const TITLE = '施術記録を直す'

type TreatmentChangeProps = TreatmentContext & { salon: ModelsSalonResponse }

/**
 * The form of a record, opened with what is stored. It sends what was
 * changed and nothing else, and a form sent as it was opened asks the API
 * for nothing: what another account wrote meanwhile stays, unless the
 * same value was changed here.
 */
const TreatmentChange = ({
  salon,
  record,
  booking,
  customer,
  staff,
  services,
  products,
}: TreatmentChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const back = treatmentHrefOf(salon.id, record.id)
  const context = { products, bookingDay: booking.bookingDate }
  const change = useMutation({
    mutationFn: (request: ModelsTreatmentRecordUpdateRequest) =>
      updateTreatment(record.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ record: changed }) => {
          const read: TreatmentRead = { type: 'found', record: changed }
          queryClient.setQueryData(treatmentKeyOf(record.id), read)
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          notify({
            tone: 'success',
            message: treatmentWrittenOf(customerCalled(customer), 'change'),
          })
          void navigate(back)
        })
        // The record was removed meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          queryClient.setQueryData(treatmentKeyOf(record.id), NOT_FOUND)
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) =>
            setSaid(
              afterTreatmentWrite(refused, 'change', booking.bookingDate),
            ),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readTreatmentChange(values, record, context))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        change.mutate(value)
      })
      .exhaustive()

  return (
    <>
      <p>{`${customerCalled(customer)}の施術記録（予約番号 ${booking.bookingNumber}）`}</p>
      <TreatmentForm
        booking={booking}
        record={record}
        staff={staff}
        services={services}
        products={products}
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
    </>
  )
}

/** Changes a treatment record of the salon of the address. */
export const TreatmentChangeScreen = () => {
  const { salonId = '', treatmentId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithTreatment
          key={treatmentId}
          salon={salon}
          treatmentId={treatmentId}
          title={TITLE}
          fresh
        >
          {(context) => <TreatmentChange salon={salon} {...context} />}
        </WithTreatment>
      )}
    </WithSalon>
  )
}
