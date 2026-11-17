import type { PhotoAdditionRefusal } from '../../../models/treatment-record'

/** The most photos a record holds: its get and the list return them all. */
export const MAX_PHOTOS_OF_RECORD = 20

/**
 * Whether a record that holds photos at the addresses `held` takes the
 * photos of an addition. An address it holds comes first, as a request
 * that was sent twice is told so; then a number beyond the most.
 */
export const photoAdditionRefusal = (
  held: readonly string[],
  adding: readonly { photoUrl: string }[],
): PhotoAdditionRefusal | null => {
  const holds = new Set(held)
  const repeated = adding.find(({ photoUrl }) => holds.has(photoUrl))
  if (repeated !== undefined) {
    return { type: 'photoExists', photoUrl: repeated.photoUrl }
  }
  return held.length + adding.length > MAX_PHOTOS_OF_RECORD
    ? { type: 'tooManyPhotos', held: held.length }
    : null
}
