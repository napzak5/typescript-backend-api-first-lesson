import type { ModelsTreatmentPhotoResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Dialog,
  EmptyState,
  Note,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import {
  MOST_PHOTOS,
  photoNameOf,
  photoUseOf,
  roomOf,
} from '../../utils/treatment-photos'
import styles from './treatment-photos.module.css'

const { list: LIST, removal: REMOVAL } = adminTreatmentMessages.photos

export type TreatmentPhotosProps = {
  /** The photos of the record, in their order */
  photos: readonly ModelsTreatmentPhotoResponse[]
  /** The address of the screen that adds photos to the record */
  addHref: string
  /** What changed meanwhile, or what the API refused: said under the heading */
  refusal?: LocalizedText | undefined
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
  message?: LocalizedText | undefined
  /** The removal is on its way */
  pending: boolean
  /** The removal was confirmed */
  onRemove: () => void
}

/** A photo, as the list names it: 「2 枚目：施術後の写真（側面）」. */
const photoCalled = (
  photo: ModelsTreatmentPhotoResponse,
  photos: readonly ModelsTreatmentPhotoResponse[],
): LocalizedText =>
  LIST.photoAt(
    photos.findIndex(({ id }) => id === photo.id) + 1,
    photoNameOf(photo),
  )

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
}: TreatmentPhotosProps) => {
  const say = useSay()

  return (
    <Card
      title={say(LIST.title)}
      headingRef={headingRef}
      actions={
        roomOf({ photos }) > 0 ? (
          <ButtonLink href={addHref}>{say(LIST.add)}</ButtonLink>
        ) : undefined
      }
    >
      <div className={styles['part']}>
        {refusal !== undefined && <Alert tone='warning'>{say(refusal)}</Alert>}
        {photos.length === 0 ? (
          <EmptyState kind='part' title={say(LIST.none)} />
        ) : (
          <ul className={styles['photos']} aria-label={say(LIST.label)}>
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
                      {say(photoCalled(photo, photos))}
                    </span>
                    {photo.description !== null && (
                      <WrittenText>{photo.description}</WrittenText>
                    )}
                    <span className={styles['use']}>
                      {say(photoUseOf(photo))}
                    </span>
                  </figcaption>
                </figure>
                <div className={styles['actions']}>
                  <a
                    href={photo.photoUrl}
                    rel='noreferrer'
                    aria-label={say(LIST.openOf(index + 1))}
                  >
                    {say(LIST.open)}
                  </a>
                  <Button
                    size='small'
                    aria-label={say(LIST.removeOf(index + 1))}
                    onClick={() => onOpen(photo)}
                  >
                    {say(LIST.remove)}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {roomOf({ photos }) === 0 && <Note>{say(LIST.full(MOST_PHOTOS))}</Note>}
      </div>
      <Dialog
        open={removing !== undefined}
        onClose={onClose}
        title={
          removing === undefined
            ? ''
            : say(REMOVAL.title(photoCalled(removing, photos)))
        }
        description={say(REMOVAL.description)}
        actions={
          <>
            <Button onClick={onClose}>{say(REMOVAL.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              {say(REMOVAL.submit)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
