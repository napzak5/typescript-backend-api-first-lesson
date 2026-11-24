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
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
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
import { customerInASentence } from '../utils/treatment-format'
import { type TreatmentContext, WithTreatment } from './with-treatment'

const { form, frame, titles } = adminTreatmentMessages
const { change: CHANGE } = form

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
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const customerName = customerInASentence(customer)
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
            message: treatmentWrittenOf(customerName, 'change'),
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
      <p>{say(frame.recordOf(customerName, booking.bookingNumber))}</p>
      <TreatmentForm
        booking={booking}
        record={record}
        staff={staff}
        services={services}
        products={products}
        submitLabel={say(CHANGE.submit)}
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={submit}
        actions={
          <ButtonLink href={back} variant='quiet'>
            {say(CHANGE.cancel)}
          </ButtonLink>
        }
      />
    </>
  )
}

/** Changes a treatment record of the salon of the address. */
export const TreatmentChangeScreen = () => {
  const say = useSay()
  const { salonId = '', treatmentId = '' } = useParams()
  const title = say(titles.change)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithTreatment
          key={treatmentId}
          salon={salon}
          treatmentId={treatmentId}
          title={title}
          fresh
        >
          {(context) => <TreatmentChange salon={salon} {...context} />}
        </WithTreatment>
      )}
    </WithSalon>
  )
}
