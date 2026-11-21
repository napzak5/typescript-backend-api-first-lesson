import {
  type ModelsShareLinkCreateRequest,
  type ModelsShareLinkResponse,
  shareLinkCrudCreate,
  shareLinkCrudDelete,
  shareLinkCrudGet,
  shareLinkCrudList,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '../reading'

/*
 * The share links of a file: a link that shows the file to somebody who
 * has no account, until it runs out. The API gives the token of a link in
 * the answer that issues it, and never again.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key the links of a file are listed under: an issue or a revocation drops every page. */
export const shareLinksKeyOf = (attachmentId: string): string[] => [
  'share-links',
  attachmentId.toLowerCase(),
]

/** The key a link is read under. */
export const shareLinkKeyOf = (shareLinkId: string): string[] => [
  'share-link',
  shareLinkId.toLowerCase(),
]

const SHARE_LINK_PAGE = 20

export type ShareLinkPage =
  | Page<ModelsShareLinkResponse>
  /** The role shares no file, or the file is of another salon */
  | Forbidden
  /** The file was removed meanwhile */
  | NotFound
  | Unread

/** A page of the links of a file, the latest issued first: those that ran out as well, not those revoked. */
export const readShareLinkPage = async (
  attachmentId: string,
  cursor: string | undefined,
): Promise<ShareLinkPage> => {
  const answer = await shareLinkCrudList(attachmentId, {
    ...from(cursor),
    limit: SHARE_LINK_PAGE,
  }).catch(() => null)

  // A 400 says that the link of the cursor was revoked meanwhile: the
  // screens send only what the API takes
  return match(answer)
    .returnType<ShareLinkPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 400 }, () => FAILED)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 404 }, () => NOT_FOUND)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ShareLinkRead =
  | { type: 'found'; shareLink: ModelsShareLinkResponse }
  /** None has the ID, it was revoked, or its file was removed */
  | NotFound
  /** The role shares no file, or the link is of a file of another salon */
  | Forbidden
  | Unread

/** A link: one that was revoked, or none, is not found. */
export const readShareLink = async (
  shareLinkId: string,
): Promise<ShareLinkRead> => {
  const answer = await shareLinkCrudGet(shareLinkId).catch(() => null)

  return match(answer)
    .returnType<ShareLinkRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      shareLink: data.data,
    }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ShareLinkIssue =
  /** The token is in this answer alone */
  | { type: 'issued'; shareLink: ModelsShareLinkResponse; token: string }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The file was removed meanwhile */
  | NotFound
  /** The upload of the file was not finished */
  | { type: 'notUploaded' }
  | Forbidden
  | Unread

/** Issues a link to a file, which works until the moment it ends at. */
export const issueShareLink = async (
  attachmentId: string,
  request: ModelsShareLinkCreateRequest,
): Promise<ShareLinkIssue> => {
  const answer = await shareLinkCrudCreate(attachmentId, request).catch(
    () => null,
  )

  // A 413 and a 415 are answers to a body the screens never send
  return match(answer)
    .returnType<ShareLinkIssue>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'issued',
      shareLink: data.data.shareLink,
      token: data.data.token,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 409 }, () => ({ type: 'notUploaded' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ShareLinkRevocation =
  | { type: 'revoked' }
  /** It was revoked meanwhile, or its file was removed */
  | NotFound
  | Forbidden
  | Unread

/** Revokes a link: its token opens nothing from the next request on. */
export const revokeShareLink = async (
  shareLinkId: string,
): Promise<ShareLinkRevocation> => {
  const answer = await shareLinkCrudDelete(shareLinkId).catch(() => null)

  return match(answer)
    .returnType<ShareLinkRevocation>()
    .with({ status: 204 }, () => ({ type: 'revoked' }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
