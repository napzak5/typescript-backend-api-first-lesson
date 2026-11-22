import { TreatmentPhotoTypeSchema } from '@beauty-salon-backend/generated'
import { asOneString } from '@beauty-salon-shared/i18n'
import { treatmentRecordMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import type {
  ApiTreatmentPhotoBulkCreateRequest,
  ApiTreatmentPhotoCreateRequest,
} from '../models/treatment-record'
import { MAX_INTEGER, nonBlankText } from './rules'

/**
 * Validation of the photos added to a treatment record. The shapes are
 * checked against the generated API types, the limits are those of the
 * database columns, and the remaining rules are business rules. How many
 * photos the record holds, and which addresses, is looked at where they
 * are written (`photoAdditionRefusal`).
 */

/**
 * A photo shown outside the salon is one the customer consented to. The
 * issue lets the rules of the list of photos run as well.
 */
const treatmentPhotoSchema = z
  .strictObject({
    photoType: TreatmentPhotoTypeSchema,
    photoUrl: z.httpUrl().max(500),
    thumbnailUrl: z.httpUrl().max(500).nullable(),
    angle: nonBlankText.max(50).nullable(),
    description: nonBlankText.nullable(),
    isPublic: z.boolean(),
    customerConsent: z.boolean(),
    sortOrder: z.number().int().min(0).max(MAX_INTEGER),
  })
  .check((context) => {
    if (context.value.isPublic && !context.value.customerConsent) {
      context.issues.push({
        code: 'custom',
        path: ['isPublic'],
        message: asOneString(treatmentRecordMessages.publicNeedsConsent),
        input: context.value.isPublic,
        continue: true,
      })
    }
  }) satisfies z.ZodType<ApiTreatmentPhotoCreateRequest>

/** The most photos one request adds. */
const MAX_PHOTOS_OF_REQUEST = 20

/**
 * The photos of one addition: a photo that has the address or the place
 * of an earlier one is reported. The record holds one photo of an address,
 * and the photos of one addition are put in order by their places alone.
 */
export const treatmentPhotoBulkCreateRequestSchema = z.strictObject({
  photos: z
    .array(treatmentPhotoSchema)
    .min(1)
    .max(MAX_PHOTOS_OF_REQUEST)
    .check((context) => {
      const addresses = new Set<string>()
      const places = new Set<number>()
      context.value.forEach(({ photoUrl, sortOrder }, index) => {
        if (addresses.has(photoUrl)) {
          context.issues.push({
            code: 'custom',
            path: [index, 'photoUrl'],
            message: asOneString(
              treatmentRecordMessages.noRepeatedPhotoAddress,
            ),
            input: photoUrl,
            continue: true,
          })
        }
        if (places.has(sortOrder)) {
          context.issues.push({
            code: 'custom',
            path: [index, 'sortOrder'],
            message: asOneString(
              treatmentRecordMessages.noRepeatedPhotoSortOrder,
            ),
            input: sortOrder,
            continue: true,
          })
        }
        addresses.add(photoUrl)
        places.add(sortOrder)
      })
    }),
}) satisfies z.ZodType<ApiTreatmentPhotoBulkCreateRequest>

/** Photos that passed the rules of their own. */
export type TreatmentPhotoBulkCreateRequest = z.infer<
  typeof treatmentPhotoBulkCreateRequestSchema
>
