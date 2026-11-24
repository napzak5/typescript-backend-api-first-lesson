import type { ModelsShareLinkResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Actions,
  Alert,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  Note,
  TextField,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import { limitNameOf, passwordNameOf } from '../../utils/share-link'
import styles from './issued-share-link.module.css'

const { issued: ISSUED } = adminShareLinkMessages

/** Whether the link was put on the clipboard */
export type Copying = 'notCopied' | 'copied' | 'failed'

export type IssuedShareLinkProps = {
  /** The address of the portal the link is given as, with its token */
  address: string
  shareLink: ModelsShareLinkResponse
  /** The time zone of the salon, which the end is said in */
  timezone: string
  copying: Copying
  /** Puts the address on the clipboard */
  onCopy: () => void
  /** The heading, which takes the focus from the button of the form that went */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The screen of the link */
  shareLinkHref: string
  /** The screen of the file */
  fileHref: string
}

/**
 * The link that was issued, which the API gives once: the address to hand
 * on, in a field it is chosen and copied from, the button that copies it,
 * and what the link allows. The page says that it shows the address now
 * alone.
 */
export const IssuedShareLink = ({
  address,
  shareLink,
  timezone,
  copying,
  onCopy,
  headingRef,
  shareLinkHref,
  fileHref,
}: IssuedShareLinkProps) => {
  const say = useSay()

  return (
    <Card title={say(ISSUED.title)} headingRef={headingRef}>
      <div className={styles['issued']}>
        <Alert tone='warning'>{say(ISSUED.onlyNow)}</Alert>
        <TextField
          label={say(ISSUED.link)}
          autoComplete='off'
          value={address}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          description={say(ISSUED.linkDescription)}
        />
        <div className={styles['copy']}>
          <Button onClick={onCopy}>{say(ISSUED.copy)}</Button>
          <Note role='status'>
            {copying === 'copied' ? say(ISSUED.copied) : ''}
          </Note>
        </div>
        {copying === 'failed' && (
          <Alert tone='danger'>{say(ISSUED.copyFailed)}</Alert>
        )}
        <DescriptionList
          items={[
            {
              term: say(ISSUED.expiresAt),
              description: say(momentNameAt(shareLink.expiresAt, timezone)),
            },
            {
              term: say(ISSUED.limit),
              description: say(limitNameOf(shareLink.maxDownloads)),
            },
            {
              term: say(ISSUED.password),
              description: say(passwordNameOf(shareLink.hasPassword)),
            },
          ]}
        />
        {shareLink.hasPassword && <Note>{say(ISSUED.passwordApart)}</Note>}
        <Actions>
          <ButtonLink href={shareLinkHref}>
            {say(ISSUED.toShareLink)}
          </ButtonLink>
          <ButtonLink href={fileHref} variant='quiet'>
            {say(adminShareLinkMessages.toFile)}
          </ButtonLink>
        </Actions>
      </div>
    </Card>
  )
}
