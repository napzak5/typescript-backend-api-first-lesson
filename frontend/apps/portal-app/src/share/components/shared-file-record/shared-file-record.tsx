import type { ModelsSharedFileResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Button,
  Card,
  DescriptionList,
  Note,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalShareMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import { factsOf, isImage } from '../../utils/shared-file'
import styles from './shared-file-record.module.css'

const { file: words } = portalShareMessages

/** The file itself: not loaded into the page yet, or held by it at an object URL */
export type SharedFileContent =
  | {
      type: 'notLoaded'
      /** The file is being loaded */
      pending: boolean
      /** What went wrong with the last load; it is said in the language of the page */
      message: LocalizedText | undefined
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
}: SharedFileRecordProps) => {
  const say = useSay()

  return (
    <Card title={say(words.title)} headingRef={headingRef}>
      <div className={styles['record']}>
        {match(content)
          .with({ type: 'notLoaded' }, ({ pending, message }) => (
            <>
              <Note>{say(words.loadNote)}</Note>
              {message !== undefined && (
                <Alert tone='danger'>{say(message)}</Alert>
              )}
              <Button onClick={onLoad} pending={pending}>
                {say(message === undefined ? words.load : uiMessages.loadAgain)}
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
              <ul className={styles['links']} aria-label={say(words.openings)}>
                <li>
                  <a href={url} target='_blank' rel='noopener noreferrer'>
                    {say(words.inNewTab)}
                  </a>
                </li>
                <li>
                  <a href={url} download={file.filename}>
                    {say(words.save)}
                  </a>
                </li>
              </ul>
            </>
          ))
          .exhaustive()}
        <DescriptionList
          items={factsOf(file).map(({ term, description }) => ({
            term: say(term),
            description: say(description),
          }))}
        />
      </div>
    </Card>
  )
}
