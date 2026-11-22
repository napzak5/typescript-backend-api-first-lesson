import {
  treatmentMaterials,
  treatmentPhotos,
} from '@beauty-salon-backend/database'
import type {
  DbTreatmentMaterial,
  DbTreatmentPhoto,
} from '@beauty-salon-backend/domain'
import { asc, inArray } from 'drizzle-orm'
import type { DatabaseExecutor } from '../../database/index'

/** The materials and the photos of the records, by the record, each in its order. */
export const detailsOf = async (
  executor: DatabaseExecutor,
  recordIds: string[],
): Promise<{
  materials: Map<string, DbTreatmentMaterial[]>
  photos: Map<string, DbTreatmentPhoto[]>
}> => {
  const [materialRows, photoRows] =
    recordIds.length === 0
      ? [[], []]
      : [
          await executor
            .select()
            .from(treatmentMaterials)
            .where(inArray(treatmentMaterials.treatmentRecordId, recordIds))
            .orderBy(
              asc(treatmentMaterials.treatmentRecordId),
              asc(treatmentMaterials.sortOrder),
            ),
          await executor
            .select()
            .from(treatmentPhotos)
            .where(inArray(treatmentPhotos.treatmentRecordId, recordIds))
            .orderBy(
              asc(treatmentPhotos.treatmentRecordId),
              asc(treatmentPhotos.sortOrder),
              asc(treatmentPhotos.createdAt),
              asc(treatmentPhotos.id),
            ),
        ]
  const materials = new Map<string, DbTreatmentMaterial[]>()
  for (const row of materialRows) {
    materials.set(row.treatmentRecordId, [
      ...(materials.get(row.treatmentRecordId) ?? []),
      row,
    ])
  }
  const photos = new Map<string, DbTreatmentPhoto[]>()
  for (const row of photoRows) {
    photos.set(row.treatmentRecordId, [
      ...(photos.get(row.treatmentRecordId) ?? []),
      row,
    ])
  }
  return { materials, photos }
}
