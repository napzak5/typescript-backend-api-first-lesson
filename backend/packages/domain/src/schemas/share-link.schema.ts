import { z } from 'zod'
import {
  type ApiSharedFileDownloadUrlRequest,
  type ApiSharedFileGetRequest,
  type ApiShareLinkCreateRequest,
  type ApiShareLinkSearchRequest,
  shareLinkIdSchema,
} from '../models/share-link'
import { MAX_INTEGER, momentInUtc, passwordOf } from './rules'

/**
 * Validation of the requests of the share links. The limits are those of
 * the database columns; how long a link may work and which passwords are
 * refused as too easy to guess are decided by the use case, which knows
 * the moment the link is created at.
 */

/**
 * Shorter than the password of an account may be: it is asked for on top
 * of a token nobody guesses, and the guesses at it are limited for each
 * link.
 */
const MIN_SHARE_PASSWORD_LENGTH = 8

/** The token of a link; what it must look like is not told. */
const shareTokenSchema = z.string().min(1).max(255)

/** A password a viewer presents; it is not held to the rules for new ones. */
const presentedPasswordSchema = passwordOf(1)

export const shareLinkCreateRequestSchema = z.strictObject({
  expiresAt: momentInUtc,
  maxDownloads: z.number().int().min(1).max(MAX_INTEGER).nullable(),
  password: passwordOf(MIN_SHARE_PASSWORD_LENGTH).nullable(),
}) satisfies z.ZodType<ApiShareLinkCreateRequest>

export const shareLinkSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: shareLinkIdSchema.exactOptional(),
}) satisfies z.ZodType<ApiShareLinkSearchRequest>

export const sharedFileGetRequestSchema = z.strictObject({
  token: shareTokenSchema,
  password: presentedPasswordSchema.nullable(),
}) satisfies z.ZodType<ApiSharedFileGetRequest>

export const sharedFileDownloadUrlRequestSchema = z.strictObject({
  token: shareTokenSchema,
  password: presentedPasswordSchema.nullable(),
  inline: z.boolean(),
}) satisfies z.ZodType<ApiSharedFileDownloadUrlRequest>

/** A search that was checked: its cursor is the ID of a share link. */
export type ShareLinkSearchRequest = z.infer<
  typeof shareLinkSearchRequestSchema
>
