import type { ApiTreatmentRecordSearchRequest } from '@beauty-salon-backend/domain'
import { treatmentRecordMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the list of treatment records that is not text, as its type. */
export const decodeTreatmentRecordSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiTreatmentRecordSearchRequest, 'limit'>>,
  treatmentRecordMessages.invalidTreatmentRecordSearch,
)
