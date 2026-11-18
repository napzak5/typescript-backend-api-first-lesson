import { Result } from '@beauty-salon-backend/utility'
import type { SharedAttachment } from '../../../repositories/share-link.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import type { ShareLinkUseCaseDependencies } from './dependencies'
import { noSharedFile } from './link-rules'
import { checkSharePassword } from './password-check'

/** What a viewer presents: the token of a link, and its password if any. */
export type SharedFileCredentials = {
  token: string
  password: string | null
}

/**
 * The link a viewer's token opens at `now` and the attachment it shows,
 * once the password is accepted. A token that opens nothing is answered
 * before the password is looked at: a password is only ever checked
 * against a link that works, and only that counts as a guess.
 */
export const openSharedFile = async (
  dependencies: Pick<
    ShareLinkUseCaseDependencies,
    'shareLinkRepository' | 'passwordHasher' | 'tokenIssuer'
  >,
  { token, password }: SharedFileCredentials,
  now: Date,
): Promise<Result<SharedAttachment, DomainError>> => {
  const { shareLinkRepository, tokenIssuer } = dependencies

  const found = await shareLinkRepository.findWorking(
    tokenIssuer.hashOf(token),
    now,
  )
  if (found.type === 'error') {
    return found
  }
  if (found.data === null) {
    return Result.error(noSharedFile)
  }

  const checked = await checkSharePassword(
    dependencies,
    found.data.shareLink,
    password,
    now,
  )
  if (checked.type === 'error') {
    return checked
  }
  if (checked.data.type === 'refused') {
    return Result.error(DomainErrors.passwordRequired())
  }

  return Result.success(found.data)
}
