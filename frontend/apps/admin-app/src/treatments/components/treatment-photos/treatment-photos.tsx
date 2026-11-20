import type { ModelsTreatmentPhotoResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Dialog,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import {
  MOST_PHOTOS,
  photoNameOf,
  photoUseOf,
  roomOf,
} from '../../treatment-photos'
import styles from './treatment-photos.module.css'

export type TreatmentPhotosProps = {
  /** The photos of the record, in their order */
  photos: readonly ModelsTreatmentPhotoResponse[]
  /** The address of the screen that adds photos to the record */
  addHref: string
  /** What changed meanwhile, or what the API refused: said under the heading */
  refusal?: string | undefined
  /** The heading, which takes the focus when the dialog closes on what it changed */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The photo the dialog asks about taking away; `undefined` while the dialog is closed */
  removing: ModelsTreatmentPhotoResponse | undefined
  /** The button that takes a photo away was pressed: the dialog is to be opened */
  onOpen: (photo: ModelsTreatmentPhotoResponse) => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `removing` to `undefined` here
   */
  onClose: () => void
  /** What went wrong with the attempt, and may be tried again; it is said in the dialog */
  message?: string | undefined
  /** The removal is on its way */
  pending: boolean
  /** The removal was confirmed */
  onRemove: () => void
}

/** A photo, as the list names it: 「2 枚目：施術後の写真（側面）」. */
const photoCalled = (
  photo: ModelsTreatmentPhotoResponse,
  photos: readonly ModelsTreatmentPhotoResponse[],
): string =>
  `${photos.findIndex(({ id }) => id === photo.id) + 1} 枚目：${photoNameOf(photo)}`

/**
 * The photos of a treatment record, in their order: each its image (the
 * smaller one, when there is one) in a frame of the same shape, what it
 * shows, and how the customer let it be used. The caption says what the
 * image shows, so the image is not named twice; it is also what is read
 * when an image cannot be loaded. The image opens at its address. A photo
 * added by mistake is taken away after a dialog that asks first; the file
 * stays where the salon keeps it.
 */
export const TreatmentPhotos = ({
  photos,
  addHref,
  refusal,
  headingRef,
  removing,
  onOpen,
  onClose,
  message,
  pending,
  onRemove,
}: TreatmentPhotosProps) => (
  <Card
    title='施術写真'
    headingRef={headingRef}
    actions={
      roomOf({ photos }) > 0 ? (
        <ButtonLink href={addHref} variant='secondary'>
          写真を足す
        </ButtonLink>
      ) : undefined
    }
  >
    <div className={styles['part']}>
      {refusal !== undefined && <Alert tone='warning'>{refusal}</Alert>}
      {photos.length === 0 ? (
        <p className={styles['note']}>施術写真はありません。</p>
      ) : (
        <ul className={styles['photos']} aria-label='施術写真の一覧'>
          {photos.map((photo, index) => (
            <li key={photo.id} className={styles['photo']}>
              <figure className={styles['figure']}>
                <img
                  className={styles['image']}
                  src={photo.thumbnailUrl ?? photo.photoUrl}
                  alt=''
                  loading='lazy'
                />
                <figcaption className={styles['caption']}>
                  <span className={styles['name']}>
                    {photoCalled(photo, photos)}
                  </span>
                  {photo.description !== null && (
                    <span className={styles['description']}>
                      {photo.description}
                    </span>
                  )}
                  <span className={styles['use']}>{photoUseOf(photo)}</span>
                </figcaption>
              </figure>
              <div className={styles['actions']}>
                <a
                  href={photo.photoUrl}
                  rel='noreferrer'
                  aria-label={`${index + 1} 枚目の写真を開く`}
                >
                  写真を開く
                </a>
                <Button
                  size='small'
                  aria-label={`${index + 1} 枚目の写真を外す`}
                  onClick={() => onOpen(photo)}
                >
                  外す
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {roomOf({ photos }) === 0 && (
        <p className={styles['note']}>
          {`施術写真は、${MOST_PHOTOS} 枚まで記録できます。足すときは、写真を外してから足してください。`}
        </p>
      )}
    </div>
    <Dialog
      open={removing !== undefined}
      onClose={onClose}
      title={`${removing === undefined ? '' : photoCalled(removing, photos)}を外しますか？`}
      description='施術記録から写真を外します。外した写真は、元に戻せません。写真のファイルは、置いてある場所に残ります。'
      actions={
        <>
          <Button onClick={onClose}>戻る</Button>
          <Button variant='danger' pending={pending} onClick={onRemove}>
            外す
          </Button>
        </>
      }
    >
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
    </Dialog>
  </Card>
)
