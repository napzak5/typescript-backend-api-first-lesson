import {
  Alert,
  Button,
  LoadingIndicator,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import type { Refusal } from '../api/account-api'
import { messageAfter } from '../utils/account-flow'

type CheckingLinkProps = {
  /** The title of the screen that the link leads to */
  title: string
}

/** What a screen shows while the API is asked whether its link still works. */
export const CheckingLink = ({ title }: CheckingLinkProps) => (
  <>
    <PageHeader title={title} />
    <LoadingIndicator label='リンクを確かめています' />
  </>
)

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
}: LinkNotCheckedProps) => (
  <>
    <PageHeader title={title} />
    <Alert tone='danger'>{messageAfter(refusal)}</Alert>
    <Button onClick={onRetry}>もう一度確かめる</Button>
  </>
)

type LinkUnusableProps = {
  /** Why the link does not work, and what to do about it */
  description: string
  /** The way on: where another link is asked for */
  children?: ReactNode
}

/**
 * The screen was opened without a link that works: by a link that is used,
 * expired or withdrawn, or by an address typed or loaded again, which
 * carries no token.
 */
export const LinkUnusable = ({ description, children }: LinkUnusableProps) => (
  <>
    <PageHeader title='このリンクは使えません' description={description} />
    {children}
  </>
)
