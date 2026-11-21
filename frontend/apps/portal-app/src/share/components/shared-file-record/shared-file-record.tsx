import type { ModelsSharedFileResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Button,
  Card,
  DescriptionList,
  Note,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import { factsOf, isImage, LOAD_NOTE } from '../../shared-file'
import styles from './shared-file-record.module.css'

/** The file itself: not loaded into the page yet, or held by it at an object URL */
export type SharedFileContent =
  | {
      type: 'notLoaded'
      /** The file is being loaded */
      pending: boolean
      /** What went wrong with the last load */
      message: string | undefined
    }
  | { type: 'loaded'; url: string }

export type SharedFileRecordProps = {
  file: ModelsSharedFileResponse
  content: SharedFileContent
  /** The button that loads the file was pressed */
  onLoad: () => void
  /** The heading of the part, which takes the focus once the file is loaded */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

/**
 * The file of a share link. What is known of it is shown at once; the file
 * itself when a button is pressed, which the link counts as a download, so
 * the button says so. The page holds the file it loaded: an image is shown,
 * and every file opens in a tab of its own or is saved under its name,
 * without another download.
 */
export const SharedFileRecord = ({
  file,
  content,
  onLoad,
  headingRef,
}: SharedFileRecordProps) => (
  <Card title='ファイル' headingRef={headingRef}>
    <div className={styles['record']}>
      {match(content)
        .with({ type: 'notLoaded' }, ({ pending, message }) => (
          <>
            <Note>{LOAD_NOTE}</Note>
            {message !== undefined && <Alert tone='danger'>{message}</Alert>}
            <Button onClick={onLoad} pending={pending}>
              {message === undefined
                ? 'ファイルを読み込む'
                : 'もう一度読み込む'}
            </Button>
          </>
        ))
        .with({ type: 'loaded' }, ({ url }) => (
          <>
            {isImage(file.contentType) && (
              <img
                className={styles['preview']}
                src={url}
                alt={file.filename}
              />
            )}
            <ul className={styles['links']} aria-label='ファイルを開く'>
              <li>
                <a href={url} target='_blank' rel='noopener noreferrer'>
                  新しいタブで開く
                </a>
              </li>
              <li>
                <a href={url} download={file.filename}>
                  保存する
                </a>
              </li>
            </ul>
          </>
        ))
        .exhaustive()}
      <DescriptionList items={factsOf(file)} />
    </div>
  </Card>
)
