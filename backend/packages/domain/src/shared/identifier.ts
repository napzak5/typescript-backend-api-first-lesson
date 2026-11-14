import { z } from 'zod'

/**
 * A UUID, brought into the spelling the database uses. The letters of a UUID
 * may be written in either case (RFC 9562, section 4), so one ID has several
 * spellings, and PostgreSQL always returns the lower-case one. An ID that
 * comes from a request is therefore turned into lower case when it is
 * checked: wherever two IDs are compared as strings, the same row has the
 * same ID.
 */
export const uuidSchema = z.uuid().toLowerCase()
