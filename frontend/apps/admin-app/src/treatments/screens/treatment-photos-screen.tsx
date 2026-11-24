import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsTreatmentPhotoBulkCreateRequest,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  ButtonLink,
  type FormSays,
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
  addTreatmentPhotos,
  TREATMENT_LISTS,
  type TreatmentRead,
  treatmentKeyOf,
} from '../api/treatments-api'
import { PhotoForm } from '../components/photo-form/photo-form'
import { customerInASentence } from '../utils/treatment-format'
import {
  afterPhotosAdded,
  MOST_PHOTOS,
  readPhotos,
  roomOf,
} from '../utils/treatment-photos'
import { type TreatmentContext, WithTreatment } from './with-treatment'

const { frame, photos: PHOTOS, titles } = adminTreatmentMessages

type PhotosEntryProps = TreatmentContext & { salon: ModelsSalonResponse }

/**
 * The photos to add to a record, as many as it has room for. A record read
 * again after a 409 replaces the one the form opened with: what it holds
 * now is what the next attempt is checked against.
 */
const PhotosEntry = ({
  salon,
  record,
  booking,
  customer,
}: PhotosEntryProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const back = treatmentHrefOf(salon.id, record.id)
  const key = treatmentKeyOf(record.id)
  const room = roomOf(record)
  const adding = useMutation({
    mutationFn: (request: ModelsTreatmentPhotoBulkCreateRequest) =>
      addTreatmentPhotos(record.id, request),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'added' }, ({ photos }) => {
          const read: TreatmentRead = {
            type: 'found',
            record: { ...record, photos: [...record.photos, ...photos] },
          }
          // Shown at once, and read again for the moment it was changed at
          queryClient.setQueryData(key, read)
          void queryClient.invalidateQueries({ queryKey: key })
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          notify({ tone: 'success', message: PHOTOS.added(photos.length) })
          void navigate(back)
        })
        // The record was removed meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.removeQueries({ queryKey: TREATMENT_LISTS })
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .with({ type: 'held' }, (held) => {
          const read: TreatmentRead = { type: 'found', record: held.record }
          queryClient.setQueryData(key, read)
          setSaid(afterPhotosAdded(held, request))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterPhotosAdded(refused, request)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readPhotos(values, record))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'noRoom' }, ({ message }) =>
        setSaid({ message, errors: {} }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        adding.mutate(value)
      })
      .exhaustive()

  const quit = (
    <ButtonLink href={back} variant='quiet'>
      {say(PHOTOS.form.cancel)}
    </ButtonLink>
  )

  return (
    <>
      <p>
        {say(
          frame.recordOf(customerInASentence(customer), booking.bookingNumber),
        )}
      </p>
      {room === 0 ? (
        <>
          <Alert tone='warning'>{say(PHOTOS.full(MOST_PHOTOS))}</Alert>
          <ButtonLink href={back}>{say(PHOTOS.toRecord)}</ButtonLink>
        </>
      ) : (
        <PhotoForm
          room={room}
          message={said.message}
          errors={said.errors}
          pending={adding.isPending}
          onSubmit={submit}
          actions={quit}
        />
      )}
    </>
  )
}

/** Adds photos to a treatment record of the salon of the address. */
export const TreatmentPhotosScreen = () => {
  const say = useSay()
  const { salonId = '', treatmentId = '' } = useParams()
  const title = say(titles.photos)

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
          {(context) => <PhotosEntry salon={salon} {...context} />}
        </WithTreatment>
      )}
    </WithSalon>
  )
}
