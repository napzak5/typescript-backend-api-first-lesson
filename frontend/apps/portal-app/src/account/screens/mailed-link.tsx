import {
  Alert,
  Button,
  LoadingIndicator,
  PageHeader,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalAccountMessages } from '@beauty-salon-shared/i18n/messages/portal'
import type { ReactNode } from 'react'
import type { Refusal } from '../api/account-api'
import { messageAfter } from '../utils/account-flow'

const { mailedLink: words } = portalAccountMessages

type CheckingLinkProps = {
  /** The title of the screen that the link leads to */
  title: LocalizedText
}

/** What a screen shows while the API is asked whether its link still works. */
export const CheckingLink = ({ title }: CheckingLinkProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(title)} />
      <LoadingIndicator label={say(words.checking)} />
    </>
  )
}

type LinkNotCheckedProps = CheckingLinkProps & {
  refusal: Refusal
  /** Asks the API again */
  onRetry: () => void
}

/** The API did not say whether the link works: the person may ask again. */
export const LinkNotChecked = ({
  title,
  refusal,
  onRetry,
}: LinkNotCheckedProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(title)} />
      <Alert tone='danger'>{say(messageAfter(refusal))}</Alert>
      <Button onClick={onRetry}>{say(words.checkAgain)}</Button>
    </>
  )
}

type LinkUnusableProps = {
  /** Why the link does not work, and what to do about it */
  description: LocalizedText
  /** The way on: where another link is asked for */
  children?: ReactNode
}

/**
 * The screen was opened without a link that works: by a link that is used,
 * expired or withdrawn, or by an address typed or loaded again, which
 * carries no token.
 */
export const LinkUnusable = ({ description, children }: LinkUnusableProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(words.unusable)} description={say(description)} />
      {children}
    </>
  )
}
