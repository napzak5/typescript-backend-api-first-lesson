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
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import {
  ISSUED_NOTE,
  limitNameOf,
  PASSWORD_APART_NOTE,
  passwordNameOf,
} from '../../share-link'
import styles from './issued-share-link.module.css'

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
}: IssuedShareLinkProps) => (
  <Card title='発行した共有リンク' headingRef={headingRef}>
    <div className={styles['issued']}>
      <Alert tone='warning'>{ISSUED_NOTE}</Alert>
      <TextField
        label='共有リンク'
        autoComplete='off'
        value={address}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
        description='このアドレスを、ファイルを見せる相手に伝えてください。'
      />
      <div className={styles['copy']}>
        <Button onClick={onCopy}>リンクをコピーする</Button>
        <Note role='status'>
          {copying === 'copied' ? 'リンクをコピーしました。' : ''}
        </Note>
      </div>
      {copying === 'failed' && (
        <Alert tone='danger'>
          リンクをコピーできませんでした。上の欄のアドレスを選んで、コピーしてください。
        </Alert>
      )}
      <DescriptionList
        items={[
          {
            term: '有効期限',
            description: momentNameAt(shareLink.expiresAt, timezone),
          },
          {
            term: 'ダウンロードの回数の上限',
            description: limitNameOf(shareLink.maxDownloads),
          },
          {
            term: 'パスワード',
            description: passwordNameOf(shareLink.hasPassword),
          },
        ]}
      />
      {shareLink.hasPassword && <Note>{PASSWORD_APART_NOTE}</Note>}
      <Actions>
        <ButtonLink href={shareLinkHref}>共有リンクを見る</ButtonLink>
        <ButtonLink href={fileHref} variant='quiet'>
          ファイルへ戻る
        </ButtonLink>
      </Actions>
    </div>
  </Card>
)
