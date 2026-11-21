import {
  type ModelsSharedFileResponse,
  sharedFileCrudGet,
  sharedFileCrudGetDownloadUrl,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { outsideTheContract } from '../outside-the-contract'
import type { Unread } from '../salons/salons-api'

/*
 * A file that a salon shares with somebody who has no account: the token of
 * the share link stands for the right to see it, and its password, when it
 * has one, is asked for on top. Both go in the body of the request, never
 * in an address. The file itself comes from the object storage, at a URL
 * the API signs, which the browser calls without the API.
 */

const PASSWORD_REFUSED: PasswordRefused = { type: 'passwordRefused' }

const UNUSABLE: Unusable = { type: 'unusable' }

const FAILED: Unread = { type: 'failed' }

const TOO_MANY_REQUESTS: Unread = { type: 'tooManyRequests' }

/**
 * The link has a password, and the request had none, or one that is not it.
 * The API answers the same while the link is locked after five that were
 * not, the right one as well.
 */
type PasswordRefused = { type: 'passwordRefused' }

/**
 * The link works no more, or never did: no link has the token, it was
 * revoked, it expired, it was used as often as it may, or its file was
 * removed. The API does not say which.
 */
type Unusable = { type: 'unusable' }

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(null, { status: P.union(413, 415, 500) })

export type SharedFileRead =
  | { type: 'found'; file: ModelsSharedFileResponse }
  | PasswordRefused
  | Unusable
  | Unread

/**
 * What is known of the file of a share link: its name, its kind and its
 * size. Reading it uses nothing up: the link counts the files it gave, not
 * the times it was looked at.
 */
export const readSharedFile = async (
  token: string,
  password: string | null,
): Promise<SharedFileRead> => {
  const answer = await sharedFileCrudGet({ token, password }).catch(() => null)

  // The token of the address has the shape the API takes, so a 400 is a
  // password longer than that of any link
  return match(answer)
    .returnType<SharedFileRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', file: data.data }))
    .with({ status: P.union(400, 403) }, () => PASSWORD_REFUSED)
    .with({ status: 404 }, () => UNUSABLE)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(UNANSWERED, () => FAILED)
    .exhaustive(outsideTheContract)
}

export type SharedFileLoad =
  | { type: 'loaded'; content: Blob }
  | PasswordRefused
  | Unusable
  /** The URL was issued, and counted, but the storage did not answer with the file */
  | { type: 'notFetched' }
  | Unread

/** Asks for the URL of the storage that answers the file for a few minutes; the link counts it as a download. */
const issueDownload = async (token: string, password: string | null) => {
  const answer = await sharedFileCrudGetDownloadUrl({
    token,
    password,
    inline: false,
  }).catch(() => null)

  return match(answer)
    .returnType<
      { type: 'issued'; url: string } | Exclude<SharedFileLoad, LoadedOrNot>
    >()
    .with({ status: 200 }, ({ data }) => ({
      type: 'issued',
      url: data.data.downloadUrl,
    }))
    .with({ status: P.union(400, 403) }, () => PASSWORD_REFUSED)
    .with({ status: 404 }, () => UNUSABLE)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(UNANSWERED, () => FAILED)
    .exhaustive(outsideTheContract)
}

/** What only the storage answers */
type LoadedOrNot = { type: 'loaded' | 'notFetched' }

/**
 * Loads the file of a share link into the page: the URL is asked for, which
 * the link counts as one download, and the file is fetched from it, once.
 * The page shows, opens and saves the file it holds, so neither counts
 * again. The file has the kind the API named, whatever the storage says.
 */
export const loadSharedFile = async (
  token: string,
  password: string | null,
  file: ModelsSharedFileResponse,
): Promise<SharedFileLoad> => {
  const issued = await issueDownload(token, password)
  if (issued.type !== 'issued') {
    return issued
  }
  const answer = await fetch(issued.url).catch(() => null)
  const bytes =
    answer?.ok === true ? await answer.arrayBuffer().catch(() => null) : null

  return bytes === null
    ? { type: 'notFetched' }
    : { type: 'loaded', content: new Blob([bytes], { type: file.contentType }) }
}
