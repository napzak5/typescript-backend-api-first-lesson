import type {
  ModelsSalonResponse,
  ModelsTreatmentPhotoBulkCreateRequest,
} from '@beauty-salon-frontend/api-client'
import { NOT_FOUND, WithSalon } from '@beauty-salon-frontend/salon-screens'
import { Alert, ButtonLink, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { treatmentHrefOf } from '../navigation'
import { PhotoForm } from './components/photo-form/photo-form'
import { customerCalled } from './treatment-format'
import {
  afterPhotosAdded,
  MOST_PHOTOS,
  photosAddedOf,
  readPhotos,
  roomOf,
} from './treatment-photos'
import {
  addTreatmentPhotos,
  TREATMENT_LISTS,
  type TreatmentRead,
  treatmentKeyOf,
} from './treatments-api'
import { type TreatmentContext, WithTreatment } from './with-treatment'

const TITLE = '施術写真を足す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
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
          notify({ tone: 'success', message: photosAddedOf(photos.length) })
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
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        adding.mutate(request)
      })
      .exhaustive()

  const quit = (
    <ButtonLink href={back} variant='quiet'>
      やめる
    </ButtonLink>
  )

  return (
    <>
      <p>{`${customerCalled(customer)}の施術記録（予約番号 ${booking.bookingNumber}）`}</p>
      {room === 0 ? (
        <>
          <Alert tone='warning'>
            {`この施術記録の写真は、${MOST_PHOTOS} 枚になりました。写真を外してから足してください。`}
          </Alert>
          <p>
            <ButtonLink href={back} variant='secondary'>
              施術記録に戻る
            </ButtonLink>
          </p>
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
          {(context) => <PhotosEntry salon={salon} {...context} />}
        </WithTreatment>
      )}
    </WithSalon>
  )
}
